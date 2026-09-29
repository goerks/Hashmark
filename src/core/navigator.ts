// Navigator: reine State-Machine über dem Deck-Baum, ohne DOM.

import type { DeckNode } from './types.ts'

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

export class Navigator {
  readonly nodes: DeckNode[]
  private entries = new Map<string, Entry>()
  /** Position im Elternknoten beim Abtauchen, damit ↑ dorthin zurückkehrt */
  private memory = new Map<string, { slide: number; step: number }>()

  constructor(nodes: DeckNode[]) {
    this.nodes = nodes
    const index = (list: DeckNode[], parent?: DeckNode) =>
      list.forEach((node, i) => {
        this.entries.set(node.id, { node, parent, siblings: list, index: i })
        index(node.children, node)
      })
    index(nodes)
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

  /** ↓ / Enter: in den ersten Kindknoten. `peek`: nur Ziel ermitteln (Anzeige), Position nicht merken. */
  down(pos: Position, peek = false): Move | null {
    const child = this.node(pos.id)?.children[0]
    if (!child) return null
    if (!peek) this.memory.set(pos.id, { slide: pos.slide, step: pos.step ?? 0 })
    return { pos: at(child.id, 0), dir: 'down' }
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
   * Space / PageDown (Presenter): der Linie nach in die Tiefe – Tiefensuche durch den ganzen Baum.
   * Schritte, Sub-Slides, dann erstes Kind, dann nächster Geschwisterknoten bzw. Nachfolger eines Vorfahren.
   */
  forward(pos: Position, peek = false): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    const step = pos.step ?? 0
    if (step < stepsOf(e.node, pos.slide)) return { pos: at(pos.id, pos.slide, step + 1), dir: 'step' }
    if (pos.slide < e.node.slides.length - 1) return { pos: at(pos.id, pos.slide + 1), dir: 'right' }
    if (e.node.children.length) return this.down(pos, peek)
    return this.next(pos)
  }

  /** Shift+Space / PageUp: derselbe Weg rückwärts; man landet vollständig aufgedeckt. */
  backward(pos: Position): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    const step = pos.step ?? 0
    if (step > 0) return { pos: at(pos.id, pos.slide, step - 1), dir: 'step' }
    if (pos.slide > 0) return { pos: at(pos.id, pos.slide - 1, stepsOf(e.node, pos.slide - 1)), dir: 'left' }
    const sib = e.siblings[e.index - 1]
    if (sib) {
      // tiefster, letzter Nachfahre des vorherigen Geschwisters
      let last = sib
      while (last.children.length) last = last.children[last.children.length - 1]
      const slide = last.slides.length - 1
      return { pos: at(last.id, slide, stepsOf(last, slide)), dir: last === sib ? 'left' : 'up' }
    }
    if (e.parent) {
      const slide = e.parent.slides.length - 1
      return { pos: at(e.parent.id, slide, stepsOf(e.parent, slide)), dir: 'up' }
    }
    return null
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
