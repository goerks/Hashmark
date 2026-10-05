// Markdown → mdast → roher Knotenbaum (noch ohne HTML).

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkDirective from 'remark-directive'
import { toString } from 'mdast-util-to-string'
import { visit, SKIP } from 'unist-util-visit'
import type { Definition, Heading, Image, Link, Root, RootContent, PhrasingContent, Text } from 'mdast'
import { normalizeContainers, parseAttrs, splitHeadingAttrs } from './syntax.ts'
import { protectMath } from './math.ts'

export interface RawNode {
  title: string
  /** Überschriften-Ebene relativ zur Datei (für die Stack-Logik) */
  level: number
  depth: number
  attrs: Record<string, string>
  content: RootContent[]
  children: RawNode[]
  source: { file: string; line: number }
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']).use(remarkDirective)

export function parseMarkdown(markdown: string): Root {
  const root = parser.parse(protectMath(normalizeContainers(markdown)))
  fixSetextBreaks(root, markdown)
  resolveReferences(root)
  return root
}

/**
 * `---` direkt unter einer Textzeile ist in CommonMark eine Setext-Überschrift (H2).
 * In Präsentationen ist fast immer ein Folientrenner gemeint → Absatz + Trenner.
 * Arbeitet nach dem Parsen, damit Zeilennummern (Editor-Sync) stimmen.
 */
function fixSetextBreaks(root: Root, markdown: string) {
  const lines = markdown.split(/\r?\n/)
  root.children = root.children.flatMap((node): RootContent[] => {
    const pos = node.position
    if (node.type !== 'heading' || node.depth !== 2 || !pos || pos.start.line === pos.end.line) return [node]
    if (!/^ {0,3}-+\s*$/.test(lines[pos.end.line - 1] ?? '')) return [node]
    const breakStart = { line: pos.end.line, column: 1 }
    return [
      { type: 'paragraph', children: node.children, position: { start: pos.start, end: { line: pos.end.line - 1, column: 1 } } },
      { type: 'thematicBreak', position: { start: breakStart, end: pos.end } },
    ]
  })
}

/**
 * Löst `![Logo][logo]` / `[Text][ref]` mit `[logo]: data:image/png;base64,…` dateiweit auf.
 * Nötig, weil jede Folie später einzeln gerendert wird und Definitionen sonst fehlen.
 */
function resolveReferences(root: Root) {
  const defs = new Map<string, Definition>()
  visit(root, 'definition', (d) => { if (!defs.has(d.identifier)) defs.set(d.identifier, d) })
  if (!defs.size) return
  visit(root, (node, index, parent) => {
    if (!parent || index === undefined) return
    if (node.type === 'definition') {
      parent.children.splice(index, 1)
      return [SKIP, index]
    }
    if (node.type === 'imageReference' || node.type === 'linkReference') {
      const d = defs.get(node.identifier)
      if (!d) return
      const replacement = node.type === 'imageReference'
        ? ({ type: 'image', url: d.url, title: d.title, alt: node.alt, position: node.position } satisfies Image)
        : ({ type: 'link', url: d.url, title: d.title, children: node.children, position: node.position } satisfies Link)
      ;(parent.children as RootContent[])[index] = replacement
    }
  })
}

/** Entfernt `{…}` am Ende der Überschrift und liefert die Attribute. */
function headingAttrs(heading: Heading): Record<string, string> {
  const last = heading.children[heading.children.length - 1] as PhrasingContent | undefined
  if (last?.type !== 'text') return {}
  const { text, attrs } = splitHeadingAttrs((last as Text).value)
  if (attrs === null) return {}
  ;(last as Text).value = text
  if (!text) heading.children.pop()
  return parseAttrs(attrs)
}

export interface BuildOptions {
  file: string
  /** Baumtiefe, die die oberste Überschrift der Datei bekommt */
  baseDepth: number
  maxDepth: number
}

/**
 * Baut aus einer Datei die Knoten. Die oberste vorkommende Überschriften-Ebene der Datei
 * wird auf `baseDepth` gelegt (`under` verschiebt damit automatisch). Überschriften tiefer
 * als `maxDepth` bleiben Abschnitte innerhalb der Folie.
 */
export function buildNodes(root: Root, opts: BuildOptions): RawNode[] {
  const headings = root.children.filter((n): n is Heading => n.type === 'heading')
  const minLevel = Math.min(...headings.map((h) => h.depth))
  const top: RawNode[] = []
  const stack: RawNode[] = []
  const preamble: RootContent[] = []

  for (const block of root.children) {
    if (block.type === 'yaml') continue
    if (block.type === 'heading') {
      const level = block.depth - minLevel + 1
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
      const parent = stack[stack.length - 1]
      const depth = parent ? parent.depth + 1 : opts.baseDepth
      if (depth > opts.maxDepth && parent) {
        // Abschnitt innerhalb der Folie: h2 für die erste Ebene unterhalb der Folie
        block.depth = Math.min(6, 2 + (level - parent.level - 1)) as Heading['depth']
        headingAttrs(block)
        parent.content.push(block)
        continue
      }
      const attrs = headingAttrs(block)
      const node: RawNode = {
        title: toString(block).trim(),
        level,
        depth,
        attrs,
        content: [],
        children: [],
        source: { file: opts.file, line: block.position?.start.line ?? 1 },
      }
      if (!parent && !top.length) node.content.push(...preamble)
      ;(parent ? parent.children : top).push(node)
      stack.push(node)
      continue
    }
    const current = stack[stack.length - 1]
    if (current) current.content.push(block)
    else preamble.push(block)
  }

  if (!top.length && preamble.length) {
    // Datei ohne Überschrift: ein Knoten mit dem Dateinamen als Titel
    const name = opts.file.split(/[\\/]/).pop()!.replace(/\.md$/i, '')
    top.push({ title: name, level: 1, depth: opts.baseDepth, attrs: {}, content: preamble, children: [], source: { file: opts.file, line: 1 } })
  }
  return top
}
