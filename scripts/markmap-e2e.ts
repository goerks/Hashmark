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
  check('alle neun Knoten sind da', info.nodes === 9, `Knoten=${info.nodes}`)
  check('die Texte stehen in den Knoten', ['Hashmark', 'Kern', 'Parser', 'PPTX'].every((t) => info.texts.includes(t)), info.texts.join(' | '))
  check('die Äste haben verschiedene Farben', info.strokes.length >= 3, info.strokes.join(' '))
  check('nichts wird von fremden Adressen geladen', info.external.length === 0, info.external.join(' '))
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
