// Bilder für README und Startseite erzeugen: node scripts/make-screenshots.ts [--out assets/screenshots]
//
// Baut die Dokumentation in einen temporären Ordner, liefert sie lokal aus und fotografiert mit Edge/Chrome headless (CDP):
//   lesemodus.jpg   das Handbuch im Lesemodus
//   baum.jpg        Folie „Der Baum“ (Mermaid-Diagramm)
//   karten.jpg      Folie mit Karten
//   presenter.jpg   Presenter-View, gekoppelt an die Präsentation
// Die Bilder sind klein (JPEG) und gehören ins Repo, damit README und Seiten nicht von einem Build abhängen.

import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { findBrowser } from '../src/cli/pdf.ts'

const root = path.resolve(import.meta.dirname, '..')
const outArg = process.argv.indexOf('--out')
const outDir = path.resolve(root, outArg > 0 ? process.argv[outArg + 1] : 'assets/screenshots')

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
      `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
    ], { stdio: 'ignore' })
    let port = 0
    for (let i = 0; i < 200 && !port; i++) {
      try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) } catch { await sleep(150) }
    }
    if (!port) throw new Error('Browser startet nicht')

    /** neuer Tab in der gewünschten Größe, wartet auf `ready` (JS-Ausdruck) */
    const open = async (url: string, w: number, h: number, ready = 'true') => {
      const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
      const cdp = await connect(t.webSocketDebuggerUrl)
      await cdp.send('Page.enable')
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
      for (let i = 0; i < 100; i++) {
        const r = await cdp.send('Runtime.evaluate', { expression: ready, returnByValue: true })
        if (r.result?.value) break
        await sleep(200)
      }
      await sleep(1200)
      return cdp
    }
    const shot = async (cdp: Awaited<ReturnType<typeof open>>, name: string) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 })
      await fsp.mkdir(outDir, { recursive: true })
      await fsp.writeFile(path.join(outDir, name), Buffer.from(data, 'base64'))
      console.log(`  ${path.relative(root, path.join(outDir, name))}  ${(Buffer.byteLength(data, 'base64') / 1024).toFixed(0)} KB`)
    }
    console.log('Aufnahmen …')
    let c = await open(`${base}/handbuch/?reader`, 1440, 900, 'document.querySelectorAll("section, article").length > 3')
    await shot(c, 'lesemodus.jpg'); c.close()

    c = await open(`${base}/handbuch/?card#baum`, 1280, 720, 'document.querySelector(".mermaid svg, .mermaid-state svg")')
    await shot(c, 'baum.jpg'); c.close()

    c = await open(`${base}/handbuch/?card&step=9#gestaltung`, 1280, 720)
    await shot(c, 'karten.jpg'); c.close()

    // Presenter: erst die Präsentation (Sender), dann die Presenter-View im selben Browser (BroadcastChannel)
    const pres = await open(`${base}/handbuch/#baum`, 1280, 720)
    c = await open(`${base}/handbuch/?presenter`, 1440, 900)
    await sleep(2500)
    await shot(c, 'presenter.jpg'); c.close(); pres.close()
  } finally {
    proc?.kill()
    server?.close()
    await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {})
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
