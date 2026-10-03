// `hashmark check`: Deck prüfen wie ein Linter. Statisch (Laden, Layouts, Attribute, Bilder, Theme) und per Browser (Überlauf).

import path from 'node:path'
import { staticChecks, type Finding } from '../core/check.ts'
import { DeckError, loadDeck } from '../core/deck.ts'
import type { DeckNode } from '../core/types.ts'
import { config } from './config.ts'
import { findBrowser, serveBuild, withPrintView } from './pdf.ts'

export interface CheckOptions {
  /** Überlauf per Browser messen (Standard); false = nur die schnellen statischen Prüfungen */
  overflow?: boolean
  browser?: string
}

interface OverflowRow { node: string; sub: number; fit: number | null }
interface DiagramError { node: string; sub: number; message: string }
interface Measured { rows: OverflowRow[]; errors: DiagramError[] }

/** Alle Seiten der Druckansicht messen: `Slide.svelte` setzt `data-overflow` (und `data-fit`, wenn `{fit}` verkleinert hat). */
async function measureOverflow(deckDir: string, browser?: string): Promise<Measured> {
  const site = await serveBuild(config(deckDir))
  try {
    return await withPrintView(`${site.url}?print&footer=0`, browser, async (cdp) => {
// Mermaid-Fehler (`.mermaid-error`) stehen nach dem Rendern im DOM; die Druckansicht wartet darauf
      const expr = `JSON.stringify({
        rows: [...document.querySelectorAll('.print-page')].flatMap((p) => {
          const s = p.querySelector('.slide'); if (!s || !s.hasAttribute('data-overflow')) return []
          return [{ node: p.dataset.node, sub: Number(p.dataset.sub), fit: s.dataset.fit ? Number(s.dataset.fit) : null }]
        }),
        errors: [...document.querySelectorAll('.mermaid-error')].map((e) => {
          const p = e.closest('.print-page'); return { node: p?.dataset.node ?? '', sub: Number(p?.dataset.sub ?? 0), message: (e.textContent || '').split('\\n').slice(1, 3).join(' ').trim() }
        }),
      })`
      const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true })
      return JSON.parse(r.result.value) as Measured
    })
  } finally {
    await site.close()
  }
}

/** Liefert die Funde; ein Fehler beim Laden des Decks ist selbst ein Fund. */
export async function checkDeck(deckDir: string, opts: CheckOptions = {}): Promise<Finding[]> {
  let result
  try {
    result = await loadDeck(deckDir)
  } catch (e) {
    return [{ level: 'error', message: (e as Error).message, ...(e instanceof DeckError && e.file ? { file: path.relative(deckDir, e.file) } : {}) }]
  }
  const findings = staticChecks(result)
  if (opts.overflow !== false) {
    findBrowser(opts.browser) // früh und mit klarer Meldung scheitern, wenn kein Edge/Chrome da ist
    const sources = new Map<string, DeckNode>()
    const visit = (nodes: DeckNode[]) => nodes.forEach((n) => { sources.set(n.id, n); visit(n.children) })
    visit(result.deck.nodes)
    const measured = await measureOverflow(deckDir, opts.browser)
    for (const err of measured.errors) {
      const node = sources.get(err.node)
      findings.push({
        level: 'error',
        message: `„${node?.title ?? err.node}“: Mermaid-Diagramm fehlerhaft${err.message ? ` (${err.message})` : ''}`,
        ...(node ? { file: node.source.file, line: node.source.line } : {}),
      })
    }
    for (const row of measured.rows) {
      const node = sources.get(row.node)
      const part = node && node.slides.length > 1 ? ` (Folie ${row.sub + 1} von ${node.slides.length})` : ''
      const still = row.fit ? `, auch verkleinert auf ${Math.round(row.fit * 100)} %` : ''
      findings.push({
        level: 'error',
        message: `„${node?.title ?? row.node}“${part}: Überlauf${still}. Kürzen, mit --- teilen${row.fit ? '' : ' oder {fit} an die Überschrift setzen'}`,
        ...(node ? { file: node.source.file, line: node.source.line } : {}),
      })
    }
  }
  return findings
}

export function formatFinding(f: Finding): string {
  const at = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}  ` : ''
  return `${f.level === 'error' ? 'Fehler ' : 'Hinweis'}  ${at}${f.message}`
}
