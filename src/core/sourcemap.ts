// Editor-Sync: Zeile im Quelltext ↔ Knoten/Sub-Slide im Deck-Baum (über DeckNode.source).

import type { DeckNode } from './types.ts'

const FENCE = /^\s{0,3}(`{3,}|~{3,})/
const BREAK = /^ {0,3}-{3,}\s*$/

function flatten(nodes: DeckNode[], out: DeckNode[] = []): DeckNode[] {
  for (const n of nodes) {
    out.push(n)
    flatten(n.children, out)
  }
  return out
}

/** Zeilennummern (1-basiert) der Folientrenner `---` außerhalb von Codeblöcken. */
function breakLines(lines: string[], from: number, to: number): number[] {
  const out: number[] = []
  let fence: string | null = null
  for (let n = from; n <= to && n <= lines.length; n++) {
    const line = lines[n - 1]
    const f = line.match(FENCE)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null
    } else if (f) fence = f[1]
    else if (BREAK.test(line)) out.push(n)
  }
  return out
}

/**
 * Welcher Knoten und welche Sub-Slide liegen an `line` der Datei `file`?
 * Vor der ersten Überschrift → erster Knoten der Datei.
 */
export function nodeAtLine(nodes: DeckNode[], file: string, text: string, line: number): { id: string; slide: number } | null {
  const inFile = flatten(nodes).filter((n) => n.source.file === file).sort((a, b) => a.source.line - b.source.line)
  if (!inFile.length) return null
  const node = [...inFile].reverse().find((n) => n.source.line <= line) ?? inFile[0]
  if (line <= node.source.line) return { id: node.id, slide: 0 }
  const breaks = breakLines(text.split(/\r?\n/), node.source.line + 1, line)
  return { id: node.id, slide: Math.min(breaks.length, node.slides.length - 1) }
}

/** Quelltext-Position eines Knotens bzw. seiner n-ten Sub-Slide (Zeile nach dem n-ten `---`). */
export function lineOfSlide(nodes: DeckNode[], id: string, slide: number, text?: string): { file: string; line: number } | null {
  const node = flatten(nodes).find((n) => n.id === id)
  if (!node) return null
  const { file, line } = node.source
  if (!slide || text === undefined) return { file, line }
  const lines = text.split(/\r?\n/)
  const breaks = breakLines(lines, line + 1, lines.length)
  const b = breaks[slide - 1]
  return { file, line: b ? Math.min(b + 1, lines.length) : line }
}

/** Pfad vom Wurzelknoten bis zum Knoten mit der Id (für Brotkrumen); leer, wenn unbekannt */
export function pathToNode(nodes: DeckNode[], id: string): DeckNode[] {
  for (const n of nodes) {
    if (n.id === id) return [n]
    const below = pathToNode(n.children, id)
    if (below.length) return [n, ...below]
  }
  return []
}
