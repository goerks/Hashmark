// Vortragsplan: welche Knoten der Vortragende abläuft (Pfad), bei Zeit oder Fragen dazunimmt (optional)
// oder nur im Anhang bereithält. Der Autor setzt den Standard im Markdown, der Vortragende überschreibt ihn.
// Rein funktional, ohne DOM; die Auswertung beim Navigieren steht in navigator.ts.

import type { Navigator } from './navigator.ts'
import type { DeckNode, PlanState } from './types.ts'

export type { PlanState }

/** Überschreibungen des Vortragenden je Knoten-ID; ohne Eintrag gilt der Standard des Autors */
export type PlanStates = Record<string, PlanState>

export const PLAN_STATES: readonly PlanState[] = ['path', 'optional', 'appendix']
export const PLAN_LABEL: Record<PlanState, string> = { path: 'Pfad', optional: 'Optional', appendix: 'Anhang' }

const isOff = (v: string | undefined) => !v || ['false', 'off', 'no', '0'].includes(v.toLowerCase())

/** Standard des Autors aus den Überschrift-Attributen: `{optional}`, `{appendix}` oder `{plan=path|optional|appendix}` */
export function authorPlan(attrs: Record<string, string>): PlanState | undefined {
  const named = attrs.plan?.toLowerCase()
  if (named && (PLAN_STATES as readonly string[]).includes(named)) return named as PlanState
  if (!isOff(attrs.appendix)) return 'appendix'
  if (!isOff(attrs.optional)) return 'optional'
  return undefined
}

// ---------- Datei .hashmark/plan.json ----------

export interface PlanEntry {
  states: PlanStates
  /** Zeitbudget in Sekunden, wenn der Fahrplan aus der Vorlage „Zeitbudget“ stammt */
  budget?: number
}

/** Gespeicherte Fahrpläne eines Decks */
export interface PlanFile {
  active: string
  plans: Record<string, PlanEntry>
}

export const DEFAULT_PLAN = 'Standard'
export const PLAN_PATH = '.hashmark/plan.json'

export const emptyPlanFile = (): PlanFile => ({ active: DEFAULT_PLAN, plans: { [DEFAULT_PLAN]: { states: {} } } })

/** Liest eine Plan-Datei tolerant: Unbrauchbares wird verworfen, der Standard-Fahrplan gibt es immer. */
export function parsePlanFile(raw: unknown): PlanFile {
  const out = emptyPlanFile()
  const src = raw as { active?: unknown; plans?: Record<string, { states?: unknown; budget?: unknown }> } | null
  if (!src || typeof src !== 'object' || !src.plans || typeof src.plans !== 'object') return out
  for (const [name, entry] of Object.entries(src.plans)) {
    if (!name || !entry || typeof entry !== 'object' || typeof entry.states !== 'object' || !entry.states) continue
    const states: PlanStates = {}
    for (const [id, s] of Object.entries(entry.states)) if ((PLAN_STATES as readonly unknown[]).includes(s)) states[id] = s as PlanState
    out.plans[name] = { states, ...(typeof entry.budget === 'number' && entry.budget > 0 ? { budget: entry.budget } : {}) }
  }
  out.active = typeof src.active === 'string' && out.plans[src.active] ? src.active : DEFAULT_PLAN
  return out
}

/** Zustände des aktiven Fahrplans */
export const activeStates = (file: PlanFile): PlanStates => file.plans[file.active]?.states ?? {}

// ---------- Zeitschätzung ----------

export const SECONDS_PER_SLIDE = 60

/**
 * Eigene Redezeit eines Knotens: `{duration}` an Blättern, sonst eine Minute je Sub-Slide.
 * (`duration` an einem Kapitel gilt für das ganze Kapitel samt Details und taugt nicht als Eigenzeit.)
 */
export function ownSeconds(node: DeckNode): number {
  return !node.children.length && node.duration ? node.duration : node.slides.length * SECONDS_PER_SLIDE
}

export interface PlanSummary {
  path: number
  optional: number
  appendix: number
  /** Anzahl Knoten je Zustand */
  count: Record<PlanState, number>
}

/** Summen der geschätzten Zeit je Zustand */
export function summarize(nav: Navigator): PlanSummary {
  const s: PlanSummary = { path: 0, optional: 0, appendix: 0, count: { path: 0, optional: 0, appendix: 0 } }
  for (const n of nav.walk()) {
    const st = nav.state(n.id)
    s[st] += ownSeconds(n)
    s.count[st]++
  }
  return s
}

// ---------- Vorlagen ----------

const everyNode = (nav: Navigator, fn: (n: DeckNode) => PlanState): PlanStates => {
  const out: PlanStates = {}
  for (const n of nav.walk()) out[n.id] = fn(n)
  return out
}

/** „Alles“: jeder Knoten ist Pfad, auch Optionales und Anhang */
export const presetAll = (nav: Navigator): PlanStates => everyNode(nav, () => 'path')

/** „Bis Ebene n“: tiefere Knoten sind optional */
export const presetDepth = (nav: Navigator, depth: number): PlanStates => everyNode(nav, (n) => (n.depth <= depth ? 'path' : 'optional'))

/**
 * „Zeitbudget“: wirft Knoten aus dem Pfad, bis die Schätzung ins Budget passt. Die tiefsten und letzten zuerst.
 * Der Anhang des Autors bleibt Anhang, Optionales bleibt optional.
 */
export function presetBudget(nav: Navigator, seconds: number): PlanStates {
  const base = nav.with({ states: {}, all: false })
  const onPath = [...base.walk()].filter((n) => base.state(n.id) === 'path')
  let total = onPath.reduce((sum, n) => sum + ownSeconds(n), 0)
  const states: PlanStates = {}
  const order = onPath.map((n, i) => ({ n, i })).sort((a, b) => b.n.depth - a.n.depth || b.i - a.i)
  for (const { n } of order) {
    if (total <= seconds) break
    states[n.id] = 'optional'
    total -= ownSeconds(n)
  }
  return states
}

// ---------- Einzelne Knoten umschalten ----------

/** Nimmt die Überschreibung eines Knotens samt Unterbaum zurück (es gilt wieder der Standard des Autors). */
export function resetSubtree(nav: Navigator, states: PlanStates, id: string): PlanStates {
  const node = nav.node(id)
  if (!node) return states
  const out = { ...states }
  const clear = (n: DeckNode) => {
    delete out[n.id]
    n.children.forEach(clear)
  }
  clear(node)
  return out
}

/** Setzt einen Knoten samt Unterbaum auf einen Zustand (Überschreibungen darunter entfallen). */
export function setSubtree(nav: Navigator, states: PlanStates, id: string, state: PlanState): PlanStates {
  if (!nav.node(id)) return states
  return { ...resetSubtree(nav, states, id), [id]: state }
}

/** Reihenfolge für Handout und PDF: erst der Pfad, dann Optionales, zuletzt der Anhang (je in Lesereihenfolge). */
export function planGroups(nav: Navigator): Record<PlanState, DeckNode[]> {
  const groups: Record<PlanState, DeckNode[]> = { path: [], optional: [], appendix: [] }
  for (const n of nav.walk()) groups[nav.state(n.id)].push(n)
  return groups
}
