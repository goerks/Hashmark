// Live-Server der Desktop-App: liefert die vorgebaute Runtime (runtime-dist/) als statische Dateien aus,
// dazu das Deck als JSON, das Theme, die Bilder des Decks, die Datei-API des Editors und die App-Aktionen.
// Änderungen an den Deck-Dateien gehen per Server-Sent Events an alle offenen Seiten.
// Anders als der Vite-Dev-Server muss er nichts vorbündeln – Start und erstes Laden dauern Sekunden.

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { loadDeck, type LoadResult } from '../core/deck.ts'
import { ASSET_PREFIX, MEDIA_MIME } from '../core/render.ts'
import { appApi, editorApi, planApi } from '../vite/editor-api.ts'
import { serveFile } from '../vite/serve-file.ts'
import { SessionStore, handleSessionsApi, ID_PATTERN, type SessionsOptions } from '../share/sessions.ts'
import { shareApi } from '../share/api.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  ...MEDIA_MIME,
}

export interface LiveServerOptions {
  deckDir: string
  runtimeDir: string
  onAppAction: (action: Record<string, unknown>) => void
  log?: (msg: string) => void
  /** schon gelesenes Deck (Vorab-Lesen der App) – spart das erste loadDeck */
  initial?: LoadResult
  /**
   * Betrieb als Webdienst (`hashmark serve`): Adresse und Port, Gesundheitsprüfung unter /healthz.
   * Präsentation und Editor sind öffentlich, es gibt keine Anmeldung.
   */
  web?: {
    host?: string
    port?: number
    siteDir?: string
    /**
     * Sessions: geteilte Präsentationen unter /s/<id>/ (siehe src/share/sessions.ts). Der Einzel-Deck-Betrieb unter /
     * bleibt daneben bestehen.
     */
    sessions?: SessionsOptions
  }
  /** Teilen-Schnittstelle des lokalen Editors (/__hashmark/share/*); nur außerhalb des Webdienstes, z. B. in der Desktop-App */
  share?: boolean
}

export interface LiveServer {
  url: string
  close(): Promise<void>
  /** Deck neu laden und an alle Seiten schicken (auch ohne Dateiänderung) */
  reload(): Promise<void>
}

type Payload = { deck: LoadResult['deck'] } | { error: string }

