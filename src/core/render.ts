// Render-Plugins: mdast-Blöcke eines Knotens → HTML je Sub-Slide.

import fs from 'node:fs'
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
  /** alle lokalen Bilder als Data-URI einbetten (deck.yaml: embedImages) */
  embedImages?: boolean
  /** Hinweise, z. B. fehlende Bilder */
  warnings?: string[]
}

export interface CodeBlockPlugin {
  /** Info-String-Sprachen, für die das Plugin zuständig ist */
  langs: string[]
  render(node: Code, attrs: Record<string, string>, ctx: RenderContext): Promise<BlockResult> | BlockResult
}

/** relativ, damit der statische Build auch in Unterverzeichnissen läuft */
export const ASSET_PREFIX = 'deck-assets/'

export const IMAGE_MIME: Record<string, string> = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
}

export function toDataUri(file: string): string {
  const type = IMAGE_MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
}

/** Web-URL (http:, data:, /pfad, #anker) statt Dateipfad? Windows-Laufwerke (C:\…) zählen als Dateipfad. */
const isUrl = (url: string) => !/^[a-z]:[\\/]/i.test(url) && /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url)

/**
 * Lokales Bild auflösen: im Deck-Ordner → deck-assets/ (der Build kopiert die Datei),
 * außerhalb des Decks oder mit embedImages → Base64-Data-URI.
 */
function resolveImage(url: string, ctx: RenderContext): string {
  if (isUrl(url)) return url
  const abs = path.resolve(path.dirname(ctx.file), decodeURI(url))
  if (!fs.existsSync(abs)) {
    ctx.warnings?.push(`Bild nicht gefunden: ${url} (${path.relative(ctx.deckDir, ctx.file)})`)
    return url
  }
  const rel = path.relative(ctx.deckDir, abs)
  if (ctx.embedImages || rel.startsWith('..') || path.isAbsolute(rel)) return toDataUri(abs)
  ctx.assets.add(abs)
  return ASSET_PREFIX + rel.split(path.sep).map(encodeURIComponent).join('/')
}

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

/**
 * `steps="3-4|5-7||8"` → Zeilennummer → Schritt (1-basiert). Jeder `|`-Abschnitt ist ein Schritt,
 * leere Abschnitte sind erlaubt (Schritt ohne Änderung). Zeilen ohne Schritt sind immer sichtbar.
 */
export function parseLineSteps(spec: string): Map<number, number> {
  const map = new Map<number, number>()
  spec.split('|').forEach((segment, i) => {
    for (const part of segment.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [from, to = from] = part.split('-').map(Number)
      for (let line = from; line <= to; line++) if (!map.has(line)) map.set(line, i + 1)
    }
  })
  return map
}

export const shikiPlugin: CodeBlockPlugin = {
  langs: ['*'],
  async render(node, attrs) {
    const lang = node.lang && node.lang in bundledLanguages ? node.lang : 'text'
    const h = await getHighlighter(lang)
    const lineSteps = attrs.steps ? parseLineSteps(attrs.steps) : undefined
    let html = h.codeToHtml(node.value, {
      lang,
      theme: 'strata',
      transformers: lineSteps
        ? [{ line(el, line) { const step = lineSteps.get(line); if (step) el.properties['data-step'] = String(step) } }]
        : [],
    })
    if (attrs.lines) html = html.replace('<pre ', `<pre data-lines="${escape(attrs.lines)}" `)
    const title = attrs.title ? `<figcaption>${escape(attrs.title)}</figcaption>` : ''
    return { html: `<figure class="code-block">${title}${html}</figure>`, steps: [] }
  },
}

// ---------- Mermaid (wird im Client gerendert) ----------

const STEP_MARKER = /^\s*%%\s*step\b.*$/i

/**
 * Teilt Mermaid-Quelltext an `%% step`-Zeilen in kumulative Versionen:
 * Version 0 = alles vor dem ersten Marker, Version k = zusätzlich die ersten k Abschnitte.
 */
export function mermaidVersions(src: string): string[] {
  const sections: string[][] = [[]]
  for (const line of src.split(/\r?\n/)) {
    if (STEP_MARKER.test(line)) sections.push([])
    else sections[sections.length - 1].push(line)
  }
  return sections.map((_, k) => sections.slice(0, k + 1).flat().join('\n'))
}

export const mermaidPlugin: CodeBlockPlugin = {
  langs: ['mermaid'],
  render(node) {
    const versions = mermaidVersions(node.value)
    // eine Version pro Schritt: sichtbar von Schritt k bis vor Schritt k+1
    const sources = versions.length === 1
      ? `<pre class="mermaid-src">${escape(node.value)}</pre>`
      : versions.map((v, k) =>
          `<pre class="mermaid-src" data-step="${k}"${k < versions.length - 1 ? ` data-until="${k + 1}"` : ''}>${escape(v)}</pre>`).join('')
    return { html: `<div class="mermaid-block">${sources}</div>`, steps: [] }
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

/** `![](x.png){width=60% .rund}`: Attribute im Text direkt nach dem Bild */
function imageAttrs(node: AnyNode, index: number, parent: AnyNode) {
  const next = parent.children?.[index + 1] as { type: string; value: string } | undefined
  const m = next?.type === 'text' ? next.value.match(/^\{([^{}]*)\}/) : null
  if (!m) return
  next!.value = next!.value.slice(m[0].length)
  const attrs = parseAttrs(m[1])
  const props: Record<string, unknown> = {}
  const style: string[] = []
  for (const key of ['width', 'height']) {
    const v = attrs[key]
    if (v) style.push(`${key}:${/^\d+$/.test(v) ? `${v}px` : v}`)
  }
  if (attrs.style) style.push(attrs.style)
  if (style.length) props.style = style.join(';')
  if (attrs.class) props.className = attrs.class.split(/\s+/)
  if (attrs.id) props.id = attrs.id
  const existing = (node.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties
  node.data = { ...node.data, hProperties: { ...existing, ...props } }
}

/** `::: steps`: jeder Listenpunkt (bzw. jeder andere Block) erscheint in einem eigenen Schritt. */
function markSteps(children: AnyNode[], start: number) {
  let step = start
  const mark = (n: AnyNode) => {
    const data = (n.data ??= {}) as { hProperties?: Record<string, unknown> }
    data.hProperties = { ...data.hProperties, dataStep: String(step++) }
  }
  for (const child of children) {
    if (child.type === 'list') (child.children ?? []).forEach(mark)
    else mark(child)
  }
}

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
      if (node.name === 'steps') markSteps(node.children ?? [], Number(attrs.start ?? 1))
      // hProperties zusammenführen: ein äußeres `::: steps` kann schon data-step gesetzt haben
      const existing = (node.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties
      node.data = { ...node.data, hName: 'div', hProperties: { ...existing, ...props } }
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
      img.url = resolveImage(img.url, ctx)
      if (parent && index !== undefined) imageAttrs(node, index, parent)
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
  const html = String(toHtml.stringify(hast)).trim()

  // Schritte der Folie = höchster `data-step` über alle Blöcke; gleiche Nummer = gleichzeitig
  const count = Math.max(0, ...[...html.matchAll(/data-step="(\d+)"/g)].map((m) => Number(m[1])))
  for (let k = 1; k <= count; k++) steps.push({ selector: `[data-step="${k}"]`, state: { visible: 'true' } })
  return { html, steps }
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
