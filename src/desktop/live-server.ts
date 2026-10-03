// Live-Server der Desktop-App: liefert die vorgebaute Runtime (runtime-dist/) als statische Dateien aus,
// dazu das Deck als JSON, das Theme, die Bilder des Decks, die Datei-API des Editors und die App-Aktionen.
// Änderungen an den Deck-Dateien gehen per Server-Sent Events an alle offenen Seiten.
// Anders als der Vite-Dev-Server muss er nichts vorbündeln – Start und erstes Laden dauern Sekunden.

import fs from 'node:fs'
import crypto from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { loadDeck, type LoadResult } from '../core/deck.ts'
import { ASSET_PREFIX, IMAGE_MIME } from '../core/render.ts'
import { appApi, editorApi, planApi } from '../vite/editor-api.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  ...IMAGE_MIME,
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
   * Die Präsentation ist öffentlich, der Editor nur mit Passwort (HTTP Basic). Ohne Passwort gibt es keinen Editor.
   */
  web?: { host?: string; port?: number; editorUser?: string; editorPassword?: string }
}

export interface LiveServer {
  url: string
  close(): Promise<void>
  /** Deck neu laden und an alle Seiten schicken (auch ohne Dateiänderung) */
  reload(): Promise<void>
}

type Payload = { deck: LoadResult['deck'] } | { error: string }

export async function startLiveServer(opts: LiveServerOptions): Promise<LiveServer> {
  const { deckDir, runtimeDir, onAppAction } = opts
  const log = opts.log ?? ((m: string) => console.error(m))
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

  if (opts.initial) {
    current = opts.initial
    payload = { deck: current.deck }
  } else {
    await load()
  }

  const app = appApi(onAppAction)
  const web = opts.web
  const editor = editorApi(deckDir, web ? { allowHost: () => true } : {})
  const plan = planApi(deckDir, web ? { allowHost: () => true } : {})

  // Webdienst: nur Deck, Theme, Ereignisse und Bilder sind öffentlich; Editor-Seite und Datei-API brauchen das Passwort
  const PUBLIC_API = new Set(['/__hashmark/deck.json', '/__hashmark/theme.css', '/__hashmark/events'])
  const equal = (a: string, b: string) => {
    const ha = crypto.createHash('sha256').update(a).digest()
    const hb = crypto.createHash('sha256').update(b).digest()
    return crypto.timingSafeEqual(ha, hb)
  }
  /** true, wenn die Anfrage weiterlaufen darf; sonst ist die Antwort schon gesendet */
  function authorize(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (!web) return true
    if (!web.editorPassword) { res.statusCode = 404; res.end(); return false }
    const [scheme, token] = (req.headers.authorization ?? '').split(' ')
    const [user, ...rest] = scheme?.toLowerCase() === 'basic' && token ? Buffer.from(token, 'base64').toString('utf8').split(':') : ['']
    if (equal(user, web.editorUser ?? 'editor') && equal(rest.join(':'), web.editorPassword)) return true
    // Fehlversuche bremsen
    setTimeout(() => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Hashmark Editor", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Anmeldung nötig')
    }, 400)
    return false
  }

  function sendFile(res: http.ServerResponse, file: string, cache: string) {
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', cache)
    fs.createReadStream(file).pipe(res)
  }

  /** Datei unterhalb von `root`, sonst null (kein Ausbrechen per ../) */
  function inside(root: string, rel: string): string | null {
    const file = path.resolve(root, rel)
    const r = path.relative(root, file)
    if (r.startsWith('..') || path.isAbsolute(r)) return null
    return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null
  }

  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    const notFound = () => { res.statusCode = 404; res.end() }

    if (web && pathname === '/healthz') { res.setHeader('Content-Type', 'text/plain'); return void res.end('ok') }
    if (web && (pathname === '/editor.html' || (pathname.startsWith('/__hashmark/') && !PUBLIC_API.has(pathname))) && !authorize(req, res)) return

    if (pathname === '/__hashmark/deck.json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(JSON.stringify(payload))
    }
    if (pathname === '/__hashmark/theme.css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(current?.themeCss ?? '')
    }
    if (pathname === '/__hashmark/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
      res.write(': verbunden\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
    if (pathname.startsWith('/__hashmark/')) {
      // App-Aktionen, Fahrpläne, danach die Datei-API des Editors (alle prüfen localhost + Header)
      return void app(req, res, () => plan(req, res, () => editor(req, res, notFound)))
    }
    if (pathname.startsWith('/' + ASSET_PREFIX)) {
      const file = inside(deckDir, pathname.slice(ASSET_PREFIX.length + 1))
      return file ? sendFile(res, file, 'no-cache') : notFound()
    }
    // vorgebaute Runtime: / und ?print/?presenter → index.html
    const rel = pathname === '/' ? 'index.html' : pathname.slice(1)
    const file = inside(runtimeDir, rel)
    if (!file) return notFound()
    // gebündelte Dateien tragen einen Hash im Namen → dürfen dauerhaft im Cache liegen
    sendFile(res, file, rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  })

  const host = web?.host ?? '127.0.0.1'
  await new Promise<void>((resolve) => server.listen(web?.port ?? 0, host, resolve))
  const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${(server.address() as AddressInfo).port}/`
  // Proxys (z. B. Render) beenden stille Verbindungen: Ereignisstrom regelmäßig anstupsen
  const heartbeat = setInterval(() => { for (const res of clients) res.write(': ♥\n\n') }, 25_000)
  heartbeat.unref()

  // Deck-Dateien beobachten (rekursiv; Windows und macOS können das nativ)
  let timer: NodeJS.Timeout | undefined
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void reload(), 80) }
  const watchers: fs.FSWatcher[] = []
  try {
    watchers.push(fs.watch(deckDir, { recursive: true }, (_event, name) => {
      if (name && /\.(md|ya?ml|css|html)$/i.test(String(name)) && !String(name).split(/[\\/]/).some((p) => p.startsWith('.') || p === 'node_modules')) schedule()
    }))
  } catch (e) {
    log(`[hashmark] Datei-Überwachung nicht möglich: ${(e as Error).message}`)
  }
  // Theme-Dateien außerhalb des Decks ebenfalls beobachten (eingebaute Themes nicht)
  for (const t of current?.themeFiles ?? []) {
    if (!fs.existsSync(t) || !path.relative(deckDir, t).startsWith('..') || t.includes(`${path.sep}runtime${path.sep}themes${path.sep}`)) continue
    try { watchers.push(fs.watch(t, { recursive: true }, schedule)) } catch { /* egal */ }
  }

  return {
    url,
    reload,
    close: async () => {
      clearTimeout(timer)
      clearInterval(heartbeat)
      for (const w of watchers) w.close()
      for (const res of clients) res.end()
      clients.clear()
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
