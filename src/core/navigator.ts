// Navigator: reine State-Machine über dem Deck-Baum, ohne DOM.
//
// Zwei Arten der Bewegung:
// - Pfeile (next/prev/down/up) bewegen sich frei im Baum und kümmern sich nicht um den Plan.
// - Space/Clicker (forward/backward) folgen dem Vortragsplan: nur Knoten mit Zustand `path` (siehe plan.ts).
//   Optionales erreicht man per ↓ als Ausflug; Space führt am Ende des Ausflugs zur Abzweigung zurück.

import type { PlanStates } from './plan.ts'
import type { DeckNode, PlanState } from './types.ts'

export interface Position {
  id: string
  /** Index der Sub-Slide */
  slide: number
  /** abgespielte Schritte der Sub-Slide (0 = Ausgangszustand) */
  step?: number
}

/** Position bauen; `step` wird nur mitgeführt, wenn er nicht 0 ist. */
const at = (id: string, slide: number, step = 0): Position => (step ? { id, slide, step } : { id, slide })

/** Anzahl Schritte einer Sub-Slide */
export const stepsOf = (node: DeckNode | undefined, slide: number) => node?.slides[slide]?.steps.length ?? 0

/** Richtung einer Bewegung, steuert den Übergang (horizontal = Slide, vertikal = Zoom). */
export type Direction = 'right' | 'left' | 'down' | 'up' | 'jump' | 'step'

export interface Move {
  pos: Position
  dir: Direction
}

interface Entry {
  node: DeckNode
  parent?: DeckNode
  siblings: DeckNode[]
  index: number
}

/**
 * Ausflug abseits des Pfads, mit Rückkehrmarke.
 * `dive`: ↓ an `root` – die Kinder von `root`, die nicht auf dem Pfad liegen. `jump`: Sprung (Suche, Übersicht) zu `root` allein.
 */
export interface Excursion {
  root: string
  kind: 'dive' | 'jump'
  /** Position, von der aus der Ausflug begann */
  back: Position
}

export interface NavigatorOptions {
  /** Überschreibungen des Vortragenden je Knoten-ID */
  states?: PlanStates
  /** Plan ignorieren: Space läuft wie früher durch alles (Taste T) */
  all?: boolean
  /** laufende Ausflüge (Stapel, der letzte ist der innerste) */
  trip?: readonly Excursion[]
}

const MAX_TRIP = 8

export class Navigator {
  readonly nodes: DeckNode[]
  readonly states: PlanStates
  /** true = Plan wird ignoriert, alles ist Pfad */
  readonly all: boolean
  private entries = new Map<string, Entry>()
  /** alle Knoten in Tiefensuche, dazu der Index je ID */
  private order: DeckNode[] = []
  private orderIndex = new Map<string, number>()
  /** Position im Elternknoten beim Abtauchen, damit ↑ dorthin zurückkehrt */
  private memory = new Map<string, { slide: number; step: number }>()
  private excursions: Excursion[]

  constructor(nodes: DeckNode[], options: NavigatorOptions = {}) {
    this.nodes = nodes
    this.states = options.states ?? {}
    this.all = options.all ?? false
    this.excursions = [...(options.trip ?? [])]
    const index = (list: DeckNode[], parent?: DeckNode) =>
      list.forEach((node, i) => {
        this.entries.set(node.id, { node, parent, siblings: list, index: i })
        this.orderIndex.set(node.id, this.order.length)
        this.order.push(node)
        index(node.children, node)
      })
    index(nodes)
  }

  /** Kopie mit geändertem Plan; gemerkte Abzweigungen und Ausflüge bleiben erhalten. */
  with(patch: NavigatorOptions): Navigator {
    const next = new Navigator(this.nodes, { states: patch.states ?? this.states, all: patch.all ?? this.all, trip: patch.trip ?? this.excursions })
    next.memory = new Map(this.memory)
    return next
  }

  // ---------- Plan ----------

  /**
   * Wirksamer Zustand eines Knotens. Die nächste Überschreibung des Vortragenden auf dem Weg nach oben gewinnt,
   * sonst der nächste Standard des Autors, sonst `path`.
   */
  state(id: string): PlanState {
    if (this.all) return 'path'
    let author: PlanState | undefined
    for (let e = this.entries.get(id); e; e = e.parent && this.entries.get(e.parent.id)) {
      const chosen = this.states[e.node.id]
      if (chosen) return chosen
      author ??= e.node.plan
    }
    return author ?? 'path'
  }

