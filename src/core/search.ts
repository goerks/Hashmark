// Suche über alle Folien (Ctrl+K): Titel, Pfad und Text jeder Sub-Slide. Ohne DOM.

import type { DeckNode } from './types.ts'

export interface SearchEntry {
  id: string
  slide: number
  title: string
  /** Titel der Vorfahren, für die Anzeige */
  trail: string[]
  /** reiner Text der Sub-Slide (ohne HTML) */
  text: string
}

export interface SearchHit extends SearchEntry {
  score: number
  /** Textausschnitt um den ersten Treffer, falls der Treffer nicht im Titel liegt */
  snippet?: string
}

/** MathML einer Formel (KaTeX): Klartext steht schon im sichtbaren Teil, das LaTeX in der Annotation soll nicht gefunden werden */
const MATHML_TEXT = /<span class="katex-mathml">[\s\S]*?<\/math><\/span>/g
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }

/** HTML → Text: Tags raus, Entities auflösen, Leerraum zusammenfassen. Mermaid-Quellen und SVG zählen nicht. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<pre class="mermaid-src"[\s\S]*?<\/pre>/gi, ' ')
    .replace(MATHML_TEXT, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim()
}

/** Kleinbuchstaben, Umlaute und Akzente vereinheitlicht („Überblick“ findet „uberblick“ und umgekehrt) */
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')

export function buildSearchIndex(nodes: DeckNode[]): SearchEntry[] {
  const out: SearchEntry[] = []
  const walk = (list: DeckNode[], trail: string[]) => {
    for (const node of list) {
      node.slides.forEach((s, slide) => out.push({ id: node.id, slide, title: node.title, trail, text: htmlToText(s.html) }))
      walk(node.children, [...trail, node.title])
    }
  }
  walk(nodes, [])
  return out
}

/** Buchstaben der Anfrage kommen der Reihe nach im Text vor („arpa“ → „Architektur › Parser“) */
function subsequence(query: string, text: string): boolean {
  let i = 0
  for (const ch of text) if (ch === query[i] && ++i === query.length) return true
  return query.length === 0
}

/**
 * Sucht nach allen Wörtern der Anfrage (UND). Treffer im Titel zählen am meisten, dann Pfad, dann Text.
 * Ohne Wort-Treffer greift eine unscharfe Suche über die Titel (Buchstabenfolge).
 */
export function search(index: SearchEntry[], query: string, limit = 30): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits: SearchHit[] = []
  for (const e of index) {
    const title = fold(e.title)
    const path = fold(e.trail.join(' '))
    const text = fold(e.text)
    let score = 0
    let all = true
    for (const w of words) {
      if (title.startsWith(w)) score += 12
      else if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) score += 9
      else if (title.includes(w)) score += 7
      else if (path.includes(w)) score += 4
      else if (text.includes(w)) score += 2
      else { all = false; break }
    }
    if (!all) {
      // unscharf nur über Pfad und Titel → eine Sub-Slide pro Knoten reicht
      const compact = words.join('')
      if (e.slide > 0 || compact.length < 3 || !subsequence(compact, `${path} ${title}`)) continue
      score = 1
    }
    // eine Sub-Slide pro Knoten reicht, wenn der Treffer im Titel liegt
    if (e.slide > 0 && words.every((w) => title.includes(w))) continue
    const hit: SearchHit = { ...e, score: score - e.slide * 0.01 }
    const first = words.find((w) => !title.includes(w) && text.includes(w))
    if (first) hit.snippet = snippetAround(e.text, first)
    hits.push(hit)
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Ausschnitt von ca. 80 Zeichen um das Wort */
function snippetAround(text: string, word: string): string {
  const at = fold(text).indexOf(word)
  if (at < 0) return text.slice(0, 80)
  const from = Math.max(0, at - 30)
  const to = Math.min(text.length, at + word.length + 50)
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}
