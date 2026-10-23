// Bilder für README und Webseite erzeugen: node scripts/make-screenshots.ts [--out <ordner>]
//
// Baut die Dokumentation in einen temporären Ordner, liefert sie lokal aus und fotografiert mit Edge/Chrome headless (CDP).
// Welche Bilder es gibt, steht in SHOTS (scripts/docs-features.ts): Folien als Einzelkarte (?card), Lesemodus, Druckansicht,
// Übersicht (Taste O), Presenter-View neben der Präsentation und den Editor (über `hashmark edit`).
//
//   ohne --out   nur die vier Bilder der README nach assets/screenshots (klein, liegen im Repository)
//   --out <dir>  alle Bilder; die Pipeline (pages.yml, ci.yml) legt sie beim Bau der Seiten an (HASHMARK_SHOTS)
//
// Ein Bild, das nicht fertig wird (Folie fehlt, Zeitüberschreitung), wird übersprungen; die Seite zeigt dann die Folie.

import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { findBrowser } from '../src/cli/pdf.ts'
import { SHOTS, type Shot } from './docs-features.ts'

const root = path.resolve(import.meta.dirname, '..')
const outArg = process.argv.indexOf('--out')
const outDir = path.resolve(root, outArg > 0 ? process.argv[outArg + 1] : 'assets/screenshots')
/** Bilder der README (liegen im Repository) */
const README_SHOTS = ['presenter.jpg', 'lesemodus.jpg', 'baum.jpg', 'karten.jpg']
const wanted = SHOTS.filter((s) => outArg > 0 || README_SHOTS.includes(s.name))

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

function serve(dir: string): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
    let file = path.resolve(dir, rel)
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (path.relative(dir, file).startsWith('..') || !fs.existsSync(file)) { res.statusCode = 404; return res.end() }
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

async function connect(wsUrl: string) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let id = 0
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data))
    const p = msg.id ? pending.get(msg.id) : undefined
    if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result) }
  }
  const send = (method: string, params: object = {}) => new Promise<any>((resolve, reject) => {
    const i = ++id
    pending.set(i, { resolve, reject })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  return { send, close: () => ws.close() }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hashmark-shots-'))
  let proc: ChildProcess | undefined
  let editor: ChildProcess | undefined
  let server: http.Server | undefined
  try {
    const site = path.join(tmp, 'site')
    console.log('Dokumentation bauen …')
    execFileSync(process.execPath, [path.join(root, 'scripts/build-docs.ts'), '--out', site], { stdio: 'inherit', cwd: root })
    server = await serve(site)
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`

    const profile = path.join(tmp, 'profile')
    proc = spawn(findBrowser(process.env.HASHMARK_BROWSER), [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
      `--user-data-dir=${profile}`, '--remote-debugging-port=0',
      ...(process.env.HASHMARK_NO_SANDBOX ? ['--no-sandbox'] : []), 'about:blank',
    ], { stdio: 'ignore' })
    let port = 0
    for (let i = 0; i < 200 && !port; i++) {
      try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) } catch { await sleep(150) }
    }
    if (!port) throw new Error('Browser startet nicht')

    /** neuer Tab in der gewünschten Größe, wartet auf `ready` (JS-Ausdruck); null, wenn die Seite nicht fertig wird */
    const open = async (url: string, w = 1280, h = 720, ready = 'true') => {
      const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
      const cdp = await connect(t.webSocketDebuggerUrl)
      await cdp.send('Page.enable')
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
      let ok = false
      for (let i = 0; i < 100 && !ok; i++) {
        const r = await cdp.send('Runtime.evaluate', { expression: ready, returnByValue: true }).catch(() => null)
        if (r?.result?.value) ok = true
        else await sleep(200)
      }
      await sleep(1200)
      return { cdp, ok }
    }
    const shot = async (cdp: Awaited<ReturnType<typeof connect>>, name: string) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 })
      await fsp.mkdir(outDir, { recursive: true })
      await fsp.writeFile(path.join(outDir, name), Buffer.from(data, 'base64'))
      console.log(`  ${path.relative(root, path.join(outDir, name))}  ${(Buffer.byteLength(data, 'base64') / 1024).toFixed(0)} KB`)
    }
    const key = (k: string) => `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`
    const APP = 'document.querySelector("#app")?.children.length > 0'

    /** Editor: `hashmark edit` mit dem Beispiel-Deck auf einem eigenen Port */
    let editorBase = ''
    const startEditor = async () => {
      const editPort = 3000 + Math.floor(Math.random() * 900)
      editor = spawn(process.execPath, [path.join(root, 'src/cli/index.ts'), 'edit', path.join(root, 'examples/hashmark-demo'), '--port', String(editPort), '--no-open'], { cwd: root, stdio: 'ignore' })
      for (let i = 0; i < 150; i++) {
        try { if ((await fetch(`http://localhost:${editPort}/editor.html`)).ok) return `http://localhost:${editPort}` } catch {}
        await sleep(200)
      }
      throw new Error('Editor startet nicht')
    }

    const take = async (s: Shot) => {
      const w = s.width ?? 1280, h = s.height ?? 720
      if (s.kind === 'presenter') {
        // erst die Präsentation (Sender), dann die Presenter-View im selben Browser (BroadcastChannel)
        const pres = await open(`${base}/${s.url}`, 1280, 720, APP)
        const c = await open(`${base}/handbuch/?presenter`, w, h, APP)
        await sleep(2500)
        if (pres.ok && c.ok) await shot(c.cdp, s.name)
        c.cdp.close(); pres.cdp.close()
        return pres.ok && c.ok
      }
      if (s.kind === 'editor') {
        editorBase ||= await startEditor()
        // Aufwärmen: Vite optimiert beim ersten Aufruf die Abhängigkeiten und lädt die Seite neu
        const warm = await open(`${editorBase}/${s.url}`, w, h, 'document.querySelector(".cm-editor")')
        warm.cdp.close()
        await sleep(3000)
        const c = await open(`${editorBase}/${s.url}`, w, h, 'document.querySelector(".cm-editor") && document.querySelector("iframe")')
        await sleep(3000)
        if (c.ok) await shot(c.cdp, s.name)
        c.cdp.close()
        return c.ok
      }
      const c = await open(`${base}/${s.url}`, w, h, s.kind === 'overview' ? APP : s.ready ?? APP)
      if (c.ok && s.kind === 'overview') {
        await c.cdp.send('Runtime.evaluate', { expression: key('o') })
        await sleep(1500)
      }
      if (c.ok) await shot(c.cdp, s.name)
      c.cdp.close()
      return c.ok
    }

    console.log('Aufnahmen …')
    const skipped: string[] = []
    for (const s of wanted) {
      const ok = await take(s).catch((e) => { console.warn(`  ${s.name}: ${(e as Error).message}`); return false })
      if (!ok) skipped.push(s.name)
    }
    if (skipped.length) console.warn(`Übersprungen (die Seite zeigt dort die Folie): ${skipped.join(', ')}`)
  } finally {
    proc?.kill()
    editor?.kill()
    server?.close()
    await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {})
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
