// Prüft den Bild-Zoom mit Edge/Chrome headless: Z fährt aufs Bild und zurück, Esc, Blättern, Klick, Presenter-Kopplung und „Animationen
// reduzieren“. Baut ein kleines Deck mit einem Bild. Aufruf: node scripts/zoom-e2e.ts (Browser: HASHMARK_BROWSER; in der CI HASHMARK_NO_SANDBOX=1)

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { config } from '../src/cli/config.ts'
import { findBrowser, serveBuild, withPage, type Cdp } from '../src/cli/pdf.ts'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${name}${ok ? '' : detail ? ` (${detail})` : ''}`)
  if (!ok) failed++
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240"><rect width="400" height="240" fill="#eef2f7"/><rect x="20" y="20" width="360" height="40" fill="#2563eb"/><text x="30" y="46" font-size="16" fill="#fff">Statusseite</text><rect x="20" y="90" width="360" height="30" fill="#fdeceb"/><text x="30" y="110" font-size="12" fill="#c62828">Fehler 502</text></svg>`

async function makeDeck() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-zoom-e2e-'))
  await fs.writeFile(path.join(dir, 'deck.yaml'), 'title: Zoom-Prüfung\n')
  await fs.writeFile(path.join(dir, 'status.svg'), SVG)
  await fs.writeFile(path.join(dir, 'a.md'), '# Zoom\n\nText über dem Bild.\n\n![Status](status.svg){zoom width=30%}\n\nText unter dem Bild.\n\n---\n\nZweite Folie ohne Bild.\n\n---\n\nDritte Folie.\n\n![Status](status.svg){zoomstep=1 zoomuntil=2 width=30%}\n\n---\n\nVierte Folie.\n\n```ts\nconst a = 1\nconst b = a + 1\n```\n')
  return dir
}

const evalJs = async <T>(cdp: Cdp, expression: string): Promise<T> => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'Fehler im Browser')
  return r.result.value as T
}

const KEYS: Record<string, { key: string; code: string; vk: number; text?: string }> = {
  z: { key: 'z', code: 'KeyZ', vk: 90, text: 'z' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  '+': { key: '+', code: 'Equal', vk: 187, text: '+' },
  '-': { key: '-', code: 'Minus', vk: 189, text: '-' },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
}
const press = async (cdp: Cdp, name: string) => {
  const k = KEYS[name]
  const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk }
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(k.text ? { text: k.text } : {}) })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
}

interface Probe {
  /** Skalierung der Kamera (1 = keine) */
  scale: number
  /** Breite des Bildes im Verhältnis zur Bühne */
  width: number
  /** Abstand der Bildmitte von der Bühnenmitte, im Verhältnis zur Bühne */
  dx: number
  dy: number
  zoomed: boolean
  noTransform: boolean
  slide: number
  /** Mitte des Bildes im Fenster (für Mausklicks) */
  cx: number
  cy: number
  title: string
}
const probe = (cdp: Cdp) => evalJs<Probe>(cdp, `(() => {
  const cams = [...document.querySelectorAll('.stage .stage-slide')]
  const cam = cams[cams.length - 1]
  const img = cam && cam.querySelector('img[data-zoom]')
  const sr = document.querySelector('.stage').getBoundingClientRect()
  const r = img ? img.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 }
  const t = cam ? getComputedStyle(cam).transform : 'none'
  const m = t === 'none' ? null : new DOMMatrixReadOnly(t)
  const slide = (m2 => m2 ? Number(m2[1]) - 1 : 0)(location.hash.match(/:([0-9]+)$/))
  return {
    scale: m ? m.a : 1, width: r.width / sr.width,
    dx: (r.left + r.width / 2 - (sr.left + sr.width / 2)) / sr.width, dy: (r.top + r.height / 2 - (sr.top + sr.height / 2)) / sr.height,
    zoomed: !!cam && cam.hasAttribute('data-zoomed'), noTransform: t === 'none', slide, cx: r.left + r.width / 2, cy: r.top + r.height / 2,
    title: cam ? (cam.querySelector('.slide-title') || {}).textContent || '' : ''
  }
})()`)

