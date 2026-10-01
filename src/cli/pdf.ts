// PDF-Export: Deck bauen, lokal ausliefern, mit installiertem Edge/Chrome headless drucken (CDP).
// Keine zusätzliche Abhängigkeit: Node 24 bringt fetch und WebSocket mit.

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { build, type InlineConfig } from 'vite'

const BROWSERS: Record<string, string[]> = {
  win32: [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
}

export function findBrowser(explicit?: string): string {
  const candidates = [explicit, process.env.HASHMARK_BROWSER, ...(BROWSERS[process.platform] ?? [])].filter(Boolean) as string[]
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) throw new Error('Kein Edge/Chrome gefunden. Pfad mit --browser <pfad> oder HASHMARK_BROWSER angeben.')
  return found
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

/** Minimaler statischer Server für den Build (nur 127.0.0.1, nur innerhalb von `root`). */
function serve(root: string): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    const file = path.resolve(root, rel)
    if (path.relative(root, file).startsWith('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404
      return res.end()
    }
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

/** Kleiner CDP-Client über WebSocket */
async function connect(wsUrl: string) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let id = 0
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  const errors: string[] = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data))
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)!
      pending.delete(msg.id)
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description ?? 'Fehler im Browser')
  }
  const send = (method: string, params: object = {}) =>
    new Promise<any>((resolve, reject) => {
      const i = ++id
      pending.set(i, { resolve, reject })
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  return { send, errors, close: () => ws.close() }
}

async function launch(browser: string, profile: string): Promise<{ proc: ChildProcess; port: number }> {
  const proc = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  // Port aus stderr oder aus `DevToolsActivePort` im Profil. Neuere Edge-Versionen starten den Browser in einem
  // weiteren Prozess und beenden den gestarteten mit Code 0 – das ist kein Fehler.
  const port = await new Promise<number>((resolve, reject) => {
    let log = ''
    let done = false
    const finish = (fn: () => void) => { if (!done) { done = true; clearTimeout(timer); clearInterval(poll); fn() } }
    const timer = setTimeout(() => finish(() => reject(new Error(`Browser startet nicht:\n${log}`))), 30_000)
    const poll = setInterval(() => {
      try {
        const port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0])
        if (port > 0) finish(() => resolve(port))
      } catch { /* noch nicht da */ }
    }, 150)
    proc.stderr!.on('data', (chunk) => {
      log += chunk
      const m = log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//)
      if (m) finish(() => resolve(Number(m[1])))
    })
    proc.on('error', (e) => finish(() => reject(e)))
    proc.on('exit', (code) => { if (code) finish(() => reject(new Error(`Browser beendet (${code}):\n${log}`))) })
  })
  return { proc, port }
}

export interface PdfOptions {
  out: string
  /** Query der Druckansicht, z. B. "?print&depth=2" */
  query: string
  browser?: string
}

export interface PrintResult { pages: number; bytes: number; warnings: string[] }

type Cdp = Awaited<ReturnType<typeof connect>>

/**
 * Seite unter `url` (Druckansicht) in Edge/Chrome headless öffnen, auf das Signal `printReady` warten und `fn` ausführen.
 * Räumt Browser und Profil danach auf. Basis für den PDF-Export und `hashmark check`.
 */
export async function withPrintView<T>(url: string, browserPath: string | undefined, fn: (cdp: Cdp) => Promise<T>): Promise<T> {
  const browser = findBrowser(browserPath)
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hashmark-print-'))
  let proc: ChildProcess | undefined
  try {
    const launched = await launch(browser, path.join(tmp, 'profile'))
    proc = launched.proc
    const targets = await (await fetch(`http://127.0.0.1:${launched.port}/json/list`)).json()
    const page = targets.find((t: { type: string }) => t.type === 'page')
    const cdp = await connect(page.webSocketDebuggerUrl)
    try {
      await cdp.send('Runtime.enable')
      await cdp.send('Page.enable')
      await cdp.send('Page.navigate', { url })

      const deadline = Date.now() + 90_000
      for (;;) {
        const r = await cdp.send('Runtime.evaluate', { expression: 'document.documentElement.dataset.printReady || ""', returnByValue: true })
        if (r.result?.value === '1') break
        if (Date.now() > deadline) throw new Error(`Druckansicht wurde nicht fertig.${cdp.errors.length ? '\n' + cdp.errors.join('\n') : ''}`)
        await new Promise((res) => setTimeout(res, 200))
      }
      return await fn(cdp)
    } finally {
      await cdp.send('Browser.close').catch(() => {})
      cdp.close()
    }
  } finally {
    proc?.kill()
    // Browser-Profil kann unter Windows kurz gesperrt sein
    await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {})
  }
}

/**
 * Druckansicht unter `url` (…/?print&…) mit Edge/Chrome headless als PDF speichern.
 * Genutzt von `hashmark pdf` (nach einem Build) und von der Desktop-App (direkt vom laufenden Server).
 */
export function printUrlToPdf(url: string, out: string, browserPath?: string): Promise<PrintResult> {
  return withPrintView(url, browserPath, async (cdp) => {
    const { data } = await cdp.send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      generateDocumentOutline: true, // Lesezeichen aus den Folientiteln (h1…h6 nach Tiefe)
      generateTaggedPDF: true,
    })
    const pdf = Buffer.from(data, 'base64')
    await fsp.mkdir(path.dirname(out), { recursive: true })
    await fsp.writeFile(out, pdf)
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length
    return { pages, bytes: pdf.length, warnings: cdp.errors }
  })
}

/** Deck bauen und lokal ausliefern (für Druckansicht und Prüfung); `close()` räumt Server und Build auf. */
export async function serveBuild(config: InlineConfig): Promise<{ url: string; close(): Promise<void> }> {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hashmark-pdf-'))
  const dist = path.join(tmp, 'dist')
  let server: http.Server | undefined
  const close = async () => {
    server?.close()
    await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {})
  }
  try {
    await build({ ...config, logLevel: 'warn', build: { outDir: dist, emptyOutDir: true, chunkSizeWarningLimit: 100_000 } })
    server = await serve(dist)
    return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, close }
  } catch (e) {
    await close()
    throw e
  }
}

export async function exportPdf(config: InlineConfig, opts: PdfOptions) {
  const browser = findBrowser(opts.browser)
  console.log('[hashmark] baue Deck …')
  const site = await serveBuild(config)
  try {
    console.log(`[hashmark] rendere mit ${path.basename(browser)} …`)
    const r = await printUrlToPdf(site.url + opts.query, opts.out, browser)
    console.log(`[hashmark] PDF: ${opts.out} (${r.pages} Seiten, ${(r.bytes / 1024 / 1024).toFixed(1)} MB)`)
    if (r.warnings.length) console.warn(`[hashmark] Hinweise aus dem Browser:\n${r.warnings.join('\n')}`)
  } finally {
    await site.close()
  }
}
