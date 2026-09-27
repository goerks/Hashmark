// Render-Plugins: mdast-Blöcke eines Knotens → HTML je Sub-Slide.

import path from 'node:path'
import { unified } from 'unified'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { visit, SKIP } from 'unist-util-visit'
import { bundledLanguages, createCssVariablesTheme, createHighlighter, type Highlighter } from 'shiki'
import type { Root, RootContent, Code } from 'mdast'
import { parseAttrs } from './syntax.ts'
import type { Slide } from './types.ts'

/** Ergebnis eines Code-Block-Plugins (siehe Konzept: `render(node, ctx) → {html, steps}`). */
export interface BlockResult { html: string; steps: Slide['steps'] }

export interface RenderContext {
  /** Markdown-Datei, aus der die Blöcke stammen */
  file: string
  /** Wurzel des Decks (für Asset-URLs) */
  deckDir: string
  /** gesammelte lokale Assets (absolute Pfade) */
  assets: Set<string>
}

export interface CodeBlockPlugin {
  /** Info-String-Sprachen, für die das Plugin zuständig ist */
  langs: string[]
  render(node: Code, attrs: Record<string, string>, ctx: RenderContext): Promise<BlockResult> | BlockResult
}

/** relativ, damit der statische Build auch in Unterverzeichnissen läuft */
export const ASSET_PREFIX = 'deck-assets/'

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- Shiki ----------

const cssVarTheme = createCssVariablesTheme({ name: 'strata', variablePrefix: '--shiki-', fontStyle: true })
let highlighter: Promise<Highlighter> | undefined

async function getHighlighter(lang: string) {
  highlighter ??= createHighlighter({ themes: [cssVarTheme], langs: [] })
  const h = await highlighter
  if (lang !== 'text' && !h.getLoadedLanguages().includes(lang)) await h.loadLanguage(lang as keyof typeof bundledLanguages)
  return h
}

export const shikiPlugin: CodeBlockPlugin = {
  langs: ['*'],
  async render(node, attrs) {
    const lang = node.lang && node.lang in bundledLanguages ? node.lang : 'text'
    const h = await getHighlighter(lang)
    let html = h.codeToHtml(node.value, { lang, theme: 'strata' })
    if (attrs.lines) html = html.replace('<pre ', `<pre data-lines="${escape(attrs.lines)}" `)
    const title = attrs.title ? `<figcaption>${escape(attrs.title)}</figcaption>` : ''
    return { html: `<figure class="code-block">${title}${html}</figure>`, steps: [] }
  },
}

// ---------- Mermaid (wird im Client gerendert) ----------

export const mermaidPlugin: CodeBlockPlugin = {
  langs: ['mermaid'],
  render(node) {
    return { html: `<div class="mermaid-block"><pre class="mermaid-src">${escape(node.value)}</pre></div>`, steps: [] }
  },
}

const plugins: CodeBlockPlugin[] = [mermaidPlugin, shikiPlugin]

function findPlugin(lang: string | null | undefined) {
  return plugins.find((p) => p.langs.includes(lang ?? '')) ?? plugins.find((p) => p.langs.includes('*'))!
}

/** `ts {lines="3-5|8" title="auth.ts"}` → Meta steht nach der Sprache */
function codeAttrs(meta: string | null | undefined) {
  if (!meta) return {}
  const m = meta.match(/\{(.*)\}/)
  return parseAttrs(m ? m[1] : meta)
}

// ---------- Direktiven ----------

type AnyNode = RootContent & { name?: string; attributes?: Record<string, string>; data?: Record<string, unknown>; children?: AnyNode[] }