async function until(cdp: Cdp, ok: (p: Probe) => boolean, ms = 5000): Promise<Probe> {
  const end = Date.now() + ms
  let p = await probe(cdp)
  while (!ok(p) && Date.now() < end) {
    await sleep(120)
    p = await probe(cdp)
  }
  return p
}
const short = (p: Probe) => `Kamera ${p.scale.toFixed(2)}×, Bildbreite ${p.width.toFixed(2)}, Versatz ${p.dx.toFixed(3)}/${p.dy.toFixed(3)}, ${p.zoomed ? 'vergrößert' : 'normal'}, Folie ${p.slide + 1}`

const click = async (cdp: Cdp, x: number, y: number) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

async function run(cdp: Cdp) {
  // 1 · Ausgangszustand
  let p = await until(cdp, (x) => x.width > 0.1)
  const w0 = p.width
  check('Folie mit Bild: nicht vergrößert, Bild ist kleiner als die Bühne', p.noTransform && !p.zoomed && w0 > 0.1 && w0 < 0.5, short(p))

  // 2 · Z fährt aufs Bild
  await press(cdp, 'z')
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.5 && x.width > 0.6 && Math.abs(x.dx) < 0.02 && Math.abs(x.dy) < 0.02, 6000)
  check('Z: die Kamera fährt aufs Bild, es füllt die Bühne und liegt in der Mitte', p.zoomed && p.scale > 1.5 && p.width > 0.6 && Math.abs(p.dx) < 0.02 && Math.abs(p.dy) < 0.02, short(p))
  check('das Bild passt in die Bühne (nicht größer als sie)', p.width <= 0.96, short(p))

  // 3 · Z fährt zurück
  await press(cdp, 'z')
  p = await until(cdp, (x) => !x.zoomed && x.noTransform && Math.abs(x.width - w0) < 0.01, 6000)
  check('Z noch einmal: zurück in die Ausgangslage, Kamera ohne Transformation', !p.zoomed && p.noTransform && Math.abs(p.width - w0) < 0.01, short(p))

  // 4 · Esc fährt zurück, ohne die Folie zu verlassen
  await press(cdp, 'z')
  await until(cdp, (x) => x.zoomed && x.scale > 1.5, 6000)
  await press(cdp, 'Escape')
  p = await until(cdp, (x) => !x.zoomed && x.noTransform, 6000)
  check('Esc fährt zurück und bleibt auf der Folie', !p.zoomed && p.noTransform && p.slide === 0 && p.title === 'Zoom', short(p))

  // 5 · Weiterblättern setzt zurück
  await press(cdp, 'z')
  await until(cdp, (x) => x.zoomed && x.scale > 1.5, 6000)
  await press(cdp, 'ArrowRight')
  // der Übergang zur nächsten Folie läuft rund 0,4 s und setzt selbst eine Transformation: abwarten
  p = await until(cdp, (x) => x.slide === 1 && x.noTransform)
  check('→ im vergrößerten Zustand geht weiter, die Kamera steht normal', p.slide === 1 && !p.zoomed && p.noTransform, short(p))
  await press(cdp, 'z')
  await sleep(500)
  p = await probe(cdp)
  check('Z auf einer Folie ohne Bild tut nichts', !p.zoomed && p.noTransform, short(p))
  await press(cdp, 'ArrowLeft')
  p = await until(cdp, (x) => x.slide === 0 && x.width > 0.1 && x.noTransform, 6000)
  check('← zurück auf die Folie mit dem Bild', p.slide === 0 && p.noTransform, short(p))

  // 6 · Klick fährt hinein, Klick fährt zurück
  await sleep(600) // der Übergang zur Folie muss fertig sein
  p = await probe(cdp)
  await click(cdp, p.cx, p.cy)
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.5, 6000)
  check('Klick auf das Bild fährt hinein', p.zoomed && p.scale > 1.5, short(p))
  await click(cdp, 20, 20)
  p = await until(cdp, (x) => !x.zoomed && x.noTransform, 6000)
  check('Klick irgendwo fährt zurück', !p.zoomed && p.noTransform, short(p))

  // 7 · Presenter-Kopplung: Zustand lesen und Z über den Kanal senden
  const states = await evalJs<({ available: boolean; active: boolean } | null)[]>(cdp, `new Promise((resolve) => {
    const ch = new BroadcastChannel('hashmark-presenter:' + location.pathname)
    const seen = []
    ch.onmessage = (e) => { if (e.data && e.data.type === 'hashmark:presenter-state') seen.push(e.data.zoom || null) }
    ch.postMessage({ type: 'hashmark:presenter-hello' })
    setTimeout(() => ch.postMessage({ type: 'hashmark:presenter-key', key: 'z', shiftKey: false }), 400)
    setTimeout(() => ch.postMessage({ type: 'hashmark:presenter-key', key: 'z', shiftKey: false }), 2200)
    setTimeout(() => { ch.close(); resolve(seen) }, 3600)
  })`)
  const flags = states.map((s) => (s ? `${s.available ? 'v' : '-'}${s.active ? 'a' : '-'}` : 'null'))
  check('Presenter bekommt „vergrößerbar“, „vergrößert“ und „wieder normal“', flags.includes('v-') && flags.includes('va') && flags[flags.length - 1] === 'v-', JSON.stringify([...new Set(flags)]))

  // 7b · Zoom als Schritt: → allein fährt aufs Bild (zoomstep=1), Schritt 2 wieder heraus (zoomuntil=2), ← kehrt um
  await evalJs(cdp, `location.hash = '#zoom:3'`)
  p = await until(cdp, (x) => x.slide === 2 && x.width > 0.1 && x.noTransform)
  await sleep(500)
  p = await probe(cdp)
  check('Folie mit zoomstep: zu Beginn normal', p.slide === 2 && !p.zoomed && p.noTransform && p.width < 0.5, short(p))
  await press(cdp, 'ArrowRight')
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.5)
  check('→ (Schritt 1) fährt von selbst aufs Bild, die Folie bleibt', p.zoomed && p.scale > 1.5 && p.slide === 2, short(p))
  await sleep(1100)
  p = await probe(cdp)
  check('Schritt 1: das Bild füllt die Bühne in der Mitte', p.width > 0.6 && p.width <= 0.96 && Math.abs(p.dx) < 0.02 && Math.abs(p.dy) < 0.02, short(p))
  await press(cdp, 'ArrowRight')
  p = await until(cdp, (x) => !x.zoomed && x.noTransform)
  check('→ (Schritt 2, zoomuntil) fährt wieder heraus', !p.zoomed && p.noTransform && p.slide === 2, short(p))
  await press(cdp, 'ArrowLeft')
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.5)
  check('← (zurück auf Schritt 1) fährt wieder hinein', p.zoomed && p.slide === 2, short(p))
  await press(cdp, 'ArrowLeft')
  p = await until(cdp, (x) => !x.zoomed && x.noTransform)
  check('← (Schritt 0) fährt heraus', !p.zoomed && p.noTransform && p.slide === 2, short(p))
  await evalJs(cdp, `new Promise((resolve) => {
    const ch = new BroadcastChannel('hashmark-presenter:' + location.pathname)
    ch.postMessage({ type: 'hashmark:presenter-hello' })
    setTimeout(() => ch.postMessage({ type: 'hashmark:presenter-key', key: 'ArrowRight', shiftKey: false }), 400)
    setTimeout(() => { ch.close(); resolve(true) }, 900)
  })`)
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.5)
  check('→ aus dem Presenter-Fenster löst den Zoom ebenfalls aus', p.zoomed && p.slide === 2, short(p))
  await press(cdp, 'ArrowLeft')
  await until(cdp, (x) => !x.zoomed && x.noTransform)
  await evalJs(cdp, `location.hash = '#zoom:1'`)
  await until(cdp, (x) => x.slide === 0 && x.noTransform)
  await sleep(500)

  // 7c · Stufe 2: + und − fahren tiefer bzw. heraus, Pfeile verschieben, Minikarte, Strg + Rad, Zoom für Code
  const mapShown = () => evalJs<boolean>(cdp, `!!document.querySelector('.stage .zoom-map')`)
  await press(cdp, 'z')
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.5)
  await sleep(1000)
  p = await probe(cdp)
  const base = p.scale
  check('Zoom auf dem Bild: noch keine Minikarte', !(await mapShown()), short(p))
  await press(cdp, '+')
  p = await until(cdp, (x) => x.scale > base * 1.4)
  check('+ fährt eine Stufe tiefer (1,5×)', p.scale > base * 1.4 && p.scale < base * 1.6 && p.zoomed, `${base} → ${p.scale}`)
  check('im tiefen Zoom zeigt die Minikarte den Ausschnitt', await mapShown())
  await sleep(500)
  const cx0 = (await probe(cdp)).cx
  await press(cdp, 'ArrowRight')
  await sleep(600)
  p = await probe(cdp)
  check('→ verschiebt im tiefen Zoom den Ausschnitt, die Folie bleibt', p.slide === 0 && p.zoomed && Math.abs(p.cx - cx0) > 20, `cx ${cx0} → ${p.cx}, Folie ${p.slide + 1}`)
  await press(cdp, '-')
  await sleep(600)
  p = await probe(cdp)
  check('− fährt zurück auf die Stufe des Bildes, Minikarte weg', p.zoomed && Math.abs(p.scale - base) < base * 0.05 && !(await mapShown()), `${base} → ${p.scale}`)
  await press(cdp, 'Escape')
  p = await until(cdp, (x) => !x.zoomed && x.noTransform)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.cx, y: p.cy, deltaX: 0, deltaY: -120, modifiers: 2 })
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.1, 2000)
  check('Strg + Mausrad (Touchpad-Spreizen) startet den Zoom am Zeiger', p.zoomed && p.scale > 1.1, short(p))
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.cx, y: p.cy, deltaX: 0, deltaY: 120 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.cx, y: p.cy, deltaX: 0, deltaY: 400 })
  p = await until(cdp, (x) => !x.zoomed && x.noTransform, 3000)
  check('Mausrad zurück fährt heraus bis zur Normalansicht', !p.zoomed && p.noTransform, short(p))
  await evalJs(cdp, `location.hash = '#zoom:4'`)
  await until(cdp, (x) => x.slide === 3 && x.noTransform)
  await sleep(500)
  await press(cdp, 'z')
  p = await until(cdp, (x) => x.zoomed && x.scale > 1.2, 3000)
  check('Z vergrößert auch einen Codeblock', p.zoomed && p.scale > 1.2 && p.slide === 3, short(p))
  await press(cdp, 'z')
  await until(cdp, (x) => !x.zoomed && x.noTransform)
  await evalJs(cdp, `location.hash = '#zoom:1'`)
  await until(cdp, (x) => x.slide === 0 && x.noTransform)
  await sleep(500)

  // 8 · „Animationen reduzieren“: ohne Fahrt
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await press(cdp, 'z')
  await sleep(150)
  p = await probe(cdp)
  check('„Animationen reduzieren“: Z springt sofort aufs Bild', p.zoomed && p.scale > 1.5, short(p))
  await press(cdp, 'z')
  await sleep(150)
  p = await probe(cdp)
  check('„Animationen reduzieren“: zurück ohne Fahrt', !p.zoomed && p.noTransform, short(p))

  check('keine Fehler im Browser', cdp.errors.length === 0, cdp.errors.join(' | '))
}

async function main() {
  console.log(`[zoom-e2e] Browser: ${findBrowser()}`)
  const deck = await makeDeck()
  const site = await serveBuild(config(deck))
  try {
    await withPage(site.url, undefined, run, { ready: `!!document.querySelector('.stage img[data-zoom]')`, notReady: 'Die Präsentation zeigt kein Bild mit Zoom.' })
  } finally {
    await site.close()
  }
  if (failed) {
    console.error(`[zoom-e2e] ${failed} Prüfung(en) fehlgeschlagen`)
    process.exit(1)
  }
  console.log('[zoom-e2e] alles in Ordnung')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
