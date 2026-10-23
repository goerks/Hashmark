// Prüft Video in der Präsentation mit Edge/Chrome headless: Standbild, Start mit →, K, Überspringen, Zurücksetzen mit ←,
// Ausschnitt mit Schleife, Abspielleiste und Teilabrufe. Baut das Beispiel-Deck (`examples/hashmark-demo`, Folie „Video“).
// Aufruf: node scripts/video-e2e.ts [Deck]   (Browser: HASHMARK_BROWSER; in der CI zusätzlich HASHMARK_NO_SANDBOX=1)

import path from 'node:path'
import { config } from '../src/cli/config.ts'
import { findBrowser, serveBuild, withPage, type Cdp } from '../src/cli/pdf.ts'

const deck = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../examples/hashmark-demo'))

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${name}${ok ? '' : detail ? ` (${detail})` : ''}`)
  if (!ok) failed++
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`[video-e2e] Browser: ${findBrowser()}`)
  const site = await serveBuild(config(deck))
  try {
    await withPage(`${site.url}#video`, undefined, (cdp) => run(cdp, site.url), {
      ready: `!!document.querySelector('.stage video.hm-video')`,
      notReady: 'Die Präsentation zeigt kein Video.',
    })
  } finally {
    await site.close()
  }
  if (failed) {
    console.error(`[video-e2e] ${failed} Prüfung(en) fehlgeschlagen`)
    process.exit(1)
  }
  console.log('[video-e2e] alles in Ordnung')
}

// ---------- Hilfen ----------

const evalJs = async <T>(cdp: Cdp, expression: string): Promise<T> => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'Fehler im Browser')
  return r.result.value as T
}

const KEYS: Record<string, { key: string; code: string; vk: number; text?: string }> = {
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  k: { key: 'k', code: 'KeyK', vk: 75, text: 'k' },
}
const press = async (cdp: Cdp, name: string) => {
  const k = KEYS[name]
  const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk }
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(k.text ? { text: k.text } : {}) })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
}

interface Probe { title: string; state: string | null; paused: boolean; time: number; duration: number; controls: boolean; play: string | null; ready: number; hash: string }
const probe = (cdp: Cdp) => evalJs<Probe>(cdp, `(() => {
  const slides = [...document.querySelectorAll('.stage .stage-slide')]
  const root = slides[slides.length - 1]
  const v = root?.querySelector('video.hm-video')
  return {
    title: root?.querySelector('.slide-title')?.textContent ?? '',
    state: v?.dataset.state ?? null, paused: v ? v.paused : true, time: v ? v.currentTime : 0, duration: v ? v.duration : 0,
    controls: v ? v.controls : false, play: v?.dataset.play ?? null, ready: v ? v.readyState : 0, hash: location.hash,
  }
})()`)

/** wartet, bis `ok` für den Zustand wahr wird (höchstens `ms`), und gibt den letzten Zustand zurück */
async function until(cdp: Cdp, ok: (p: Probe) => boolean, ms = 8000): Promise<Probe> {
  const end = Date.now() + ms
  let p = await probe(cdp)
  while (!ok(p) && Date.now() < end) {
    await sleep(150)
    p = await probe(cdp)
  }
  return p
}
const short = (p: Probe) => `Zustand ${p.state}, ${p.paused ? 'angehalten' : 'läuft'}, ${p.time.toFixed(2)} s, Folie „${p.title}“`

// ---------- Ablauf ----------

