// Rundgang durch den Editor als Bilderfolge: node scripts/editor-tour.ts --out <ordner>
//
// Startet `hashmark edit` mit einer Kopie von abnahme/, steuert den echten Editor mit Edge/Chrome headless (CDP) und
// fotografiert nach jedem Schritt. Dieser Rundgang zeigt die Komponenten im Editor (Ticket #17): Dateiliste, Vorlage,
// Vorschläge, Fehler, Gestaltung, neue Komponente, Beispiel. Die Pipeline (ci.yml, Job editor-tour) legt die Bilder
// auf dem Zweig ci-galerie ab. Ein Schritt, der nicht gelingt, wird übersprungen; index.json nennt die gelungenen.

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findBrowser } from '../src/cli/pdf.ts'

const root = path.resolve(import.meta.dirname, '..')
const outArg = process.argv.indexOf('--out')
const outDir = path.resolve(root, outArg > 0 ? process.argv[outArg + 1] : 'export/editor-tour')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

const steps: { name: string; caption: string }[] = []

async function main() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hashmark-tour-'))
  let proc: ChildProcess | undefined
  let editor: ChildProcess | undefined
  try {
    // Kopie des Abnahme-Decks: der Rundgang schreibt hinein (Speichern, neue Komponente)
    const deck = path.join(tmp, 'deck')
    await fsp.cp(path.join(root, 'abnahme'), deck, { recursive: true })

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

    const open = async (url: string, ready: string) => {
      const t = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
      const cdp = await connect(t.webSocketDebuggerUrl)
      await cdp.send('Page.enable')
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false })
      await waitFor(cdp, ready, 20000)
      return cdp
    }
    const run = async (cdp: Cdp, expression: string) => {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result?.value
    }
    async function waitFor(cdp: Cdp, expression: string, ms = 10000) {
      for (let t = 0; t < ms; t += 200) {
        const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true }).catch(() => null)
        if (r?.result?.value) return
        await sleep(200)
      }
      throw new Error(`Zeitüberschreitung: ${expression}`)
    }
    const shot = async (cdp: Cdp, name: string, caption: string) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 })
      await fsp.mkdir(outDir, { recursive: true })
      await fsp.writeFile(path.join(outDir, name), Buffer.from(data, 'base64'))
      steps.push({ name, caption })
      console.log(`  ${name}  ${(Buffer.byteLength(data, 'base64') / 1024).toFixed(0)} KB`)
    }
    const EDITOR = 'window.__hashmarkEditor'
    const fileButton = (p: string) => `[...document.querySelectorAll('.ed-files button')].find((b) => b.textContent.trim() === ${JSON.stringify(p)})`
    const openFile = async (cdp: Cdp, p: string) => {
      await waitFor(cdp, fileButton(p))
      await run(cdp, `${fileButton(p)}.click()`)
      await sleep(600)
    }
    const text = (cdp: Cdp) => run(cdp, `${EDITOR}.text()`) as Promise<string>

    // Aufwärmen: Vite optimiert beim ersten Aufruf die Abhängigkeiten und lädt die Seite neu
    const warm = await open(`${base}/editor.html`, 'document.querySelector(".cm-editor")')
    warm.close()
    await sleep(4000)
    const cdp = await open(`${base}/editor.html`, 'document.querySelector(".cm-editor") && document.querySelector("iframe") && document.querySelector(".ed-files button")')
    await sleep(3000)

    const step = async (label: string, fn: () => Promise<void>) => {
      try { await fn() } catch (e) { console.warn(`  ${label}: ${(e as Error).message}`) }
    }

    await step('01 Dateiliste', async () => {
      await shot(cdp, '01-dateiliste.jpg', 'Der Editor: links die Dateien und der neue Bereich „Komponenten“, in der Mitte der Text, rechts die Vorschau.')
    })

    await step('02 Vorlage', async () => {
      await openFile(cdp, 'components/fact.html')
      await waitFor(cdp, `${EDITOR}.text().includes('{{!meta')`)
      await sleep(800)
      await shot(cdp, '02-vorlage.jpg', 'Die Vorlage der Komponente „fact“ ist geöffnet: HTML mit farbig hinterlegten Platzhaltern und dem Kopf mit der Beschreibung.')
    })

    await step('03 Vorschläge', async () => {
      const before = (await text(cdp)).length
      await run(cdp, `${EDITOR}.view.dispatch({ selection: { anchor: ${EDITOR}.view.state.doc.length } }); ${EDITOR}.typeText('\\n{{')`)
      await waitFor(cdp, 'document.querySelector(".cm-tooltip-autocomplete")', 6000)
      await sleep(500)
      await shot(cdp, '03-vorschlaege.jpg', 'Nach zwei geschweiften Klammern schlägt der Editor Platzhalter vor: Attribute aus dem Kopf, Inhalt, Kinder und die Blöcke.')
      await run(cdp, `${EDITOR}.view.dispatch({ changes: { from: ${before}, to: ${EDITOR}.view.state.doc.length, insert: '' } })`)
    })

    await step('04 Fehler', async () => {
      const before = (await text(cdp)).length
      await run(cdp, `${EDITOR}.view.dispatch({ changes: { from: ${EDITOR}.view.state.doc.length, insert: '\\n{{#each items}}' } })`)
      await waitFor(cdp, 'document.querySelector(".ed-count.has")', 8000)
      // das Hinweisfeld öffnen; bleibt es zu, ein zweites Mal klicken und den Zustand ins Protokoll schreiben
      for (let i = 0; i < 3; i++) {
        await run(cdp, 'document.querySelector(".ed-count.has")?.click()')
        await sleep(800)
        const open = await run(cdp, 'document.querySelector(".ed-problems") !== null')
        console.log(`  Hinweisfeld nach Klick ${i + 1}: ${open ? 'offen' : 'zu'}`)
        if (open) break
      }
      await shot(cdp, '04-fehler.jpg', 'Ein nicht geschlossener Block: unten steht der Hinweis mit Zeilennummer, im Text ist die Stelle rot markiert.')
      await run(cdp, `${EDITOR}.view.dispatch({ changes: { from: ${before}, to: ${EDITOR}.view.state.doc.length, insert: '' } })`)
      await sleep(900)
    })

    await step('05 Gestaltung', async () => {
      await openFile(cdp, 'components/fact.css')
      await waitFor(cdp, `${EDITOR}.text().includes('6px')`)
      const css = (await text(cdp)).replace('6px', '14px')
      await run(cdp, `${EDITOR}.view.dispatch({ changes: { from: 0, to: ${EDITOR}.view.state.doc.length, insert: ${JSON.stringify(css)} } })`)
      await sleep(1500)
      await shot(cdp, '05-gestaltung.jpg', 'Die Gestaltung (fact.css): der Rand ist von 6 auf 14 Pixel geändert und wird automatisch gespeichert.')
      // die Folie mit dem Rahmen in der Vorschau zeigen
      await openFile(cdp, '01-abnahme.md')
      await waitFor(cdp, `${EDITOR}.text().includes('## Komponenten in der Dateiliste')`)
      const line = (await text(cdp)).split('\n').findIndex((l) => l.startsWith('## Komponenten in der Dateiliste')) + 1
      await run(cdp, `${EDITOR}.gotoLine(${line})`)
      await sleep(3500)
      await shot(cdp, '06-vorschau.jpg', 'Zurück in den Folien: rechts zeigt die Vorschau den Rahmen jetzt mit dickerem Rand, ohne dass etwas neu geladen werden musste.')
    })

    await step('07 Dialog', async () => {
      await run(cdp, 'document.querySelector(".ed-side-head.sub button").click()')
      await waitFor(cdp, 'document.querySelector(".po .nc-field input")', 5000)
      await sleep(300)
      await cdp.send('Input.insertText', { text: 'merksatz' })
      await run(cdp, 'document.querySelectorAll(".po .nc-field input")[1].focus()')
      await cdp.send('Input.insertText', { text: 'Hervorgehobener Satz mit Überschrift' })
      await sleep(500)
      await shot(cdp, '07-dialog.jpg', 'Neue Komponente: Name, Beschreibung, Attribute und Aufbau eintragen. Der Dialog meldet ungültige oder vergebene Namen sofort.')
    })

    await step('08 Neue Komponente', async () => {
      await run(cdp, 'document.querySelector(".po button[type=submit]").click()')
      await waitFor(cdp, `${fileButton('components/merksatz.html')} && ${EDITOR}.text().includes('merksatz')`, 8000)
      await sleep(1000)
      await shot(cdp, '08-neu.jpg', 'Angelegt: Vorlage und Gestaltung stehen in der Liste, die neue Vorlage ist geöffnet, mit Kopf und Beispiel.')
    })

    await step('09 Beispiel', async () => {
      await waitFor(cdp, 'document.querySelector(".ed-example")', 4000)
      await run(cdp, 'document.querySelector(".ed-example").click()')
      // die Vorschau lädt das Deck mit der neuen Komponente neu
      await waitFor(cdp, `document.querySelector('iframe')?.contentDocument?.body?.innerHTML.includes('merksatz-title')`, 15000).catch(() => {})
      await sleep(2500)
      await shot(cdp, '09-beispiel.jpg', 'Mit „Beispiel in Folie ansehen“ landet das Beispiel aus dem Kopf als Folie am Ende, die Vorschau zeigt die neue Komponente.')
    })

    cdp.close()
    await fsp.mkdir(outDir, { recursive: true })
    await fsp.writeFile(path.join(outDir, 'index.json'), JSON.stringify(steps, null, 2))
    if (!steps.length) throw new Error('Kein Bild aufgenommen')
  } finally {
    proc?.kill()
    editor?.kill()
    await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {})
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
