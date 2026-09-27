// Markdown → mdast → roher Knotenbaum (noch ohne HTML).

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkDirective from 'remark-directive'
import { toString } from 'mdast-util-to-string'
import type { Heading, Root, RootContent, PhrasingContent, Text } from 'mdast'
import { normalizeContainers, parseAttrs, splitHeadingAttrs } from './syntax.ts'

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
  return parser.parse(normalizeContainers(markdown))
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