async function run(cdp: Cdp, baseUrl: string) {
  // 1 · Standbild
  let p = await until(cdp, (x) => x.ready >= 1 && x.duration > 0)
  check('Video lädt (Metadaten, Länge bekannt)', p.ready >= 1 && p.duration > 7, short(p))
  check('Folie „Video“ mit Standbild: angehalten, ein Schritt vorgesehen', p.title === 'Video' && p.paused && p.play === '1' && p.state === 'idle', short(p))

  // 2 · → startet das Video
  await press(cdp, 'ArrowRight')
  p = await until(cdp, (x) => x.state === 'playing' && !x.paused && x.time > 0.3)
  check('→ startet das Video (Schritt 1)', p.state === 'playing' && !p.paused && p.time > 0.3, short(p))

  // 3 · K hält an und setzt fort
  await press(cdp, 'k')
  p = await until(cdp, (x) => x.state === 'paused')
  check('K hält das Video an', p.state === 'paused' && p.paused, short(p))
  const frozen = p.time
  await sleep(600)
  p = await probe(cdp)
  check('angehaltenes Video steht still', Math.abs(p.time - frozen) < 0.05, `${frozen} → ${p.time}`)
  await press(cdp, 'k')
  p = await until(cdp, (x) => x.state === 'playing' && x.time > frozen + 0.3)
  check('K setzt das Video fort', p.state === 'playing' && p.time > frozen, short(p))

  // 4 · ← setzt auf das Standbild zurück
  await press(cdp, 'ArrowLeft')
  p = await until(cdp, (x) => x.state === 'idle')
  check('← geht zurück auf Schritt 0: Standbild am Anfang', p.state === 'idle' && p.paused && p.time < 0.5 && p.title === 'Video', short(p))

  // 5 · → startet erneut, nächstes → springt ans Ende, die Folie bleibt
  await press(cdp, 'ArrowRight')
  p = await until(cdp, (x) => x.state === 'playing' && x.time > 0.3)
  await press(cdp, 'ArrowRight')
  p = await until(cdp, (x) => x.state === 'ended')
  check('→ bei laufendem Video springt ans Ende, die Folie bleibt', p.state === 'ended' && p.paused && p.time > 7 && p.title === 'Video', short(p))

  // 6 · nächstes → geht zur nächsten Folie (Ausschnitt in Schleife)
  await press(cdp, 'ArrowRight')
  p = await until(cdp, (x) => x.title === 'Ausschnitt und Schleife')
  check('danach geht → zur nächsten Folie', p.title === 'Ausschnitt und Schleife', short(p))
  check('nächste Folie: Standbild am Beginn des Ausschnitts (1,4 s)', p.paused && p.play === '1', short(p))

  // 7 · Ausschnitt 1,4 bis 5 s mit Schleife, stumm
  await press(cdp, 'ArrowRight')
  p = await until(cdp, (x) => x.state === 'playing' && x.time >= 1.4)
  check('Ausschnitt beginnt bei 1,4 s', p.state === 'playing' && p.time >= 1.35, short(p))
  let inside = true
  let looped = false
  let last = p.time
  const stop = Date.now() + 6500
  while (Date.now() < stop) {
    await sleep(200)
    p = await probe(cdp)
    if (p.time > 5.2 || p.time < 1.3) inside = false
    if (p.time < last - 1) looped = true
    last = p.time
  }
  check('Ausschnitt bleibt zwischen 1,4 und 5 s', inside, short(p))
  check('Schleife: das Video beginnt am Ende des Ausschnitts von vorn', looped && p.state === 'playing', short(p))

  // 8 · Abspielleiste: kein Schritt
  await press(cdp, 'ArrowRight') // Ausschnitt läuft: springt ans Ende (Schleife zählt nicht als Ende)
  await sleep(300)
  p = await probe(cdp)
  if (p.title === 'Ausschnitt und Schleife') {
    await press(cdp, 'ArrowRight')
    p = await until(cdp, (x) => x.title === 'Mit Abspielleiste')
  }
  check('Folie mit Abspielleiste: Leiste sichtbar, kein Schritt, angehalten', p.title === 'Mit Abspielleiste' && p.controls && p.play === null && p.paused, short(p))

  // 9 · Teilabrufe
  const range = await evalJs<{ status: number; range: string | null; length: number }>(cdp, `fetch('${baseUrl}deck-assets/medien/demo.webm', { headers: { Range: 'bytes=0-9' } }).then(async (r) => ({ status: r.status, range: r.headers.get('content-range'), length: (await r.arrayBuffer()).byteLength }))`)
  check('Server liefert Teilabrufe (206, 10 Bytes)', range.status === 206 && range.length === 10 && /^bytes 0-9\//.test(range.range ?? ''), JSON.stringify(range))

  check('keine Fehler im Browser', cdp.errors.length === 0, cdp.errors.join(' | '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