/** Zustand und Antworten für ein Deck: Deck-JSON, Theme, Ereignisse, Datei-API, Dateien des Decks. Der Server hat eines für `/` und je Session eines. */
interface Host {
  /** true = behandelt; Pfade außerhalb des Decks (Runtime-Dateien) gehören dem Server */
  handle(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean
  reload(): Promise<void>
  close(): Promise<void>
  themeFiles(): string[]
}

interface HostOptions {
  deckDir: string
  log: (msg: string) => void
  initial?: LoadResult
  /** Webdienst bzw. Session: Datei-API für jeden Host-Header, keine App-Aktionen */
  web: boolean
  /** Session: Dateien kommen nur über die Schnittstellen, keine Überwachung des Ordners; Antworten für Dateien sind abgeschottet */
  session: boolean
  onAppAction?: (action: Record<string, unknown>) => void
  share: boolean
}

const MIME_OF = (file: string) => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'

/** mit Teilabrufen (Range), damit man in Videos vorspulen kann */
function sendFile(req: http.IncomingMessage, res: http.ServerResponse, file: string, cache: string) {
  serveFile(req, res, file, { type: MIME_OF(file), cache })
}

/** Datei unterhalb von `root`, sonst null (kein Ausbrechen per ../) */
function inside(root: string, rel: string): string | null {
  const file = path.resolve(root, rel)
  const r = path.relative(root, file)
  if (r.startsWith('..') || path.isAbsolute(r)) return null
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null
}

async function createHost(o: HostOptions): Promise<Host> {
  const { deckDir, log } = o
  let current: LoadResult | null = null
  let payload: Payload = { error: 'Deck wird geladen …' }
  const clients = new Set<http.ServerResponse>()

  async function load(): Promise<{ themeChanged: boolean }> {
    const before = current?.themeCss
    try {
      current = await loadDeck(deckDir)
      payload = { deck: current.deck }
      for (const w of current.warnings) log(`[hashmark] ${w}`)
    } catch (e) {
      payload = { error: (e as Error).message }
    }
    return { themeChanged: !!before && current?.themeCss !== before }
  }

  const broadcast = (event: string, data: string) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${data}\n\n`)
  }

  async function reload() {
    const { themeChanged } = await load()
    if (themeChanged) broadcast('reload', '{}')
    else broadcast('deck', JSON.stringify(payload))
  }

  if (o.initial) {
    current = o.initial
    payload = { deck: current.deck }
  } else {
    await load()
  }

  const app = appApi(o.onAppAction ?? (() => {}))
  const apiOptions = o.web ? { allowHost: () => true } : {}
  const editor = editorApi(deckDir, apiOptions)
  const plan = planApi(deckDir, apiOptions)
  const share = o.share ? shareApi(deckDir, apiOptions) : null

  let timer: NodeJS.Timeout | undefined
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void reload(), 80) }

  // Heartbeat: Proxys (z. B. Render) beenden stille Verbindungen, der Ereignisstrom wird regelmäßig angestupst
  const heartbeat = setInterval(() => { for (const res of clients) res.write(': ♥\n\n') }, 25_000)
  heartbeat.unref()

  // Deck-Dateien beobachten (rekursiv; Windows und macOS können das nativ). Sessions werden nicht beobachtet: Dateien kommen
  // dort nur über die Schnittstellen, die selbst neu laden (sonst braucht jede Session einen Beobachter).
  const watchers: fs.FSWatcher[] = []
  if (!o.session) {
    try {
      watchers.push(fs.watch(deckDir, { recursive: true }, (_event, name) => {
        if (name && /\.(md|ya?ml|css|html)$/i.test(String(name)) && !String(name).split(/[\\/]/).some((p) => p.startsWith('.') || p === 'node_modules')) schedule()
      }))
    } catch (e) {
      log(`[hashmark] Datei-Überwachung nicht möglich: ${(e as Error).message}`)
    }
    // Theme-Dateien außerhalb des Decks ebenfalls beobachten (eingebaute Themes nicht)
    for (const t of current?.themeFiles ?? []) {
      if (!fs.existsSync(t) || !path.relative(deckDir, t).startsWith('..') || /[\\/]runtime[\\/](themes|components)[\\/]/.test(t + path.sep)) continue
      try { watchers.push(fs.watch(t, { recursive: true }, schedule)) } catch { /* egal */ }
    }
  }

  return {
    reload,
    themeFiles: () => current?.themeFiles ?? [],
    close: async () => {
      clearTimeout(timer)
      clearInterval(heartbeat)
      for (const w of watchers) w.close()
      for (const res of clients) res.end()
      clients.clear()
    },
    handle(req, res, pathname) {
      const notFound = () => { res.statusCode = 404; res.end() }
      if (pathname === '/__hashmark/deck.json') {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(payload))
        return true
      }
      if (pathname === '/__hashmark/theme.css') {
        res.setHeader('Content-Type', 'text/css; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(current?.themeCss ?? '')
        return true
      }
      if (pathname === '/__hashmark/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
        res.write(': verbunden\n\n')
        clients.add(res)
        req.on('close', () => clients.delete(res))
        return true
      }
      if (pathname.startsWith('/__hashmark/')) {
        // Sessions laden nach jeder Änderung selbst neu
        if (o.session && req.method !== 'GET') res.on('finish', schedule)
        // App-Aktionen (nur localhost, gibt es in Sessions nicht), Fahrpläne, Teilen, danach die Datei-API des Editors
        const rest = () => plan(req, res, () => (share ? share(req, res, () => editor(req, res, notFound)) : editor(req, res, notFound)))
        if (o.session) rest()
        else void app(req, res, rest)
        return true
      }
      if (pathname.startsWith('/' + ASSET_PREFIX)) {
        const file = inside(deckDir, pathname.slice(ASSET_PREFIX.length + 1))
        if (!file) { notFound(); return true }
        // Fremde Dateien nie als Seite: kein Erraten des Typs, kein Skript (SVG, HTML) beim direkten Aufruf
        if (o.session) {
          res.setHeader('X-Content-Type-Options', 'nosniff')
          res.setHeader('Content-Security-Policy', 'sandbox; default-src \'none\'; style-src \'unsafe-inline\'')
        }
        // Dateien des Decks sind nie eine Seite: der Editor schreibt auch Komponenten (.html), die hier als Text kommen müssen
        if (/\.html?$/i.test(file)) {
          res.setHeader('X-Content-Type-Options', 'nosniff')
          serveFile(req, res, file, { type: 'text/plain; charset=utf-8', cache: 'no-cache' })
          return true
        }
        sendFile(req, res, file, 'no-cache')
        return true
      }
      return false
    },
  }
}

/** Seiten einer Session: Basisadresse und Skript-Freigabe (Nonce) einsetzen. Skripte aus dem Deck laufen nie (CSP). */
function pageOfSession(html: string, id: string, nonce: string): string {
  const base = `/s/${id}`
  const marker = `<script nonce="${nonce}">window.__HASHMARK_SESSION__=${JSON.stringify({ id, base })}</script>`
  return html
    .replace(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`)
    .replace('/__hashmark/theme.css', `${base}/__hashmark/theme.css`)
    .replace(/<head>/i, `<head>${marker}`)
}

