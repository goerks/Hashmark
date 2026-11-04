// Sprechernotizen im Deck (Ticket #54): zählen und für Weitergabe oder öffentliche Ansicht entfernen.
// Notizen stehen als HTML in `Slide.notes` (je Sub-Slide) und `DeckNode.notes` (alle zusammen, fürs Handout).

import type { Deck, DeckNode } from './types.ts'

const has = (html: string | undefined) => !!html && html.trim() !== ''

/** Anzahl der Folien (Sub-Slides), die Notizen haben */
export function countNotes(deck: Pick<Deck, 'nodes'>): number {
  let n = 0
  const walk = (nodes: DeckNode[]) => {
    for (const node of nodes) {
      for (const slide of node.slides) if (has(slide.notes)) n++
      walk(node.children)
    }
  }
  walk(deck.nodes)
  return n
}

/** Kopie des Decks ohne Notizen; das Original bleibt unverändert */
export function stripNotes<T extends Pick<Deck, 'nodes'>>(deck: T): T {
  const strip = (node: DeckNode): DeckNode => {
    const { notes: _notes, ...rest } = node
    return { ...rest, slides: node.slides.map(({ notes: _n, ...slide }) => slide), children: node.children.map(strip) }
  }
  return { ...deck, nodes: deck.nodes.map(strip) }
}

/**
 * Seiten, die Notizen brauchen (Presenter-View, Lesemodus, Druck mit Handout, Editor). Die einfache Präsentation braucht sie nicht.
 * Der Webdienst liefert sonst ein Deck ohne Notizen (Browser: `location.search` und `location.pathname`).
 */
export function pageNeedsNotes(search: string, pathname: string): boolean {
  return /[?&](presenter|reader|print|card)\b/.test(search) || /editor\.html$/.test(pathname)
}