  onPath(id: string): boolean {
    return this.state(id) === 'path'
  }

  /** Nächster Pfad-Knoten in Lesereihenfolge nach `id` (egal ob `id` selbst auf dem Pfad liegt). */
  private pathAfter(id: string): DeckNode | undefined {
    for (let i = (this.orderIndex.get(id) ?? -1) + 1; i < this.order.length; i++) if (this.onPath(this.order[i].id)) return this.order[i]
    return undefined
  }

  private pathBefore(id: string): DeckNode | undefined {
    for (let i = (this.orderIndex.get(id) ?? this.order.length) - 1; i >= 0; i--) if (this.onPath(this.order[i].id)) return this.order[i]
    return undefined
  }

  // ---------- Ausflüge ----------

  /** laufende Ausflüge, der innerste zuletzt */
  get trip(): readonly Excursion[] {
    return [...this.excursions]
  }

  /** Knoten, die Space in diesem Ausflug abläuft */
  private items(e: Excursion): DeckNode[] {
    const root = this.node(e.root)
    if (!root) return []
    return e.kind === 'jump' ? [root] : root.children.filter((c) => !this.onPath(c.id))
  }

  /**
   * Beendet Ausflüge, in denen `pos` nicht mehr liegt (Pfeile, Sprung auf den Pfad, Hot Reload).
   * Wird bei jeder Bewegung aufgerufen.
   */
  sync(pos: Position): void {
    while (this.excursions.length) {
      const top = this.excursions[this.excursions.length - 1]
      if (this.items(top).some((n) => n.id === pos.id)) return
      this.excursions.pop()
    }
  }

  get first(): Position | null {
    return this.nodes[0] ? { id: this.nodes[0].id, slide: 0 } : null
  }

  node(id: string): DeckNode | undefined {
    return this.entries.get(id)?.node
  }

  parent(id: string): DeckNode | undefined {
    return this.entries.get(id)?.parent
  }

  /** Vorfahren von oben nach unten, inklusive Knoten selbst (für die Breadcrumb). */
  path(id: string): DeckNode[] {
    const out: DeckNode[] = []
    for (let e = this.entries.get(id); e; e = e.parent && this.entries.get(e.parent.id)) out.unshift(e.node)
    return out
  }

  /** Querverweis auflösen: volle ID oder eindeutiges Pfad-Ende (`#backend/db-schema`). */
  find(ref: string): DeckNode | undefined {
    const exact = this.node(ref)
    if (exact) return exact
    const matches = [...this.entries.keys()].filter((id) => id.endsWith('/' + ref))
    return matches.length ? this.node(matches.sort((a, b) => a.length - b.length)[0]) : undefined
  }

  has(pos: Position): boolean {
    const n = this.node(pos.id)
    return !!n && pos.slide >= 0 && pos.slide < n.slides.length
  }

