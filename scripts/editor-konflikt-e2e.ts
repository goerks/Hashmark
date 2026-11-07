// Prüft den Speicherkonflikt im echten Editor (Ticket #52) mit Edge/Chrome headless: Ändert jemand die Datei, während du tippst,
// wird nichts überschrieben, sondern der Konflikt gezeigt. „Meine Fassung behalten“ und „Datei neu laden“ lösen ihn auf.
// Aufruf: node scripts/editor-konflikt-e2e.ts (Browser: HASHMARK_BROWSER; in der CI HASHMARK_NO_SANDBOX=1)

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findBrowser } from '../src/cli/pdf.ts'

const root = path.resolve(import.meta.dirname, '..')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${name}${ok ? '' : detail ? ` (${detail})` : ''}`)
  if (!ok) failed++
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
type Cdp = Awaited<ReturnType<typeof connect>>

const run = async (cdp: Cdp, expression: string) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
async function waitFor(cdp: Cdp, expression: string, ms = 10000) {
  for (let t = 0; t < ms; t += 150) {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true }).catch(() => null)
    if (r?.result?.value) return true
    await sleep(150)
  }
  return false
}

const EDITOR = 'window.__hashmarkEditor'
const STATUS = `document.querySelector('.ed-status')?.dataset.status`
const button = (label: string) => `[...document.querySelectorAll('.ed-conflict-actions button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)}))`

async function main() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hashmark-konflikt-e2e-'))
  let editor: ChildProcess | undefined
  let proc: ChildProcess | undefined
  try {
    const deck = path.join(tmp, 'deck')
    await fsp.mkdir(deck)
    const file = path.join(deck, 'a.md')
    await fsp.writeFile(path.join(deck, 'deck.yaml'), 'title: Konflikt\n')
    await fsp.writeFile(file, '# A\n\nEins\n')
    const disk = () => fsp.readFile(file, 'utf8')

    const editPort = 3000 + Math.floor(Math.random() * 900)
    editor = spawn(process.execPath, [path.join(root, 'src/cli/index.ts'), 'edit', deck, '--port', String(editPort), '--no-open'], { cwd: root, stdio: 'ignore' })
    const base = `http://localhost:${editPort}`
    let up = false
    for (let i = 0; i < 150 && !up; i++) {
      try { up = (await fetch(`${base}/editor.html`)).ok } catch { await sleep(200) }
    }
    if (!up) throw new Error('Editor startet nicht')

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

    const open = async (url: string) => {
      const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
      const cdp = await connect(t.webSocketDebuggerUrl)
      await cdp.send('Page.enable')
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false })
      return cdp
    }
    // Aufwärmen: Vite optimiert beim ersten Aufruf die Abhängigkeiten und lädt die Seite neu
    const warm = await open(`${base}/editor.html`)
    await waitFor(warm, 'document.querySelector(".cm-editor")', 20000)
    warm.close()
    await sleep(4000)
    const cdp = await open(`${base}/editor.html`)
    const ready = await waitFor(cdp, `${EDITOR} && ${EDITOR}.text().includes('Eins') && ${STATUS} === 'saved'`, 25000)
    check('der Editor ist geöffnet und die Datei geladen', ready)
    if (!ready) throw new Error('Editor nicht bereit')

    // Eine Änderung von außen, während im Editor getippt wird (der Autosave wartet 400 ms): Konflikt statt Überschreiben
    const conflictRound = async (mine: string, theirs: string) => {
      await run(cdp, `${EDITOR}.view.dispatch({ selection: { anchor: ${EDITOR}.view.state.doc.length } }); ${EDITOR}.typeText(${JSON.stringify(`\n${mine}`)})`)
      await fsp.writeFile(file, theirs)
      return waitFor(cdp, `document.querySelector('.ed-conflict') !== null && ${STATUS} === 'conflict'`, 10000)
    }

    const first = await conflictRound('Mein Stand', '# A\n\nEins\n\nFremd\n')
    check('bei gleichzeitiger Änderung erscheint der Konflikt', first)
    check('die fremde Änderung ist nicht überschrieben', (await disk()).includes('Fremd') && !(await disk()).includes('Mein Stand'), await disk())
    check('der Konflikt nennt die Datei', await run(cdp, `document.querySelector('.ed-conflict strong')?.textContent.includes('a.md')`))
    check('die Statusanzeige sagt „Konflikt“', (await run(cdp, `document.querySelector('.ed-status')?.textContent.trim()`)) === 'Konflikt')

    await run(cdp, `${button('Unterschiede')}.click()`)
    const diff = await waitFor(cdp, `document.querySelector('.ed-diff pre')?.textContent.includes('Fremd') && document.querySelector('.ed-diff pre').textContent.includes('Mein Stand')`, 4000)
    check('„Unterschiede zeigen“ nennt beide Seiten', diff)

    await sleep(900) // der Autosave darf bei einem Konflikt nichts schreiben
    check('der Autosave schreibt bei offenem Konflikt nichts', !(await disk()).includes('Mein Stand'))

    await run(cdp, `${button('Meine Fassung')}.click()`)
    const kept = await waitFor(cdp, `${STATUS} === 'saved' && !document.querySelector('.ed-conflict')`, 8000)
    check('„Meine Fassung behalten“ speichert und schließt den Hinweis', kept)
    check('die Datei enthält jetzt meinen Stand', (await disk()).includes('Mein Stand'), await disk())

    const second = await conflictRound('Noch mehr', '# A\n\nAnderes Fremd\n')
    check('ein zweiter Konflikt wird wieder erkannt', second)
    await run(cdp, `${button('Datei neu laden')}.click()`)
    const reloaded = await waitFor(cdp, `${STATUS} === 'saved' && ${EDITOR}.text().includes('Anderes Fremd')`, 8000)
    check('„Datei neu laden“ übernimmt die Datei', reloaded)
    check('dabei bleibt die Datei, wie sie war', (await disk()) === '# A\n\nAnderes Fremd\n', await disk())

    // ohne gleichzeitige Änderung wird ganz normal gespeichert
    await run(cdp, `${EDITOR}.view.dispatch({ selection: { anchor: ${EDITOR}.view.state.doc.length } }); ${EDITOR}.typeText('\\nNormal')`)
    const normal = await waitFor(cdp, `${STATUS} === 'saved'`, 6000)
    await sleep(300)
    check('ohne Fremdänderung wird normal gespeichert', normal && (await disk()).includes('Normal'), await disk())
    cdp.close()
  } finally {
    proc?.kill()
    editor?.kill()
    await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {})
  }
}

main().then(() => {
  console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
  process.exit(failed ? 1 : 0)
}).catch((e) => { console.error(e); process.exit(1) })
