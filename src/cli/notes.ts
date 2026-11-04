// Hinweis zu Sprechernotizen beim Weitergeben (Ticket #54): `hashmark build` und `hashmark export` nennen, wie viele Folien Notizen
// haben und wie man sie weglässt (`--no-notes`).

import { loadDeck } from '../core/deck.ts'
import { countNotes } from '../core/notes.ts'

/** Text des Hinweises; leer, wenn es keine Notizen gibt */
export function notesHint(count: number, command: 'build' | 'export'): string {
  if (count === 0) return ''
  const folien = count === 1 ? '1 Folie hat' : `${count} Folien haben`
  return `Achtung: ${folien} Notizen, sie stehen lesbar in der Ausgabe (Quelltext und Presenter-View). Zum Weitergeben ohne Notizen: hashmark ${command} --no-notes`
}

/** Anzahl der Folien mit Notizen im Deck (0, wenn das Deck nicht lädt: der Build meldet den Fehler selbst) */
export async function countDeckNotes(deckDir: string): Promise<number> {
  try {
    return countNotes((await loadDeck(deckDir)).deck)
  } catch {
    return 0
  }
}
