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
export function resolveImage(url: string, ctx: RenderContext): string {
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

/**
 * `lines="2-3|5|all"` → je `|`-Abschnitt die hervorgehobenen Zeilen. Abschnitt k gilt ab Schritt k
 * (Abschnitt 0 sofort). `all`, `*` oder leer = nichts abdunkeln. `null` = alle Zeilen.
 */
export function parseLineHighlights(spec: string): (Set<number> | null)[] {
  return spec.split('|').map((segment) => {
    const s = segment.trim()
    if (!s || s === 'all' || s === '*') return null
    const lines = new Set<number>()
    for (const part of s.split(',').map((p) => p.trim()).filter(Boolean)) {
      const [from, to = from] = part.split('-').map(Number)
      for (let line = from; line <= to; line++) lines.add(line)
    }
    return lines
  })
}

export const shikiPlugin: CodeBlockPlugin = {
  langs: ['*'],
  async render(node, attrs) {
    const lang = node.lang && node.lang in bundledLanguages ? node.lang : 'text'
    const h = await getHighlighter(lang)
    const lineSteps = attrs.steps ? parseLineSteps(attrs.steps) : undefined
    const highlights = attrs.lines ? parseLineHighlights(attrs.lines) : undefined
    let html = h.codeToHtml(node.value, {
      lang,
      theme: 'strata',
      transformers: [{
        line(el, line) {
          const step = lineSteps?.get(line)
          if (step) el.properties['data-step'] = String(step)
          // Abschnitte, in denen die Zeile hervorgehoben ist, z. B. " 0 2 "
          const hl = highlights?.flatMap((set, k) => (set?.has(line) ? [k] : []))
          if (hl?.length) el.properties['data-hl'] = ` ${hl.join(' ')} `
        },
      }],
    })
    if (highlights) {
      // Abschnitte ohne Abdunkeln (all) und Anzahl Abschnitte für die Runtime; Abschnitte 1… sind Schritte
      const all = highlights.flatMap((set, k) => (set ? [] : [k]))
      html = html.replace('<pre ', `<pre data-lines="${escape(attrs.lines)}" data-hl-count="${highlights.length}" data-hl-all=" ${all.join(' ')} " `)
    }
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

/** `cols=3` → 3 gleiche Spalten, `cols="2:1"` → 2fr 1fr, sonst CSS unverändert (`"2fr 1fr"`, `"300px 1fr"`). */
export function gridColumns(cols: string): string {
  if (/^\d+$/.test(cols)) return `repeat(${cols},minmax(0,1fr))`
  if (/^\d+(\.\d+)?(:\d+(\.\d+)?)+$/.test(cols)) return cols.split(':').map((c) => `minmax(0,${c}fr)`).join(' ')
  return cols
}

/** GitHub-Hinweiskästen `> [!NOTE]` … und ihre deutschen Standard-Titel */
const CALLOUTS: Record<string, string> = { note: 'Hinweis', tip: 'Tipp', important: 'Wichtig', warning: 'Warnung', caution: 'Achtung' }
const CALLOUT_MARK = /^\[!(\w+)\][ \t]*([^\n]*)\n?/

/** `> [!WARNING] Eigener Titel` → `<div class="callout callout-warning">` mit Titelzeile */
function applyCallout(node: AnyNode) {
  const first = node.children?.[0]
  const text = first?.type === 'paragraph' ? (first.children?.[0] as { type: string; value: string } | undefined) : undefined
  const m = text?.type === 'text' ? text.value.match(CALLOUT_MARK) : null
  if (!m || !(m[1].toLowerCase() in CALLOUTS)) return
  const kind = m[1].toLowerCase()
  text!.value = text!.value.slice(m[0].length)
  // Absatz, der nur aus der Markierung bestand, entfernen
  if (!text!.value && first!.children!.length === 1) node.children!.shift()
  else if (!text!.value) first!.children!.shift()
  const title = { type: 'paragraph', children: [{ type: 'text', value: m[2].trim() || CALLOUTS[kind] }], data: { hProperties: { className: ['callout-title'] } } }
  node.children!.unshift(title as AnyNode)
  node.data = { ...node.data, hName: 'div', hProperties: { className: ['callout', `callout-${kind}`] } }
}

function applyDirectives(root: Root, ctx: RenderContext) {
  visit(root, (node: AnyNode, index, parent: AnyNode | undefined) => {
    if (node.type === 'blockquote') applyCallout(node)
    if (node.type === 'containerDirective') {
      const attrs = node.attributes ?? {}
      const props: Record<string, unknown> = { className: [`d-${node.name}`, ...(attrs.class ? attrs.class.split(/\s+/) : [])] }
      if (node.name === 'grid' || node.name === 'columns') {
        const style: string[] = []
        // Spalten mit fester Anzahl brechen in die nächste Zeile um, statt weitere Spalten anzuhängen
        if (attrs.cols) style.push(`grid-template-columns:${gridColumns(attrs.cols)}`, 'grid-auto-flow:row')
        if (attrs.gap) style.push(`gap:${/^[\d.]+$/.test(attrs.gap) ? `${attrs.gap}rem` : attrs.gap}`)
        if (style.length) props.style = style.join(';')
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

/**
 * Entfernt `:::notes`-Container und alles nach `<!-- notes -->`; liefert beides als Notiz-Blöcke.
 * `::: notes step=2` bleibt als Container erhalten und wird zu `<div data-note-step="2">`.
 */
function extractNotes(blocks: AnyNode[]): { content: AnyNode[]; notes: AnyNode[] } {
  const content: AnyNode[] = []
  const notes: AnyNode[] = []
  let inNotes = false
  for (const b of blocks) {
    if (b.type === 'html' && /^<!--\s*notes\s*-->$/i.test((b as { value: string }).value.trim())) { inNotes = true; continue }
    if (inNotes) notes.push(b)
    else if (b.type === 'containerDirective' && b.name === 'notes') {
      const step = b.attributes?.step
      if (step && /^\d+$/.test(step)) {
        // wird in applyDirectives zu <div class="d-note-step" data-note-step="2">
        b.data = { hProperties: { dataNoteStep: step } }
        b.name = 'note-step'
        notes.push(b)
      } else notes.push(...(b.children ?? []))
    } else content.push(b)
  }
  return { content, notes }
}

// ---------- Bild-Layouts ----------

/** Absatz, der nur aus einem Bild besteht (plus Attribut-Text `{width=…}` bzw. Leerraum) */
function isImageBlock(b: AnyNode): boolean {
  if (b.type !== 'paragraph') return false
  const kids = b.children ?? []
  const images = kids.filter((k) => k.type === 'image')
  const rest = kids.filter((k) => k.type !== 'image')
  return images.length === 1 && rest.every((k) => k.type === 'text' && /^\s*(\{[^{}]*\})?\s*$/.test((k as { value: string }).value))
}

/** `image-left`/`image-right`: das erste Bild bzw. Diagramm wandert in die Bildspalte, der Rest daneben. */
function splitMedia(blocks: AnyNode[]): { media: AnyNode[]; body: AnyNode[] } | null {
  const i = blocks.findIndex((b) => isImageBlock(b) || (b.type === 'code' && (b as unknown as Code).lang === 'mermaid'))
  if (i < 0) return null
  return { media: [blocks[i]], body: blocks.filter((_, k) => k !== i) }
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

  // Schritte der Folie = höchster `data-step` über alle Blöcke; gleiche Nummer = gleichzeitig.
  // Code mit `lines="a|b|c"` braucht Schritte bis zur Anzahl Abschnitte − 1.
  const count = Math.max(0,
    ...[...html.matchAll(/data-step="(\d+)"/g)].map((m) => Number(m[1])),
    ...[...html.matchAll(/data-hl-count="(\d+)"/g)].map((m) => Number(m[1]) - 1))
  for (let k = 1; k <= count; k++) steps.push({ selector: `[data-step="${k}"]`, state: { visible: 'true' } })
  return { html, steps }
}

/** Sub-Slide rendern; bei Bild-Layouts in Bildspalte (`.media`) und Text (`.body`) geteilt. */
async function renderSlide(blocks: AnyNode[], ctx: RenderContext, layout?: string): Promise<Slide> {
  const split = layout === 'image-left' || layout === 'image-right' ? splitMedia(blocks) : null
  if (!split) return blocksToHtml(blocks, ctx)
  const media = await blocksToHtml(split.media, ctx)
  const body = await blocksToHtml(split.body, ctx)
  const html = `<div class="media">${media.html}</div><div class="body">${body.html}</div>`
  return { html, steps: media.steps.length >= body.steps.length ? media.steps : body.steps }
}

/** Rendert den Inhalt eines Knotens: `---` trennt Sub-Slides. `layout` = wirksames Layout des Knotens. */
export async function renderNodeContent(blocks: RootContent[], ctx: RenderContext, layout?: string): Promise<{ slides: Slide[]; notes?: string }> {
  const groups: AnyNode[][] = [[]]
  for (const b of blocks as AnyNode[]) {
    if (b.type === 'thematicBreak') groups.push([])
    else groups[groups.length - 1].push(b)
  }
  const parts = groups.map(extractNotes)
  // `---` am Ende eines Knotens bzw. direkt vor der nächsten Überschrift ergäbe eine leere Sub-Slide,
  // die nur den Titel wiederholt → nachgestellte leere Abschnitte verwerfen (Notizen bleiben erhalten).
  // Eine leere *erste* Folie (reiner Titel, dann `---`) ist dagegen gewollt und bleibt.
  while (parts.length > 1 && parts[parts.length - 1].content.length === 0) {
    const dropped = parts.pop()!
    parts[parts.length - 1].notes.push(...dropped.notes)
  }
  const slides: Slide[] = []
  const notes: string[] = []
  for (const { content, notes: n } of parts) {
    const slide = await renderSlide(content, ctx, layout)
    if (n.length) {
      slide.notes = (await blocksToHtml(n, ctx)).html
      notes.push(slide.notes)
    }
    slides.push(slide)
  }
  return { slides, notes: notes.length ? notes.join('\n<hr>\n') : undefined }
}
