// Markmap (Ticket #56): Mindmap aus einer Markdown-Gliederung, als Codeblock ```markmap.
// Der Kern baut den Baum selbst aus Überschriften und Listen (kein markmap-lib, kein HTML-Parser, nichts wird ausgeführt).
// Gezeichnet wird im Client mit markmap-view (src/runtime/markmap.ts), ohne Nachladen aus dem Netz.

import path from 'node:path'
import type { CodeBlockPlugin } from './render.ts'

export interface MarkmapNode { content: string; children: MarkmapNode[] }

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Einfaches Inline-Markdown → HTML: Text wird erst entschärft, dann `code`, **fett**, *kursiv*, [Text](Adresse) → Text */
export function inlineHtml(text: string): string {
  return escape(text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>')
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/

/**
 * Gliederung → Baum. Überschriften (`#`…`######`) legen die Ebene fest, Listenpunkte hängen eingerückt darunter.
 * Gibt es mehrere oberste Einträge, wird `title` (sonst „Übersicht“) zur Wurzel.
 */
export function markmapTree(src: string, title?: string): MarkmapNode {
  const top: MarkmapNode[] = []
  // Stapel der offenen Knoten mit ihrer Ebene; Überschriften haben die Ebene 1…6, Listenpunkte darunter
  const stack: { level: number; node: MarkmapNode }[] = []
  let headingLevel = 0
  let indents: number[] = []
  const add = (level: number, content: string) => {
    const node: MarkmapNode = { content: inlineHtml(content), children: [] }
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    ;(stack.length ? stack[stack.length - 1].node.children : top).push(node)
    stack.push({ level, node })
  }
  for (const raw of src.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const h = raw.match(HEADING)
    if (h) {
      headingLevel = h[1].length
      indents = []
      add(headingLevel, h[2])
      continue
    }
    const m = raw.match(ITEM)
    if (!m) continue
    const width = m[1].replace(/\t/g, '    ').length
    while (indents.length && indents[indents.length - 1] > width) indents.pop()
    if (!indents.length || indents[indents.length - 1] < width) indents.push(width)
    add(headingLevel + indents.length, m[2])
  }
  if (top.length === 1) return top[0]
  return { content: escape(title ?? 'Übersicht'), children: top }
}

/** Grenzen: sehr große oder sehr tiefe Bäume werden gekürzt (Lesbarkeit, und damit sich niemand mit einer riesigen Gliederung den Server vornimmt) */
export const MAX_NODES = 500
export const MAX_DEPTH = 12

/** Kürzt breitenweise auf höchstens `maxNodes` Knoten und `maxDepth` Ebenen. Gibt zurück, wie viele Knoten wegfielen. */
export function limitTree(root: MarkmapNode, maxNodes = MAX_NODES, maxDepth = MAX_DEPTH): number {
  let kept = 1
  let dropped = 0
  let level: MarkmapNode[] = [root]
  for (let depth = 1; level.length; depth++) {
    const next: MarkmapNode[] = []
    for (const node of level) {
      const keep: MarkmapNode[] = []
      for (const child of node.children) {
        if (depth <= maxDepth && kept < maxNodes) { keep.push(child); kept++ } else dropped += 1 + countBelow(child)
      }
      node.children = keep
      next.push(...keep)
    }
    level = next
  }
  return dropped
}

function countBelow(node: MarkmapNode): number {
  let n = 0
  const stack = [...node.children]
  while (stack.length) { const c = stack.pop()!; n++; stack.push(...c.children) }
  return n
}

/** Zeilen, die weder Überschrift noch Listenpunkt sind (werden nicht gezeichnet) */
export function ignoredLines(src: string): number {
  return src.split(/\r?\n/).filter((l) => l.trim() && !HEADING.test(l) && !ITEM.test(l)).length
}

function listHtml(nodes: MarkmapNode[]): string {
  if (!nodes.length) return ''
  return `<ul>${nodes.map((n) => `<li>${n.content}${listHtml(n.children)}</li>`).join('')}</ul>`
}

const ATTRS = ['height', 'title', 'fold']

/**
 * Codeblock `markmap` mit `{height=420 title="Thema"}`: `height` in Pixeln, `title` = Wurzel bei mehreren obersten Einträgen,
 * `fold=2` klappt alles ab dieser Ebene zu. Das Ergebnis ist Text und eine Liste (Suche, Lesemodus), der Client zeichnet die Karte.
 */
export const markmapPlugin: CodeBlockPlugin = {
  langs: ['markmap'],
  render(node, attrs, ctx) {
    const warn = (m: string) => ctx.warnings?.push(`Markmap: ${m} (${path.relative(ctx.deckDir, ctx.file)})`)
    for (const key of Object.keys(attrs)) if (!ATTRS.includes(key)) warn(`Attribut „${key}“ ist unbekannt (${ATTRS.join(', ')})`)
    if (attrs.height !== undefined && !/^\d+$/.test(attrs.height)) warn(`height="${attrs.height}" ist ungültig (Pixel, z. B. height=420)`)
    if (attrs.fold !== undefined && !/^[1-6]$/.test(attrs.fold)) warn(`fold="${attrs.fold}" ist ungültig (Ebene 1 bis 6)`)
    const tree = markmapTree(node.value, attrs.title)
    if (!node.value.split(/\r?\n/).some((l) => HEADING.test(l) || ITEM.test(l))) warn('der Block enthält keine Überschriften oder Listenpunkte (daraus entsteht die Mindmap)')
    const ignored = ignoredLines(node.value)
    if (ignored) warn(`${ignored} Zeile(n) ohne #, -, * oder Nummer am Anfang werden nicht gezeichnet (nur Überschriften und Listenpunkte)`)
    const dropped = limitTree(tree)
    if (dropped) warn(`die Mindmap ist zu groß, ${dropped} Knoten fielen weg (höchstens ${MAX_NODES} Knoten und ${MAX_DEPTH} Ebenen)`)
    const data = [`data-tree="${escape(JSON.stringify(tree))}"`]
    if (/^[1-6]$/.test(attrs.fold ?? '')) data.push(`data-fold="${attrs.fold}"`)
    if (/^\d+$/.test(attrs.height ?? '')) data.push(`style="--markmap-height:${attrs.height}px"`)
    return { html: `<div class="markmap-block" ${data.join(' ')}><div class="markmap-src"><ul><li>${tree.content}${listHtml(tree.children)}</li></ul></div></div>`, steps: [] }
  },
}