const cspOf = (nonce: string) => [
  "default-src 'self'", `script-src 'self' 'nonce-${nonce}'`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "media-src 'self' data: blob:",
  "font-src 'self' data:", "connect-src 'self'", "frame-src 'self'", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
].join('; ')

const MAX_SESSION_HOSTS = 20

export async function startLiveServer(opts: LiveServerOptions): Promise<LiveServer> {
  const { deckDir, runtimeDir, onAppAction } = opts
  const log = opts.log ?? ((m: string) => console.error(m))
  const web = opts.web
  const root = await createHost({ deckDir, log, initial: opts.initial, web: !!web, session: false, onAppAction, share: !!opts.share && !web })

  const store = web?.sessions ? new SessionStore(web.sessions) : null
  const hosts = new Map<string, Promise<Host>>()
  const dropHost = (id: string) => { const h = hosts.get(id); hosts.delete(id); void h?.then((x) => x.close()) }
  if (store) store.onRemove = dropHost
  const hostOf = (id: string): Promise<Host> => {
    let h = hosts.get(id)
    if (h) { hosts.delete(id) } // neu einreihen: zuletzt benutzt steht hinten
    else {
      h = createHost({ deckDir: store!.deckDir(id), log, web: true, session: true, share: false })
      while (hosts.size >= MAX_SESSION_HOSTS) dropHost(hosts.keys().next().value as string)
    }
    hosts.set(id, h)
    return h
  }

  const readPage = (name: string) => fs.readFileSync(path.join(runtimeDir, name), 'utf8')

  async function session(req: http.IncomingMessage, res: http.ServerResponse, id: string, rest: string, notFound: () => void) {
    if (!store || !store.has(id)) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return void res.end('Diese Präsentation ist nicht (mehr) online. Der Besitzer kann sie wiederherstellen.') }
    store.touch(id)
    const role = store.role(id, String(req.headers['x-hashmark-token'] ?? ''))
    res.setHeader('Referrer-Policy', 'no-referrer')
    if (rest === '' || rest === 'index.html' || rest === 'editor.html') {
      const nonce = crypto.randomBytes(16).toString('base64')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Security-Policy', cspOf(nonce))
      return void res.end(pageOfSession(readPage(rest === 'editor.html' ? 'editor.html' : 'index.html'), id, nonce))
    }
    // Export per Server-Browser würde das Deck des Dienstes rendern, nicht die Session
    if (rest === '__hashmark/pptx') return notFound()
    if (rest.startsWith('__hashmark/')) {
      // Lesen darf jeder mit der Adresse, alles andere (Datei-API, Fahrplan schreiben) nur mit Bearbeiten-Token
      const open = req.method === 'GET' && ['__hashmark/deck.json', '__hashmark/theme.css', '__hashmark/events', '__hashmark/plan'].includes(rest)
      if (!open && role !== 'edit' && role !== 'owner') { res.statusCode = 403; res.setHeader('Content-Type', 'application/json'); return void res.end(JSON.stringify({ error: 'Dazu fehlt das Bearbeiten-Token (Link zum Bearbeiten verwenden)' })) }
    }
    const host = await hostOf(id)
    // die Schnittstellen (Datei-API, Fahrplan) kennen nur Adressen innerhalb des Decks
    req.url = '/' + rest + (new URL(req.url ?? '/', 'http://x').search)
    if (host.handle(req, res, '/' + rest)) return
    // Rest gehört der vorgebauten Runtime (Skripte, Stile, Schriften)
    const file = inside(runtimeDir, rest)
    if (!file) return notFound()
    sendFile(req, res, file, rest.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  }

  const server = http.createServer((req, res) => {
    let pathname: string
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname) } catch { res.statusCode = 400; return void res.end() }
    const notFound = () => { res.statusCode = 404; res.end() }

    if (web && pathname === '/healthz') { res.setHeader('Content-Type', 'text/plain'); return void res.end('ok') }
    // Vorschau eines Pull Requests: fertig gebaute Webseite (make docs) unter /webseite/, öffentlich wie die Präsentation
    if (web?.siteDir && (pathname === '/webseite' || pathname.startsWith('/webseite/'))) {
      if (pathname === '/webseite') { res.writeHead(301, { Location: '/webseite/' }); return void res.end() }
      const rel = pathname.slice('/webseite/'.length)
      const file = inside(web.siteDir, rel) ?? inside(web.siteDir, path.posix.join(rel, 'index.html'))
      return file ? sendFile(req, res, file, 'no-cache') : notFound()
    }

    // Sessions: Abgleich durch den Besitzer und die geteilten Präsentationen
    if (store && pathname.startsWith('/api/sessions/')) {
      void handleSessionsApi(store, { changed: (id) => void hosts.get(id)?.then((h) => h.reload()) }, req, res, pathname).then((done) => { if (!done) notFound() })
      return
    }
    const sm = store ? /^\/s\/([^/]+)(?:\/(.*))?$/.exec(pathname) : null
    if (sm) {
      if (!ID_PATTERN.test(sm[1])) return notFound()
      if (sm[2] === undefined) { res.writeHead(301, { Location: `/s/${sm[1]}/${new URL(req.url ?? '/', 'http://x').search}` }); return void res.end() }
      void session(req, res, sm[1], sm[2], notFound).catch((e) => { log(`[hashmark] Session ${sm[1]}: ${(e as Error).message}`); if (!res.headersSent) { res.statusCode = 500; res.end() } })
      return
    }

    if (root.handle(req, res, pathname)) return
    // vorgebaute Runtime: / und ?print/?presenter → index.html
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1)
    const file = inside(runtimeDir, rel)
    if (!file) return notFound()
    // gebündelte Dateien tragen einen Hash im Namen → dürfen dauerhaft im Cache liegen
    sendFile(req, res, file, rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  })

  const host = web?.host ?? '127.0.0.1'
  await new Promise<void>((resolve) => server.listen(web?.port ?? 0, host, resolve))
  const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${(server.address() as AddressInfo).port}/`

  return {
    url,
    reload: root.reload,
    close: async () => {
      await root.close()
      for (const id of [...hosts.keys()]) dropHost(id)
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
