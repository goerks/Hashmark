// Live-Server der Desktop-App: liefert die vorgebaute Runtime (runtime-dist/) als statische Dateien aus,
// dazu das Deck als JSON, das Theme, die Bilder des Decks, die Datei-API des Editors und die App-Aktionen.
// Änderungen an den Deck-Dateien gehen per Server-Sent Events an alle offenen Seiten.
// Anders als der Vite-Dev-Server muss er nichts vorbündeln – Start und erstes Laden dauern Sekunden.

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { loadDeck, type LoadResult } from '../core/deck.ts'
import { ASSET_PREFIX, IMAGE_MIME } from '../core/render.ts'
import { appApi, editorApi } from '../vite/editor-api.ts'

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
  const editor = editorApi(deckDir)

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
      // App-Aktionen, danach die Datei-API des Editors (beide prüfen localhost + Header)
      return void app(req, res, () => editor(req, res, notFound))
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

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`

  // Deck-Dateien beobachten (rekursiv; Windows und macOS können das nativ)
  let timer: NodeJS.Timeout | undefined
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void reload(), 80) }
  const watchers: fs.FSWatcher[] = []
  try {
    watchers.push(fs.watch(deckDir, { recursive: true }, (_event, name) => {
      if (name && /\.(md|ya?ml|css)$/i.test(String(name)) && !String(name).split(/[\\/]/).some((p) => p.startsWith('.') || p === 'node_modules')) schedule()
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
      for (const w of watchers) w.close()
      for (const res of clients) res.end()
      clients.clear()
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
