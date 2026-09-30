// End-to-End-Test der Desktop-App (Tauri) – headless: alle Fenster bleiben unsichtbar (STRATA_HEADLESS=1).
// Gesteuert über das Remote-Debugging von WebView2 (CDP), wie die Browser-Tests über Edge headless.
//
//   make app-test                       gepacktes Programm (dist-app/Strata) bzw. Release-Build
//   node scripts/app-e2e.ts [exe]       beliebige EXE; VISIBLE=1 zeigt die Fenster
//
// Prüft Startseite, Deck öffnen, Editor + Vorschau, Rechte der Seiten, Präsentation, Presenter, Tasten, Ctrl+W
// und misst die Zeiten. Ergebnis zusätzlich in export/app-e2e/result.json.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const candidates = [path.join(root, 'dist-app/Strata/Strata.exe'), path.join(root, 'src-tauri/target/release/strata.exe'), path.join(root, 'src-tauri/target/debug/strata.exe')]
const exe = process.argv[2] ?? candidates.find((p) => fs.existsSync(p))
if (!exe || !fs.existsSync(exe)) {
  console.error('Keine Strata.exe gefunden – zuerst "make app-build" oder "make app-package".')
  process.exit(1)
}
const out = path.join(root, 'export/app-e2e')
fs.mkdirSync(out, { recursive: true })

const freePort = () => new Promise<number>((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)) })
})
const port = await freePort()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const t0 = Date.now()
const secs = (from = t0) => `${((Date.now() - from) / 1000).toFixed(1)} s`

const checks: { name: string; ok: boolean; detail?: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' – ' + detail : ''}`)
}
const timings: Record<string, string> = {}

const env = { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`, STRATA_HEADLESS: process.env.VISIBLE ? '' : '1' }
delete env.ELECTRON_RUN_AS_NODE
const app = spawn(exe, [], { env, stdio: 'ignore' })

interface Target { type: string; url: string; webSocketDebuggerUrl: string }
const targets = async (): Promise<Target[]> => { try { return await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch { return [] } }
async function waitTarget(match: (url: string) => boolean, ms = 60_000): Promise<Target | null> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const t = (await targets()).find((x) => x.type === 'page' && match(x.url))
    if (t) return t
    await sleep(100)
  }
  return null
}

async function connect(t: Target) {
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let id = 0
  const pending = new Map<number, (m: any) => void>()
  const errors: string[] = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data))
    if (msg.id) pending.get(msg.id)?.(msg)
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  }
  const send = (method: string, params: object = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Runtime.enable')
  return {
    errors,
    eval: async (expression: string) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value,
    key: async (key: string, modifiers = 0) => {
      const code = ({ ArrowRight: 39, ArrowLeft: 37 } as Record<string, number>)[key] ?? key.toUpperCase().charCodeAt(0)
      const text = key.length === 1 && !modifiers ? key : undefined
      await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, windowsVirtualKeyCode: code, modifiers, text })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code, modifiers })
    },
    close: () => ws.close(),
  }
}
type Page = Awaited<ReturnType<typeof connect>>

async function until(fn: () => Promise<unknown>, ms = 30_000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) { try { if (await fn()) return true } catch { /* Seite lädt noch */ } await sleep(100) }
  return false
}