  /** → / Space: nächster Schritt, dann nächste Sub-Slide, dann nächster Geschwisterknoten, am Ende einer Ebene Nachfolger des Elternknotens. */
  next(pos: Position): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    const step = pos.step ?? 0
    if (step < stepsOf(e.node, pos.slide)) return { pos: at(pos.id, pos.slide, step + 1), dir: 'step' }
    if (pos.slide < e.node.slides.length - 1) return { pos: at(pos.id, pos.slide + 1), dir: 'right' }
    for (let cur: Entry | undefined = e; cur; cur = cur.parent && this.entries.get(cur.parent.id)) {
      const sib = cur.siblings[cur.index + 1]
      if (sib) return { pos: at(sib.id, 0), dir: cur === e ? 'right' : 'up' }
    }
    return null
  }

  /** ← : vorheriger Schritt, dann vorherige Sub-Slide (vollständig aufgedeckt), dann vorheriger Geschwisterknoten, am Anfang einer Ebene zurück zum Elternknoten. */
  prev(pos: Position): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    const step = pos.step ?? 0
    if (step > 0) return { pos: at(pos.id, pos.slide, step - 1), dir: 'step' }
    if (pos.slide > 0) return { pos: at(pos.id, pos.slide - 1, stepsOf(e.node, pos.slide - 1)), dir: 'left' }
    const sib = e.siblings[e.index - 1]
    if (sib) {
      const last = sib.slides.length - 1
      return { pos: at(sib.id, last, stepsOf(sib, last)), dir: 'left' }
    }
    if (e.parent) return this.up(pos)
    return null
  }

  /**
   * ↓ / Enter: ins Detail. Hat der Knoten Kinder abseits des Pfads (optional, Anhang), beginnt ein Ausflug mit
   * Rückkehrmarke und es geht ins erste davon. Sonst in den ersten Kindknoten, wie es Pfeile schon immer taten.
   * `peek`: nur Ziel ermitteln (Anzeige), nichts merken.
   */
  down(pos: Position, peek = false): Move | null {
    const children = this.node(pos.id)?.children
    if (!children?.length) return null
    const detail = children.find((c) => !this.onPath(c.id))
    if (!peek) {
      this.memory.set(pos.id, { slide: pos.slide, step: pos.step ?? 0 })
      if (detail) this.begin({ root: pos.id, kind: 'dive', back: at(pos.id, pos.slide, pos.step ?? 0) })
    }
    return { pos: at((detail ?? children[0]).id, 0), dir: 'down' }
  }

  private begin(e: Excursion) {
    this.excursions.push(e)
    if (this.excursions.length > MAX_TRIP) this.excursions.shift()
  }

  /**
   * Sprung (Suche, Übersicht, Presenter-Baum). Landet er abseits des Pfads, beginnt ein Ausflug:
   * Space führt nach dieser Folie zurück zu `from`.
   */
  jumpTo(target: Position, from: Position): Move {
    this.sync(from)
    const top = this.excursions[this.excursions.length - 1]
    const inside = top && this.items(top).some((n) => n.id === target.id)
    if (!this.onPath(target.id) && !inside && target.id !== from.id) this.begin({ root: target.id, kind: 'jump', back: from })
    return { pos: target, dir: 'jump' }
  }

  /** ↑ / Esc: zum Elternknoten, an die Sub-Slide, von der aus abgetaucht wurde. */
  up(pos: Position): Move | null {
    const parent = this.parent(pos.id)
    if (!parent) return null
    const mem = this.memory.get(parent.id)
    const slide = Math.min(mem?.slide ?? 0, parent.slides.length - 1)
    // ohne gemerkte Position: Elternfolie vollständig aufgedeckt zeigen
    const step = Math.min(mem?.step ?? stepsOf(parent, slide), stepsOf(parent, slide))
    return { pos: at(parent.id, slide, step), dir: 'up' }
  }

  /**
   * ↑ / Esc: Ausflug abbrechen und an die Abzweigung zurück, sonst wie `up` zum Elternknoten.
   * Nach einem Sprung (Suche, Übersicht) führt das dorthin zurück, woher man kam.
   */
  leave(pos: Position): Move | null {
    this.sync(pos)
    const top = this.excursions[this.excursions.length - 1]
    return top ? { pos: top.back, dir: 'up' } : this.up(pos)
  }

  /** Richtung der Bewegung von `from` nach `to` in Lesereihenfolge (steuert den Übergang) */
  private directionForward(from: DeckNode, to: DeckNode): Direction {
    if (this.parent(to.id)?.id === from.id) return 'down'
    return to.depth < from.depth ? 'up' : 'right'
  }

  /**
   * Space / PageDown (Presenter): dem Vortragsplan nach. Schritte, Sub-Slides, dann der nächste Knoten auf dem Pfad
   * (Tiefensuche, ohne Optionales und Anhang). Im Ausflug: die nächste Ausflug-Folie, am Ende zurück zur Abzweigung.
   * Ist der Plan ausgeschaltet (`all`), läuft es wie früher durch alles.
   */
  forward(pos: Position, peek = false): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    const step = pos.step ?? 0
    if (step < stepsOf(e.node, pos.slide)) return { pos: at(pos.id, pos.slide, step + 1), dir: 'step' }
    if (pos.slide < e.node.slides.length - 1) return { pos: at(pos.id, pos.slide + 1), dir: 'right' }
    const top = this.excursions[this.excursions.length - 1]
    if (top) {
      const items = this.items(top)
      const next = items[items.findIndex((n) => n.id === pos.id) + 1]
      if (next) return { pos: at(next.id, 0), dir: 'right' }
      // Ende des Ausflugs: zurück an die Abzweigung
      if (!peek) this.excursions.pop()
      return { pos: top.back, dir: 'up' }
    }
    const next = this.pathAfter(pos.id)
    if (!next) return null
    if (!peek && this.parent(next.id)?.id === pos.id) this.memory.set(pos.id, { slide: pos.slide, step })
    return { pos: at(next.id, 0), dir: this.directionForward(e.node, next) }
  }

  /** Shift+Space / PageUp: derselbe Weg rückwärts; man landet vollständig aufgedeckt. */
  backward(pos: Position, peek = false): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    const step = pos.step ?? 0
    if (step > 0) return { pos: at(pos.id, pos.slide, step - 1), dir: 'step' }
    if (pos.slide > 0) return { pos: at(pos.id, pos.slide - 1, stepsOf(e.node, pos.slide - 1)), dir: 'left' }
    const full = (n: DeckNode, dir: Direction): Move => {
      const slide = n.slides.length - 1
      return { pos: at(n.id, slide, stepsOf(n, slide)), dir }
    }
    const top = this.excursions[this.excursions.length - 1]
    if (top) {
      const items = this.items(top)
      const prev = items[items.findIndex((n) => n.id === pos.id) - 1]
      if (prev) return full(prev, 'left')
      // vor der ersten Ausflug-Folie: zurück an die Abzweigung
      if (!peek) this.excursions.pop()
      return { pos: top.back, dir: 'up' }
    }
    const prev = this.pathBefore(pos.id)
    return prev ? full(prev, prev.depth === e.node.depth ? 'left' : 'up') : null
  }

  /** Position in Lesereihenfolge (1-basiert) und Gesamtzahl der Folien (Sub-Slides zählen einzeln). */
  progress(pos: Position): { index: number; total: number } {
    let index = 0
    let total = 0
    for (const n of this.walk()) {
      if (n.id === pos.id) index = total + pos.slide + 1
      total += n.slides.length
    }
    return { index, total }
  }

  jump(pos: Position): Move | null {
    return this.has(pos) ? { pos, dir: 'jump' } : null
  }

  /**
   * Findet nach einem Hot Reload die passendste Position: gleiche ID, sonst gleiche Stelle
   * unter dem nächsten noch existierenden Vorfahren, sonst Anfang.
   */
  relocate(pos: Position, previous?: Navigator): Position | null {
    const n = this.node(pos.id)
    if (n) {
      const slide = Math.min(pos.slide, n.slides.length - 1)
      return at(n.id, slide, Math.min(pos.step ?? 0, stepsOf(n, slide)))
    }
    if (previous) {
      for (let e = previous.entries.get(pos.id); e; e = e.parent && previous.entries.get(e.parent.id)) {
        const siblings = e.parent ? this.node(e.parent.id)?.children : this.nodes
        if (siblings?.length) return { id: siblings[Math.min(e.index, siblings.length - 1)].id, slide: 0 }
        if (e.parent && this.node(e.parent.id)) return { id: e.parent.id, slide: 0 }
      }
    }
    return this.first
  }

  /** Alle Knoten in Tiefensuche (Übersicht, Linear-Modus). */
  *walk(list: DeckNode[] = this.nodes): Generator<DeckNode> {
    for (const n of list) {
      yield n
      yield* this.walk(n.children)
    }
  }
}

/** Deep-Link: `#architektur/backend` bzw. `#architektur/backend:2` für die 2. Sub-Slide. */
export function formatHash(pos: Position): string {
  return '#' + encodeURI(pos.id) + (pos.slide ? `:${pos.slide + 1}` : '')
}

export function parseHash(hash: string): Position | null {
  const raw = decodeURI(hash.replace(/^#/, ''))
  if (!raw) return null
  const m = raw.match(/^(.*?)(?::(\d+))?$/)!
  return { id: m[1], slide: m[2] ? Math.max(0, Number(m[2]) - 1) : 0 }
}
