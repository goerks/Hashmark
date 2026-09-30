// Selbsttest des Desktop-Sidecars über stdin/stdout, genau wie die Tauri-App ihn anspricht.
// Aufruf: node scripts/sidecar-smoke.ts [deck] [ausgabeordner]   (make sidecar-smoke)
// SIDECAR_BUNDLE=1 testet das gebündelte Programm (src/desktop/sidecar.bundle.mjs) statt der Quellen.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

const root = path.resolve(import.meta.dirname, '..')
const deck = path.resolve(process.argv[2] ?? path.join(root, 'examples/strata-demo'))
const out = path.resolve(process.argv[3] ?? path.join(root, 'export/sidecar-smoke'))
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-sidecar-'))
fs.mkdirSync(out, { recursive: true })

const entry = process.env.SIDECAR_BUNDLE ? 'sidecar.bundle.mjs' : 'sidecar.ts'
const child = spawn(process.execPath, [path.join(root, 'src/desktop', entry), `--data=${data}`], { stdio: ['pipe', 'pipe', 'pipe'] })
let stderr = ''
child.stderr.on('data', (d) => (stderr += d))

const pending = new Map<number, (msg: any) => void>()
const events: any[] = []
let ready: () => void
const readyP = new Promise<void>((r) => (ready = r))
readline.createInterface({ input: child.stdout }).on('line', (line) => {
  if (!line.startsWith('@@strata ')) return
  const msg = JSON.parse(line.slice(9))
  if (msg.event === 'ready') ready()
  else if (msg.event) events.push(msg)
  else pending.get(msg.id)?.(msg)
})

let nextId = 1
function call(cmd: string, args: Record<string, unknown> = {}): Promise<any> {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n')
  })
}

const checks: { name: string; ok: boolean; detail?: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' – ' + detail : ''}`)
}

try {
  await Promise.race([readyP, new Promise((_, j) => setTimeout(() => j(new Error('Sidecar startet nicht')), 30_000))])
  const ping = await call('ping')
  check('Sidecar antwortet', ping.ok, `Node ${ping.result?.node}`)
  check('isDeck', (await call('isDeck', { dir: deck })).result === true && (await call('isDeck', { dir: data })).result === false)
  const bad = await call('open', { dir: data })
  check('Kein Deck wird abgelehnt', !bad.ok, bad.error)
  const open = await call('open', { dir: deck })
  check('Deck geöffnet', open.ok && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(open.result?.url), open.result?.url ?? open.error)
  const url = open.result.url as string
  const html = await (await fetch(url)).text()
  check('Seiten tragen die Desktop-Markierung', html.includes('window.__STRATA_DESKTOP__ = true'))
  const editor = await fetch(url + 'editor.html')
  check('Editor wird ausgeliefert', editor.ok)
  const files = await fetch(url + '__strata/files', { headers: { 'X-Strata-Editor': '1' } })
  check('Datei-API aktiv', files.ok)

  // Aktion aus einer Seite → Ereignis an die App; Position wird im Sidecar gemerkt
  const post = (body: object, headers: Record<string, string> = { 'X-Strata-Editor': '1' }) =>
    fetch(url + '__strata/app', { method: 'POST', headers, body: JSON.stringify(body) })
  check('App-Aktion ohne Header abgelehnt', (await post({ action: 'present', hash: '' }, {})).status === 403)
  check('Unbekannte Aktion abgelehnt', (await post({ action: 'rm -rf' })).status === 400)
  await post({ action: 'position', hash: '#architektur' })
  check('Position gemerkt', (await call('position')).result === '#architektur')
  await post({ action: 'present', hash: '#fazit' })
  await new Promise((r) => setTimeout(r, 200))
  check('Aktion kommt als Ereignis an', events.some((e) => e.action === 'present' && e.hash === '#fazit'), JSON.stringify(events))

  const recent = await call('recent')
  check('Zuletzt geöffnet', recent.result?.[0]?.dir?.toLowerCase() === deck.toLowerCase())

  const t0 = Date.now()
  const pdf = await call('pdf', { query: '?print', out: path.join(out, 'deck.pdf') })
  check('PDF vom laufenden Server', pdf.ok && pdf.result.pages > 1, pdf.ok ? `${pdf.result.pages} Seiten, ${((Date.now() - t0) / 1000).toFixed(0)} s` : pdf.error)
  const handout = await call('pdf', { query: '?print&notes=1', out: path.join(out, 'handout.pdf') })
  check('Handout', handout.ok && handout.result.pages > 1, handout.ok ? `${handout.result.pages} Seiten` : handout.error)
  const exp = await call('html', { out: path.join(out, 'deck.html') })
  check('HTML-Export', exp.ok && fs.statSync(path.join(out, 'deck.html')).size > 1_000_000, exp.error ?? '')

  const unknown = await call('gibtsnicht')
  check('Unbekannter Befehl liefert Fehler', !unknown.ok)
} catch (e) {
  check('Ausnahme', false, String((e as Error).stack ?? e))
} finally {
  child.stdin.end()
  await new Promise((r) => { child.once('exit', r); setTimeout(r, 5000) })
  child.kill()
  fs.rmSync(data, { recursive: true, force: true })
  fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify(checks, null, 2))
  const failed = checks.filter((c) => !c.ok).length
  console.log(`\n${checks.length - failed} / ${checks.length} OK`)
  if (failed && stderr) console.log(`\nstderr des Sidecars:\n${stderr.slice(-3000)}`)
  process.exit(failed ? 1 : 0)
}