function applyDirectives(root: Root, ctx: RenderContext) {
  visit(root, (node: AnyNode, index, parent: AnyNode | undefined) => {
    if (node.type === 'containerDirective') {
      const attrs = node.attributes ?? {}
      const props: Record<string, unknown> = { className: [`d-${node.name}`, ...(attrs.class ? attrs.class.split(/\s+/) : [])] }
      if (node.name === 'grid') {
        const style: string[] = []
        if (attrs.cols) style.push(`grid-template-columns:${/^\d+$/.test(attrs.cols) ? `repeat(${attrs.cols},1fr)` : attrs.cols}`)
        if (attrs.gap) style.push(`gap:${/^[\d.]+$/.test(attrs.gap) ? `${attrs.gap}rem` : attrs.gap}`)
        props.style = style.join(';')
      }
      if (node.name === 'children') props.dataChildren = ''
      node.data = { ...node.data, hName: 'div', hProperties: props }
      return
    }
    // Leaf-/Text-Direktiven sind im MVP nicht belegt → wieder als Text ausgeben
    if ((node.type === 'textDirective' || node.type === 'leafDirective') && parent && index !== undefined) {
      const colons = node.type === 'textDirective' ? ':' : '::'
      const text = { type: 'text', value: colons + node.name } as RootContent
      const replacement = node.type === 'leafDirective'
        ? [{ type: 'paragraph', children: [text, ...(node.children ?? [])] } as RootContent]
        : [text, ...((node.children ?? []) as RootContent[])]
      parent.children!.splice(index, 1, ...(replacement as AnyNode[]))
      return [SKIP, index]
    }
    if (node.type === 'image') {
      const img = node as unknown as { url: string }
      if (!/^([a-z]+:|\/|#|data:)/i.test(img.url)) {
        const abs = path.resolve(path.dirname(ctx.file), decodeURI(img.url))
        const rel = path.relative(ctx.deckDir, abs)
        if (!rel.startsWith('..')) {
          ctx.assets.add(abs)
          img.url = ASSET_PREFIX + rel.split(path.sep).map(encodeURIComponent).join('/')
        }
      }
    }
  })
}

// ---------- Notizen ----------

/** Entfernt `:::notes`-Container und alles nach `<!-- notes -->`; liefert beides als Notiz-Blöcke. */
function extractNotes(blocks: AnyNode[]): { content: AnyNode[]; notes: AnyNode[] } {
  const content: AnyNode[] = []
  const notes: AnyNode[] = []
  let inNotes = false
  for (const b of blocks) {
    if (b.type === 'html' && /^<!--\s*notes\s*-->$/i.test((b as { value: string }).value.trim())) { inNotes = true; continue }
    if (inNotes) notes.push(b)
    else if (b.type === 'containerDirective' && b.name === 'notes') notes.push(...(b.children ?? []))
    else content.push(b)
  }
  return { content, notes }
}

// ---------- Pipeline ----------

const toHtml = unified().use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true })

async function blocksToHtml(blocks: AnyNode[], ctx: RenderContext): Promise<{ html: string; steps: Slide['steps'] }> {
  const root: Root = { type: 'root', children: structuredClone(blocks) as RootContent[] }
  const steps: Slide['steps'] = []

  const codes: { node: Code; parent: AnyNode; index: number }[] = []
  visit(root, 'code', (node, index, parent) => { codes.push({ node, parent: parent as AnyNode, index: index! }) })
  for (const { node, parent, index } of codes) {
    const result = await findPlugin(node.lang).render(node, codeAttrs(node.meta), ctx)
    steps.push(...result.steps)
    parent.children![index] = { type: 'html', value: result.html } as AnyNode
  }

  applyDirectives(root, ctx)
  const hast = await toHtml.run(root)
  return { html: String(toHtml.stringify(hast)).trim(), steps }
}

/** Rendert den Inhalt eines Knotens: `---` trennt Sub-Slides. */
export async function renderNodeContent(blocks: RootContent[], ctx: RenderContext): Promise<{ slides: Slide[]; notes?: string }> {
  const groups: AnyNode[][] = [[]]
  for (const b of blocks as AnyNode[]) {
    if (b.type === 'thematicBreak') groups.push([])
    else groups[groups.length - 1].push(b)
  }
  const slides: Slide[] = []
  const notes: string[] = []
  for (const group of groups) {
    const { content, notes: n } = extractNotes(group)
    slides.push(await blocksToHtml(content, ctx))
    if (n.length) notes.push((await blocksToHtml(n, ctx)).html)
  }
  return { slides, notes: notes.length ? notes.join('\n<hr>\n') : undefined }
}
