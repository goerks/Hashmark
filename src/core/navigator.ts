// Navigator: reine State-Machine über dem Deck-Baum, ohne DOM.

import type { DeckNode } from './types.ts'

export interface Position {
  id: string
  /** Index der Sub-Slide */
  slide: number
}

/** Richtung einer Bewegung, steuert den Übergang (horizontal = Slide, vertikal = Zoom). */
export type Direction = 'right' | 'left' | 'down' | 'up' | 'jump'

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
  /** Sub-Slide des Elternknotens beim Abtauchen, damit ↑ dorthin zurückkehrt */
  private memory = new Map<string, number>()

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

  /** → / Space: nächste Sub-Slide, dann nächster Geschwisterknoten, am Ende einer Ebene Nachfolger des Elternknotens. */
  next(pos: Position): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    if (pos.slide < e.node.slides.length - 1) return { pos: { id: pos.id, slide: pos.slide + 1 }, dir: 'right' }
    for (let cur: Entry | undefined = e; cur; cur = cur.parent && this.entries.get(cur.parent.id)) {
      const sib = cur.siblings[cur.index + 1]
      if (sib) return { pos: { id: sib.id, slide: 0 }, dir: cur === e ? 'right' : 'up' }
    }
    return null
  }

  /** ← : vorherige Sub-Slide, dann vorheriger Geschwisterknoten, am Anfang einer Ebene zurück zum Elternknoten. */
  prev(pos: Position): Move | null {
    const e = this.entries.get(pos.id)
    if (!e) return null
    if (pos.slide > 0) return { pos: { id: pos.id, slide: pos.slide - 1 }, dir: 'left' }
    const sib = e.siblings[e.index - 1]
    if (sib) return { pos: { id: sib.id, slide: sib.slides.length - 1 }, dir: 'left' }
    if (e.parent) return this.up(pos)
    return null
  }

  /** ↓ / Enter: in den ersten Kindknoten. */
  down(pos: Position): Move | null {
    const child = this.node(pos.id)?.children[0]
    if (!child) return null
    this.memory.set(pos.id, pos.slide)
    return { pos: { id: child.id, slide: 0 }, dir: 'down' }
  }

  /** ↑ / Esc: zum Elternknoten, an die Sub-Slide, von der aus abgetaucht wurde. */
  up(pos: Position): Move | null {
    const parent = this.parent(pos.id)
    if (!parent) return null
    const slide = Math.min(this.memory.get(parent.id) ?? 0, parent.slides.length - 1)
    return { pos: { id: parent.id, slide }, dir: 'up' }
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
    if (n) return { id: n.id, slide: Math.min(pos.slide, n.slides.length - 1) }
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
