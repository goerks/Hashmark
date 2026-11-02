// Prüft das Markmap-Plugin mit Edge/Chrome headless: Die Karte wird gezeichnet (Knoten, Farben), es gibt keinen Fehler, und die Seite
// lädt nichts von fremden Adressen (Offline-Regel, Ticket #56/#57). Aufruf: node scripts/markmap-e2e.ts
// (Browser: HASHMARK_BROWSER; in der CI HASHMARK_NO_SANDBOX=1)

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { config } from '../src/cli/config.ts'
import { serveBuild, withPage, type Cdp } from '../src/cli/pdf.ts'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${name}${ok ? '' : detail ? ` (${detail})` : ''}`)
  if (!ok) failed++
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const evalJs = async <T>(cdp: Cdp, expression: string): Promise<T> => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'Fehler im Browser')
  return r.result.value as T
}

const MD = '# Mindmap\n\n```markmap\n# Hashmark\n- **Kern**\n  - Parser\n  - Plan\n- Runtime\n  - Presenter\n  - Editor\n- Export\n  - PDF\n  - PPTX\n```\n'

async function makeDeck() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-markmap-e2e-'))
  await fs.writeFile(path.join(dir, 'deck.yaml'), 'title: Markmap-Prüfung\n')
  await fs.writeFile(path.join(dir, 'a.md'), MD)
  return dir
}

async function run(cdp: Cdp) {
  await sleep(1500)
  const info = await evalJs<{ svg: number; nodes: number; texts: string[]; error: string; strokes: string[]; external: string[] }>(cdp, `(() => {
    const block = document.querySelector('.stage .markmap-block')
    const nodes = [...(block?.querySelectorAll('.markmap-node') ?? [])]
    const origin = location.origin
    const external = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'))
    return {
      svg: block?.querySelectorAll('svg.markmap-svg').length ?? 0,
      nodes: nodes.length,
      texts: nodes.map((n) => (n.textContent ?? '').trim()).filter(Boolean),
      error: block?.querySelector('.markmap-error')?.textContent ?? '',
      strokes: [...new Set([...(block?.querySelectorAll('.markmap-link') ?? [])].map((l) => getComputedStyle(l).stroke))],
      external,
    }
  })()`)
  check('die Karte ist gezeichnet', info.svg === 1, `svg=${info.svg}`)
  check('kein Markmap-Fehler', info.error === '', info.error)
  check('alle zehn Knoten sind da (Mitte und neun Äste)', info.nodes === 10, `Knoten=${info.nodes}`)
  check('die Texte stehen in den Knoten', ['Hashmark', 'Kern', 'Parser', 'PPTX'].every((t) => info.texts.includes(t)), info.texts.join(' | '))
  check('die Äste haben verschiedene Farben', info.strokes.length >= 3, info.strokes.join(' '))
  check('nichts wird von fremden Adressen geladen', info.external.length === 0, info.external.join(' '))
  // Größe: Die Karte füllt ihre Fläche (Breite oder Höhe zu mindestens 80 %), die Schrift ist auf der Bühne lesbar groß,
  // und kein Knoten liegt über einem anderen (markmap-view misst in Bildschirmpunkten, die Bühne ist skaliert).
  const size = await evalJs<{ fill: number; font: number; overlaps: number; stage: number; inside: boolean; gap: string }>(cdp, `(() => {
    const svg = document.querySelector('.stage .markmap-svg')
    const g = svg.querySelector(':scope > g')
    const s = svg.getBoundingClientRect(), r = g.getBoundingClientRect()
    // Verkleinerung der Bühne = Bildschirmbreite des SVG durch seine Layoutbreite
    const scale = parseFloat(getComputedStyle(svg).width) ? s.width / parseFloat(getComputedStyle(svg).width) : 1
    const boxes = [...svg.querySelectorAll('.markmap-foreign')].map((e) => e.getBoundingClientRect())
    let overlaps = 0
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (w > 2 && h > 2) overlaps++
    }
    const leaf = svg.querySelector('.markmap-foreign')
    const inside = r.left >= s.left - 2 && r.top >= s.top - 2 && r.right <= s.right + 2 && r.bottom <= s.bottom + 2
    const gap = 'links ' + (r.left - s.left).toFixed(0) + ', oben ' + (r.top - s.top).toFixed(0) + ', rechts ' + (s.right - r.right).toFixed(0) + ', unten ' + (s.bottom - r.bottom).toFixed(0)
    return { inside, gap, fill: Math.max(r.width / s.width, r.height / s.height), font: parseFloat(getComputedStyle(leaf).fontSize) * scale, overlaps, stage: scale }
  })()`)
  check('die Karte füllt ihre Fläche', size.fill >= 0.8, `Füllung=${size.fill.toFixed(2)}`)
  check('die Karte liegt vollständig im Bild (nichts abgeschnitten)', size.inside, size.gap)
  console.log(`       Ränder: ${size.gap}`)
  check('kein Knoten liegt über einem anderen', size.overlaps === 0, `Überlappungen=${size.overlaps}`)
  console.log(`       Größe: Füllung ${size.fill.toFixed(2)}, Bühnenfaktor ${size.stage.toFixed(2)}, Schrift ${size.font.toFixed(1)} px am Bildschirm`)
  // Bedienung: ein Klick auf den Kreis eines Astes klappt ihn zu
  const folded = await evalJs<{ before: number; after: number }>(cdp, `(async () => {
    const count = () => document.querySelector('.stage .markmap-svg').querySelectorAll('.markmap-node').length
    const before = count()
    const circle = document.querySelector('.stage .markmap-svg g.markmap-node[data-depth="1"] circle')
    if (!circle) return { before, after: before }
    circle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 400))
    return { before, after: count() }
  })()`)
  check('ein Klick auf einen Ast klappt ihn zu', folded.after < folded.before, `${folded.before} → ${folded.after}`)
  const box = await evalJs<{ w: number; h: number }>(cdp, `(() => { const r = document.querySelector('.stage .markmap-svg').getBoundingClientRect(); return { w: r.width, h: r.height } })()`)
  check('die Karte hat eine Größe', box.w > 200 && box.h > 100, `${box.w} × ${box.h}`)
}

const deck = await makeDeck()
const site = await serveBuild(config(deck))
try {
  await withPage(site.url, undefined, run, { ready: `!!document.querySelector('.stage .markmap-block[data-rendered]')`, notReady: 'Die Präsentation zeigt keine Markmap.' })
} finally {
  await site.close()
}
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
process.exit(failed ? 1 : 0)