const pages: Page[] = []
try {
  const startT = await waitTarget((u) => u.includes('tauri.localhost'))
  check('Startseite', !!startT)
  timings['Programmstart → Startseite'] = secs()
  const start = await connect(startT!)
  check('Tauri-Befehle auf der Startseite', await until(() => start.eval(`!!window.__TAURI__?.core?.invoke`), 10_000))
  check('Liste „zuletzt geöffnet“', await until(() => start.eval(`document.querySelectorAll('#recent li').length > 0 || !document.getElementById('empty').hidden`), 15_000))
  check('Beispiele auf der Startseite (strata-demo, theme-demo)', await until(() => start.eval(`['strata-demo', 'theme-demo'].every((n) => [...document.querySelectorAll('#examples .deck strong')].some((s) => s.textContent === n))`), 15_000))
  // realistisch: kurz auf der Startseite, dann das Beispiel-Deck öffnen
  await sleep(1500)
  const click = Date.now()
  await start.eval(`[...document.querySelectorAll('#examples .deck')].find((b) => b.querySelector('strong').textContent === 'strata-demo').click()`)
  start.close()

  const edT = await waitTarget((u) => u.includes('127.0.0.1') && u.includes('editor.html'))
  check('Editor im Hauptfenster', !!edT, edT?.url)
  const ed = await connect(edT!)
  pages.push(ed)
  check('Editor und Vorschau fertig', await until(() => ed.eval(`!!document.querySelector('.cm-editor') && !!document.querySelector('iframe')?.contentDocument?.querySelector('.stage .slide-title')`), 60_000))
  timings['Klick auf Deck → Editor + Vorschau'] = secs(click)
  const denied = await ed.eval(`(window.__TAURI_INTERNALS__ ? window.__TAURI_INTERNALS__.invoke('recent').then(() => 'ERLAUBT', (e) => String(e)) : Promise.resolve('keine IPC'))`)
  check('Seiten vom lokalen Server dürfen keine App-Befehle', denied !== 'ERLAUBT', denied)
  check('vorgebaute Runtime (Live-Server)', (await ed.eval('window.__STRATA_LIVE__ === true && window.__STRATA_DESKTOP__ === true')) === true)

  const present = Date.now()
  await ed.eval(`document.querySelector('.ed-present').click()`)
  const prT = await waitTarget((u) => u.includes('127.0.0.1') && !u.includes('editor.html') && !u.includes('presenter'), 30_000)
  check('Präsentationsfenster', !!prT, prT?.url)
  const pr = await connect(prT!)
  pages.push(pr)
  check('Präsentation zeigt Folie', await until(() => pr.eval(`!!document.querySelector('.stage .slide-title')`)))
  timings['Präsentieren → Folie sichtbar'] = secs(present)

  // bei zwei Bildschirmen öffnet die App die Presenter-View selbst, sonst die Taste S
  let pvT = await waitTarget((u) => u.includes('presenter'), 4_000)
  if (!pvT) {
    await pr.key('s')
    pvT = await waitTarget((u) => u.includes('presenter'), 15_000)
  }
  check('Presenter-View geöffnet', !!pvT, pvT?.url)
  const pv = await connect(pvT!)
  pages.push(pv)
  check('Presenter-View verbunden', await until(() => pv.eval(`!!document.querySelector('.pv-conn.ok')`), 20_000))
  const h0 = await pr.eval('location.hash')
  await pv.key('ArrowRight')
  const moved = await until(async () => (await pr.eval('location.hash')) !== h0, 5_000)
  check('Taste im Presenter steuert die Präsentation', moved, `${h0} → ${await pr.eval('location.hash')}`)

  await pr.key('w', 2) // Ctrl+W
  check('Ctrl+W schließt Präsentation und Presenter', await until(async () => !(await targets()).some((t) => t.url.includes('127.0.0.1') && !t.url.includes('editor.html')), 10_000))
  const errors = pages.flatMap((p) => p.errors)
  check('keine JS-Fehler', !errors.length, errors.join(' | '))
} catch (e) {
  check('Ausnahme', false, String((e as Error).stack ?? e))
} finally {
  for (const p of pages) p.close()
  app.kill()
  // WebView2-Prozesse beenden sich kurz nach der App; der nächste Lauf soll nicht an sie andocken
  await sleep(2000)
  const failed = checks.filter((c) => !c.ok).length
  console.log('\nZeiten:')
  for (const [k, v] of Object.entries(timings)) console.log(`  ${k.padEnd(36)} ${v}`)
  console.log(`\n${checks.length - failed} / ${checks.length} OK  (${path.relative(root, exe)}, ${process.env.VISIBLE ? 'sichtbar' : 'headless'})`)
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ exe, checks, timings }, null, 2))
  process.exit(failed ? 1 : 0)
}
