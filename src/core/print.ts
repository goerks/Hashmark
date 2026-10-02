// Druck/PDF: welche Seiten in welcher Reihenfolge? Rein funktional, ohne DOM.

import { stepsOf, type Navigator } from './navigator.ts'
import { planGroups } from './plan.ts'
import type { DeckNode, PlanState } from './types.ts'

/** Reihenfolge der Seiten: Baum (alles, wie im Linear-Modus), nur der Pfad des Plans, oder Pfad → Optionales → Anhang */
export type PrintPlan = 'tree' | 'path' | 'grouped'

export interface PrintOptions {
  /** nur Knoten bis zu dieser Tiefe (1 = Hauptpfad); Infinity = alle */
  depth: number
  /** jeder Schritt eine eigene Seite statt nur der Endzustand */
  steps: boolean
  /** Handout: A4 hoch, Folie oben, Sprechernotizen darunter */
  notes: boolean
  /** Breadcrumb und Seitenzahl auf den Seiten */
  footer: boolean
  /** Reihenfolge und Auswahl nach dem Vortragsplan */
  plan: PrintPlan
}

export const DEFAULT_PRINT: PrintOptions = { depth: Infinity, steps: false, notes: false, footer: true, plan: 'tree' }

export interface PrintPage {
  node: DeckNode
  slide: number
  /** abgespielte Schritte auf dieser Seite */
  step: number
  /** erste Seite des Knotens (trägt den Anker) */
  first: boolean
  /** erste Seite dieser Sub-Slide (trägt ihre Notizen) */
  slideFirst: boolean
  /** Vorfahren inkl. Knoten, für die Breadcrumb */
  trail: DeckNode[]
  /** Rolle im Plan, nur bei `plan: 'grouped'` gesetzt (für die Beschriftung von Optionalem und Anhang) */
  role?: PlanState
}

/**
 * Seiten in Lesereihenfolge: Kapitel, dann seine Details (Tiefensuche), wie im Linear-Modus.
 * Mit `opts.plan` ungleich `tree` entscheidet der Vortragsplan (`nav` trägt die Überschreibungen des Vortragenden).
 */
export function printPages(nodes: DeckNode[], opts: PrintOptions, nav?: Navigator): PrintPage[] {
  const pages: PrintPage[] = []
  const add = (node: DeckNode, path: DeckNode[], role?: PlanState) => {
    node.slides.forEach((_, slide) => {
      const total = stepsOf(node, slide)
      const steps = opts.steps ? Array.from({ length: total + 1 }, (_, s) => s) : [total]
      for (const step of steps) {
        pages.push({ node, slide, step, first: pages.every((p) => p.node !== node), slideFirst: step === steps[0], trail: path, ...(role ? { role } : {}) })
      }
    })
  }
  if (opts.plan !== 'tree' && nav) {
    const groups = planGroups(nav)
    const ordered = opts.plan === 'path' ? groups.path : [...groups.path, ...groups.optional, ...groups.appendix]
    for (const node of ordered) {
      if (node.depth <= opts.depth) add(node, nav.path(node.id), opts.plan === 'grouped' ? nav.state(node.id) : undefined)
    }
    return pages
  }
  const walk = (list: DeckNode[], trail: DeckNode[]) => {
    for (const node of list) {
      if (node.depth > opts.depth) continue
      const path = [...trail, node]
      add(node, path)
      walk(node.children, path)
    }
  }
  walk(nodes, [])
  return pages
}

const flag = (v: string | null, fallback: boolean) => (v === null ? fallback : v !== '0' && v !== 'false')

export function parsePrintOptions(params: URLSearchParams): PrintOptions {
  const depth = Number(params.get('depth'))
  return {
    depth: depth >= 1 ? depth : DEFAULT_PRINT.depth,
    steps: flag(params.get('steps'), DEFAULT_PRINT.steps),
    notes: flag(params.get('notes'), DEFAULT_PRINT.notes),
    footer: flag(params.get('footer'), DEFAULT_PRINT.footer),
    plan: params.get('plan') === 'path' || params.get('plan') === 'grouped' ? (params.get('plan') as PrintPlan) : DEFAULT_PRINT.plan,
  }
}

/** Query-String für die Druckansicht, z. B. `?print&depth=2&steps=1` */
export function printQuery(opts: Partial<PrintOptions>, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ print: '', ...extra })
  if (opts.depth && Number.isFinite(opts.depth)) p.set('depth', String(opts.depth))
  if (opts.steps) p.set('steps', '1')
  if (opts.notes) p.set('notes', '1')
  if (opts.footer === false) p.set('footer', '0')
  if (opts.plan && opts.plan !== 'tree') p.set('plan', opts.plan)
  return '?' + p.toString().replace(/^print=/, 'print')
}
