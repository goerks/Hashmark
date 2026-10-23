// Render-Plugins: mdast-Blöcke eines Knotens → HTML je Sub-Slide.

import fs from 'node:fs'
import path from 'node:path'
import { unified } from 'unified'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { visit, SKIP } from 'unist-util-visit'
import qrcode from 'qrcode-generator'
import { bundledLanguages, createCssVariablesTheme, createHighlighter, type Highlighter } from 'shiki'
import type { Root, RootContent, Code } from 'mdast'
import { expandComponent, type Template } from './components.ts'
import { drawioSteps } from './drawio.ts'
import { excalidrawSteps } from './excalidraw.ts'
import { ICON_NAMES, iconSvg } from './icons.ts'
import { MAX_EMBED_BYTES, VIDEO_ATTRS, VIDEO_MIME, isVideoUrl, mediaName, videoProps } from './media.ts'
import { renderMath, renderTex } from './math.ts'
import { nearest } from './vocab.ts'
import { svgIdSteps } from './svg-steps.ts'
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
  /** alle Bilder mit Z vergrößerbar machen (deck.yaml: zoom) */
  zoomImages?: boolean
  /** Hinweise, z. B. fehlende Bilder */
  warnings?: string[]
  /** Vorlagen eigener Container (`components/*.html`) */
  components?: Record<string, Template>
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

/** Bilder und Videos, die der Deck-Ordner ausliefert */
export const MEDIA_MIME: Record<string, string> = { ...IMAGE_MIME, ...VIDEO_MIME }

export function toDataUri(file: string): string {
  const type = MEDIA_MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
}

/** Web-URL (http:, data:, /pfad, #anker) statt Dateipfad? Windows-Laufwerke (C:\…) zählen als Dateipfad. */
const isUrl = (url: string) => !/^[a-z]:[\\/]/i.test(url) && /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url)

/**
 * Lokales Bild bzw. Video auflösen: im Deck-Ordner → deck-assets/ (der Build kopiert die Datei),
 * außerhalb des Decks oder mit embedImages → Base64-Data-URI.
 * Videos werden nie wegen `embedImages` eingebettet (sie sind groß): außerhalb des Decks nur bis 25 MB, im Einzel-HTML-Export entscheidet `embedMedia`.
 */
export function resolveImage(url: string, ctx: RenderContext): string {
  if (isUrl(url)) return url
  const abs = path.resolve(path.dirname(ctx.file), decodeURI(url))
  const where = path.relative(ctx.deckDir, ctx.file)
  if (!fs.existsSync(abs)) {
    ctx.warnings?.push(`${mediaName(url)} nicht gefunden: ${url} (${where})`)
    return url
  }
  const rel = path.relative(ctx.deckDir, abs)
  const outside = rel.startsWith('..') || path.isAbsolute(rel)
  if (isVideoUrl(abs)) {
    if (outside) {
      if (fs.statSync(abs).size > MAX_EMBED_BYTES) {
        ctx.warnings?.push(`Video liegt außerhalb des Decks und ist größer als ${MAX_EMBED_BYTES / 1024 / 1024} MB, es lässt sich nicht einbinden: ${url} (${where}). In den Deck-Ordner legen.`)
        return url
      }
      return toDataUri(abs)
    }
  } else if (ctx.embedImages || outside) return toDataUri(abs)
  ctx.assets.add(abs)
  return ASSET_PREFIX + rel.split(path.sep).map(encodeURIComponent).join('/')
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- Shiki ----------

const cssVarTheme = createCssVariablesTheme({ name: 'hashmark', variablePrefix: '--shiki-', fontStyle: true })
let highlighter: Promise<Highlighter> | undefined

async function getHighlighter(lang: string) {
  highlighter ??= createHighlighter({ themes: [cssVarTheme], langs: [] })
  const h = await highlighter
  if (lang !== 'text' && !h.getLoadedLanguages().includes(lang)) await h.loadLanguage(lang as keyof typeof bundledLanguages)
  return h
}

/** Shiki vorab starten (WASM-Engine, ~0,5 s) – die Desktop-App tut das im Hintergrund, bevor ein Deck geöffnet wird */
export async function warmHighlighter(langs: string[] = []): Promise<void> {
  for (const lang of ['text', ...langs]) await getHighlighter(lang in bundledLanguages ? lang : 'text')
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
      theme: 'hashmark',
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

/**
 * Codeblock `mermaid` mit `{height=520 look=hand align=left}`: `height` = maximale Höhe in px (Standard 460),
 * `look=hand` = Skizzen-Stil, `align=left|center`.
 */
export const mermaidPlugin: CodeBlockPlugin = {
  langs: ['mermaid'],
  render(node, attrs, ctx) {
    const warn = (m: string) => ctx.warnings?.push(`Mermaid: ${m} (${path.relative(ctx.deckDir, ctx.file)})`)
    for (const key of Object.keys(attrs)) if (!['height', 'look', 'align'].includes(key)) warn(`Attribut „${key}“ ist unbekannt (height, look, align)`)
    if (attrs.height !== undefined && !/^\d+$/.test(attrs.height)) warn(`height="${attrs.height}" ist ungültig (Pixel, z. B. height=520)`)
    if (attrs.look !== undefined && !/^(hand|handdrawn|sketch|classic)$/i.test(attrs.look)) warn(`look="${attrs.look}" ist ungültig (hand | classic)`)
    if (attrs.align !== undefined && !ALIGNS.includes(attrs.align)) warn(`align="${attrs.align}" ist ungültig (left | center)`)
    const versions = mermaidVersions(node.value)
    // eine Version pro Schritt: sichtbar von Schritt k bis vor Schritt k+1
    const sources = versions.length === 1
      ? `<pre class="mermaid-src">${escape(node.value)}</pre>`
      : versions.map((v, k) =>
          `<pre class="mermaid-src" data-step="${k}"${k < versions.length - 1 ? ` data-until="${k + 1}"` : ''}>${escape(v)}</pre>`).join('')
    const data: string[] = []
    if (attrs.look) data.push(`data-look="${escape(attrs.look)}"`)
    if (attrs.align) data.push(`data-align="${escape(attrs.align)}"`)
    if (/^\d+$/.test(attrs.height ?? '')) data.push(`style="--mermaid-max:${attrs.height}px"`)
    return { html: `<div class="mermaid-block"${data.length ? ` ${data.join(' ')}` : ''}>${sources}</div>`, steps: [] }
  },
}

/**
 * QR-Code als Inline-SVG (Farbe = Textfarbe), ohne externen Dienst: Codeblock mit Sprache `qr`, die Adresse im Block,
 * Attribute `size` (px) und `label`.
 */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
  return `<svg class="qr-svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="QR-Code"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}

export const qrPlugin: CodeBlockPlugin = {
  langs: ['qr'],
  render(node, attrs, ctx) {
    const warn = (m: string) => ctx.warnings?.push(`QR-Code: ${m} (${path.relative(ctx.deckDir, ctx.file)})`)
    for (const key of Object.keys(attrs)) if (!['size', 'label'].includes(key)) warn(`Attribut „${key}“ ist unbekannt (size, label)`)
    if (attrs.size !== undefined && !/^\d+$/.test(attrs.size)) warn(`size="${attrs.size}" ist ungültig (Pixel, z. B. size=220)`)
    const size = /^\d+$/.test(attrs.size ?? '') ? Number(attrs.size) : 220
    const label = attrs.label ? `<figcaption>${escape(attrs.label)}</figcaption>` : ''
    const text = node.value.trim()
    let svg: string
    if (!text) {
      warn('der Block ist leer (die Adresse gehört in den Block)')
      svg = ''
    } else {
      try { svg = qrSvg(text) } catch (e) {
        warn(`kein QR-Code möglich (${(e as Error).message})`)
        svg = ''
      }
    }
    return { html: `<figure class="qr-block" style="width:${size}px">${svg || '<p class="qr-error">QR-Code nicht erzeugt</p>'}${label}</figure>`, steps: [] }
  },
}

/** ```math: eine Formel als eigener Block (`step=2` blendet sie ab Schritt 2 ein) */
export const mathPlugin: CodeBlockPlugin = {
  langs: ['math'],
  render(node, attrs, ctx) {
    const where = path.relative(ctx.deckDir, ctx.file)
    const step = /^\d+$/.test(attrs.step ?? '') ? ` data-step="${attrs.step}"` : ''
    const until = /^\d+$/.test(attrs.until ?? '') ? ` data-until="${attrs.until}"` : ''
    return { html: `<div class="math-block"${step}${until}>${renderTex(node.value, true, { warn: (m) => ctx.warnings?.push(`${m} (${where})`) })}</div>`, steps: [] }
  },
}

const plugins: CodeBlockPlugin[] = [mermaidPlugin, qrPlugin, mathPlugin, shikiPlugin]

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
const OBJECT_FITS = ['cover', 'contain', 'fill', 'none', 'scale-down']

const ZOOM_OFF = ['off', 'false', 'no', '0']

function imageAttrs(node: AnyNode, index: number, parent: AnyNode, warn: Warn, video?: (url: string) => string, zoomDefault = false) {
  const next = parent.children?.[index + 1] as { type: string; value: string } | undefined
  const m = next?.type === 'text' ? next.value.match(/^\{([^{}]*)\}/) : null
  if (!m) {
    // `{ratio=16:9}`: der Doppelpunkt zerreißt den Text, die Attribute bleiben sichtbar stehen
    if (next?.type === 'text' && /^\{\w+=[^{}]*$/.test(next.value)) warn(`Bild-Attribute nicht lesbar: „${next.value.slice(0, 40)}…“ (kein Doppelpunkt im Wert, z. B. ratio=16/9)`)
    // ein Video braucht auch ohne Attribute seine Eigenschaften (Standbild bis zum ersten Schritt), ein Bild bei `zoom: true` im Deck das Zoom-Attribut
    if (!video && !zoomDefault) return
  }
  if (m) next!.value = next!.value.slice(m[0].length)
  const attrs = m ? parseAttrs(m[1]) : {}
  const known = ['width', 'height', 'fit', 'pos', 'ratio', 'step', 'until', 'style', 'class', 'id', ...(video ? VIDEO_ATTRS : ['zoom', 'zoomstep', 'zoomuntil'])]
  const what = video ? 'Video' : 'Bild'
  for (const key of Object.keys(attrs)) {
    if (!known.includes(key)) warn(`${what}-Attribut „${key}“ ist unbekannt (bekannt: ${known.join(', ')})`)
  }
  if (attrs.fit && !OBJECT_FITS.includes(attrs.fit)) warn(`Bild: fit="${attrs.fit}" ist ungültig (${OBJECT_FITS.join(' | ')})`)
  for (const key of ['step', 'until']) if (attrs[key] !== undefined && !/^\d+$/.test(attrs[key])) warn(`Bild: ${key}="${attrs[key]}" ist ungültig (Schrittnummer)`)
  const props: Record<string, unknown> = {}
  const style: string[] = []
  for (const key of ['width', 'height']) {
    const v = attrs[key]
    if (v) style.push(`${key}:${/^\d+$/.test(v) ? `${v}px` : v}`)
  }
  // fit=cover|contain|fill, pos="50% 20%" (object-position), ratio="16/9"
  if (attrs.fit) style.push(`object-fit:${attrs.fit}`)
  if (attrs.pos) style.push(`object-position:${attrs.pos}`)
  if (attrs.ratio) style.push(`aspect-ratio:${attrs.ratio.replace(':', '/')}`)
  if (attrs.style) style.push(attrs.style)
  if (style.length) props.style = style.join(';')
  if (/^\d+$/.test(attrs.step ?? '')) props.dataStep = attrs.step
  if (/^\d+$/.test(attrs.until ?? '')) props.dataUntil = attrs.until
  if (attrs.class) props.className = attrs.class.split(/\s+/)
  if (attrs.id) props.id = attrs.id
  if (!video) {
    // `{zoom}`: in der Präsentation mit Z (oder Klick) vergrößern; `{zoom=off}` nimmt ein Bild von `zoom: true` im Deck aus
    if (attrs.zoom !== undefined && attrs.zoom !== 'true' && !ZOOM_OFF.includes(attrs.zoom.toLowerCase())) warn(`Bild: zoom="${attrs.zoom}" ist ungültig (zoom oder zoom=off)`)
    const off = attrs.zoom !== undefined && ZOOM_OFF.includes(attrs.zoom.toLowerCase())
    // `zoomstep=2`: ab Schritt 2 fährt die Kamera von selbst aufs Bild, `zoomuntil=3`: ab Schritt 3 wieder heraus (sonst bis die Folie wechselt)
    for (const key of ['zoomstep', 'zoomuntil']) if (attrs[key] !== undefined && !/^[1-9]\d*$/.test(attrs[key])) warn(`Bild: ${key}="${attrs[key]}" ist ungültig (Schrittnummer ab 1)`)
    const zoomStep = /^[1-9]\d*$/.test(attrs.zoomstep ?? '') ? Number(attrs.zoomstep) : undefined
    const zoomUntil = /^[1-9]\d*$/.test(attrs.zoomuntil ?? '') ? Number(attrs.zoomuntil) : undefined
    if (attrs.zoomuntil !== undefined && zoomStep === undefined) warn('Bild: zoomuntil gilt nur zusammen mit zoomstep')
    if (zoomStep !== undefined && off) warn('Bild: zoomstep gilt nicht, das Bild ist mit zoom=off ausgenommen')
    if (zoomStep !== undefined && zoomUntil !== undefined && zoomUntil <= zoomStep) warn(`Bild: zoomuntil=${zoomUntil} muss nach zoomstep=${zoomStep} liegen`)
    if (zoomStep !== undefined && !off) {
      props.dataZoom = 'true'
      props.dataZoomstep = String(zoomStep)
      if (zoomUntil !== undefined && zoomUntil > zoomStep) props.dataZoomuntil = String(zoomUntil)
    } else if (attrs.zoom === undefined ? zoomDefault : !off) props.dataZoom = 'true'
  }
  if (video) {
    // `<video>` statt `<img>`: die Startzeit hängt als Medienfragment an der Adresse, das Standbild zeigt dann diese Stelle
    const img = node as unknown as { url: string; alt?: string | null }
    const v = videoProps(attrs, img.alt ?? '', warn, attrs.poster ? video(attrs.poster) : undefined)
    Object.assign(props, v.props)
    props.className = ['hm-video', ...((props.className as string[] | undefined) ?? [])]
    // ohne Startzeit `#t=0.001`: so zeigen auch Safari und WebKit das erste Bild als Standbild
    img.url = `${img.url}#t=${v.start && v.start > 0 ? v.start : 0.001}`
  }
  const existing = (node.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties
  node.data = { ...node.data, ...(video ? { hName: 'video' } : {}), hProperties: { ...existing, ...props } }
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

/**
 * `## Titel {steps}`: alle Listenpunkte der Folie erscheinen nacheinander, ohne `::: steps` um die Liste.
 * Gezählt wird die oberste Listenebene (Unterpunkte kommen mit ihrem Elternpunkt), auch in Spalten/Grids.
 * Ein ausdrückliches `::: steps` in der Folie hat Vorrang, dann passiert hier nichts.
 */
function markAutoSteps(blocks: AnyNode[]) {
  const hasSteps = (nodes: AnyNode[]): boolean =>
    nodes.some((n) => (n.type === 'containerDirective' && n.name === 'steps') || hasSteps(n.children ?? []))
  if (hasSteps(blocks)) return
  let step = 1
  const walk = (nodes: AnyNode[]) => {
    for (const n of nodes) {
      if (n.type === 'list') {
        for (const item of n.children ?? []) {
          const data = (item.data ??= {}) as { hProperties?: Record<string, unknown> }
          data.hProperties = { ...data.hProperties, dataStep: String(step++) }
        }
      } else if (n.type === 'containerDirective') walk(n.children ?? [])
    }
  }
  walk(blocks)
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

// ---------- Gestaltungs-Container: figure/bubble/frame/pin, cards/card, table, reveal ----------

type Props = Record<string, unknown>
type Warn = (message: string) => void

function addProps(node: AnyNode, props: Props) {
  const data = (node.data ??= {}) as { hProperties?: Props }
  data.hProperties = { ...data.hProperties, ...props }
}

const html = (value: string) => ({ type: 'html', value }) as unknown as AnyNode

/** Erlaubte Attribute je Gestaltungs-Container (`class` und `id` gehen immer); alles andere meldet `hashmark check` */
export const DESIGN_ATTRS: Record<string, string[]> = {
  figure: ['w', 'align'],
  bubble: ['at', 'w', 'tail', 'step', 'until'],
  frame: ['at', 'size', 'w', 'label', 'step', 'until'],
  pin: ['at', 'step', 'until'],
  cards: ['cols', 'gap', 'steps', 'start'],
  card: ['icon', 'title', 'accent', 'step', 'until'],
  table: ['widths', 'steps', 'start', 'hl'],
  reveal: ['step', 'until'],
}
const TAILS = ['none', 'left', 'right', 'up', 'down']
const ALIGNS = ['left', 'center', 'right']

/** `"x,y"` → zwei Zahlen (Prozent), sonst undefined */
function pair(v: string | undefined): [number, number] | undefined {
  const m = v?.match(/^\s*(-?[\d.]+)%?\s*[, ]\s*(-?[\d.]+)%?\s*$/)
  return m ? [Number(m[1]), Number(m[2])] : undefined
}

/** Position `at="x,y"` (Prozent der Figur bzw. Folie), Breite `w=30` bzw. `size="w,h"` */
function placement(name: string, attrs: Record<string, string>, warn: Warn): string[] {
  const style: string[] = []
  const at = pair(attrs.at)
  if (at) style.push(`left:${at[0]}%`, `top:${at[1]}%`)
  else if (name !== 'frame' || attrs.at !== undefined) {
    warn(attrs.at === undefined
      ? `::: ${name}: at fehlt (Position in Prozent, z. B. at="60,20")`
      : `::: ${name}: at="${attrs.at}" ist ungültig (erwartet "x,y" in Prozent, z. B. at="60,20")`)
  }
  const size = pair(attrs.size)
  if (attrs.size !== undefined && !size) warn(`::: ${name}: size="${attrs.size}" ist ungültig (erwartet "breite,höhe" in Prozent, z. B. size="30,20")`)
  if (size) style.push(`width:${size[0]}%`, `height:${size[1]}%`)
  else if (attrs.w !== undefined) {
    if (/^[\d.]+$/.test(attrs.w)) style.push(`width:${attrs.w}%`)
    else warn(`::: ${name}: w="${attrs.w}" ist ungültig (Zahl in Prozent, z. B. w=30)`)
  }
  return style
}

/** Icon-Name aus icons.ts; ein Wort, das wie ein Name aussieht, aber fehlt, wird gemeldet, alles andere (Emoji, Text) gilt als Text */
function iconHtml(value: string, warn: Warn): string {
  const svg = iconSvg(value)
  if (svg) return svg
  if (/^[a-z][\w-]*$/i.test(value)) {
    const fix = nearest(value, ICON_NAMES)
    warn(`::: card: Icon „${value}“ gibt es nicht${fix ? ` (meintest du „${fix}“?)` : ''} – als Text eingesetzt`)
  }
  return escape(value)
}

/** `::: table widths="2:1:1" steps=rows hl="r2c3,c4"`: Spaltenbreiten, Zeilen/Spalten als Schritte, Zellen hervorheben (r = Zeile, c = Spalte, 1-basiert, r0 = Kopf) */
function applyTable(node: AnyNode, attrs: Record<string, string>, warn: Warn) {
  const table = (node.children ?? []).find((c) => c.type === 'table')
  if (!table) { warn('::: table enthält keine Markdown-Tabelle'); return }
  const rows = (table.children ?? []) as AnyNode[]
  const columns = rows[0]?.children?.length ?? 0
  addProps(table, { className: ['d-table-el'] })
  if (attrs.widths !== undefined) {
    const widths = attrs.widths.split(/[:\s,]+/).filter(Boolean).map(Number)
    if (!widths.length || widths.some((n) => !(n > 0))) warn(`::: table: widths="${attrs.widths}" ist ungültig (positive Zahlen, z. B. widths="2:1:1")`)
    else {
      if (widths.length !== columns) warn(`::: table: widths nennt ${widths.length} Spalten, die Tabelle hat ${columns}`)
      const sum = widths.reduce((a, b) => a + b, 0)
      addProps(table, { style: 'table-layout:fixed;width:100%' })
      ;(rows[0]?.children ?? []).forEach((cell, i) => { if (widths[i]) addProps(cell as AnyNode, { style: `width:${(widths[i] / sum * 100).toFixed(2)}%` }) })
    }
  }
  const start = Number(attrs.start ?? 1)
  if (attrs.steps !== undefined && attrs.steps !== 'rows' && attrs.steps !== 'cols') warn(`::: table: steps="${attrs.steps}" ist ungültig (rows oder cols)`)
  if (attrs.steps === 'rows') rows.forEach((row, i) => { if (i > 0) addProps(row, { dataStep: String(start + i - 1) }) })
  else if (attrs.steps === 'cols') {
    rows.forEach((row) => (row.children ?? []).forEach((cell, c) => { if (c > 0) addProps(cell as AnyNode, { dataStep: String(start + c - 1) }) }))
  }
  for (const spec of (attrs.hl ?? '').split(/[,\s]+/).filter(Boolean)) {
    const m = spec.toLowerCase().match(/^(?:r(\d+))?(?:c(\d+))?$/)
    if (!m || (m[1] === undefined && m[2] === undefined)) { warn(`::: table: hl „${spec}“ ist ungültig (z. B. r2c3, r2, c1)`); continue }
    if ((m[1] !== undefined && Number(m[1]) >= rows.length) || (m[2] !== undefined && (Number(m[2]) < 1 || Number(m[2]) > columns))) {
      warn(`::: table: hl „${spec}“ liegt außerhalb der Tabelle (${rows.length - 1} Zeilen, ${columns} Spalten)`)
      continue
    }
    rows.forEach((row, r) => (row.children ?? []).forEach((cell, c) => {
      if ((m[1] === undefined || Number(m[1]) === r) && (m[2] === undefined || Number(m[2]) === c + 1)) addProps(cell as AnyNode, { className: ['hl-cell'] })
    }))
  }
}

/** Container mit eigener Gestaltung; liefert zusätzliche Klassen und Stil für den Wrapper und meldet ungültige Angaben */
function applyDesignContainer(node: AnyNode, attrs: Record<string, string>, warn: Warn): { classes: string[]; style: string[] } {
  const classes: string[] = []
  const style: string[] = []
  const name = node.name ?? ''
  const allowed = DESIGN_ATTRS[name]
  if (allowed) {
    for (const key of Object.keys(attrs)) {
      if (key === 'class' || key === 'id' || allowed.includes(key)) continue
      const fix = nearest(key, allowed)
      warn(`::: ${name}: Attribut „${key}“ ist unbekannt${fix ? ` (meintest du „${fix}“?)` : ` (bekannt: ${allowed.join(', ')})`}`)
    }
  }
  switch (name) {
    case 'figure':
      if (attrs.w) style.push(`width:${/^\d+$/.test(attrs.w) ? `${attrs.w}%` : attrs.w}`)
      if (attrs.align) {
        if (ALIGNS.includes(attrs.align)) classes.push(`align-${attrs.align}`)
        else warn(`::: figure: align="${attrs.align}" ist ungültig (${ALIGNS.join(' | ')})`)
      }
      break
    case 'bubble': {
      const tail = attrs.tail ?? 'none'
      if (!TAILS.includes(tail)) warn(`::: bubble: tail="${tail}" ist ungültig (${TAILS.join(' | ')})`)
      classes.push(`tail-${TAILS.includes(tail) ? tail : 'none'}`)
      style.push(...placement(name, attrs, warn))
      break
    }
    case 'frame':
      style.push(...placement(name, attrs, warn))
      if (attrs.label) node.children = [html(`<span class="frame-label">${escape(attrs.label)}</span>`), ...(node.children ?? [])]
      break
    case 'pin':
      style.push(...placement(name, attrs, warn))
      break
    case 'cards': {
      if (attrs.cols) style.push(`grid-template-columns:${gridColumns(attrs.cols)}`)
      if (attrs.gap) style.push(`gap:${/^[\d.]+$/.test(attrs.gap) ? `${attrs.gap}rem` : attrs.gap}`)
      if ('steps' in attrs && attrs.steps !== 'false') {
        let step = Number(attrs.start ?? 1)
        for (const child of node.children ?? []) if (child.type === 'containerDirective') addProps(child, { dataStep: String(step++) })
      }
      const other = (node.children ?? []).filter((c) => c.type === 'containerDirective' && c.name !== 'card').length
      if (other) warn('::: cards darf nur ::: card enthalten')
      break
    }
    case 'card': {
      const body = { type: 'containerDirective', name: 'card-body', attributes: {}, children: node.children ?? [] } as unknown as AnyNode
      body.data = { ...body.data, hName: 'div' }
      const head: AnyNode[] = []
      if (attrs.icon) head.push(html(`<div class="card-icon">${iconHtml(attrs.icon, warn)}</div>`))
      if (attrs.title) body.children = [html(`<div class="card-title">${escape(attrs.title)}</div>`), ...(body.children ?? [])]
      node.children = [...head, body]
      if (attrs.accent) style.push(`--card-accent:${attrs.accent}`)
      break
    }
    case 'table':
      applyTable(node, attrs, warn)
      break
    case 'reveal':
      if (!/^\d+$/.test(attrs.step ?? '')) warn('::: reveal braucht step=<Nummer>, z. B. ::: reveal step=2')
      break
  }
  return { classes, style }
}

function applyDirectives(root: Root, ctx: RenderContext) {
  const where = path.relative(ctx.deckDir, ctx.file)
  const warn: Warn = (message) => ctx.warnings?.push(`${message} (${where})`)
  visit(root, (node: AnyNode, index, parent: AnyNode | undefined) => {
    if (node.type === 'blockquote') applyCallout(node)
    if (node.type === 'containerDirective') {
      const attrs = node.attributes ?? {}
      if (node.name !== 'note-step') {
        for (const key of ['step', 'until']) {
          if (attrs[key] !== undefined && !/^\d+$/.test(attrs[key])) warn(`::: ${node.name}: ${key}="${attrs[key]}" ist ungültig (Schrittnummer)`)
        }
      }
      const props: Record<string, unknown> = { className: [`d-${node.name}`, ...(attrs.class ? attrs.class.split(/\s+/) : [])] }
      if (node.name === 'grid' || node.name === 'columns') {
        const style: string[] = []
        // Spalten mit fester Anzahl brechen in die nächste Zeile um, statt weitere Spalten anzuhängen
        if (attrs.cols) style.push(`grid-template-columns:${gridColumns(attrs.cols)}`, 'grid-auto-flow:row')
        if (attrs.gap) style.push(`gap:${/^[\d.]+$/.test(attrs.gap) ? `${attrs.gap}rem` : attrs.gap}`)
        if (style.length) props.style = style.join(';')
      }
      if (node.name === 'children') props.dataChildren = ''
      // `step=2` / `until=4` an jedem Container; `::: reveal step=2` blendet einen beliebigen Block ab Schritt 2 ein
      if (node.name !== 'note-step') {
        if (/^\d+$/.test(attrs.step ?? '')) props.dataStep = attrs.step
        if (/^\d+$/.test(attrs.until ?? '')) props.dataUntil = attrs.until
      }
      // eigener Container: der Inhalt geht durch die Vorlage, der Wrapper `.d-<name>` bleibt (class, step, until)
      const template = ctx.components?.[node.name ?? '']
      if (template) {
        node.children = expandComponent(template, { name: node.name!, attrs, children: node.children ?? [] }, {
          image: (url) => resolveImage(url, ctx),
          warn: (m) => warn(`${node.name}: ${m}`),
        }) as AnyNode[]
      }
      const design = applyDesignContainer(node, attrs, warn)
      ;(props.className as string[]).push(...design.classes)
      if (design.style.length) props.style = [props.style, ...design.style].filter(Boolean).join(';')
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
      const isVideo = isVideoUrl(img.url)
      img.url = resolveImage(img.url, ctx)
      if (isVideo && /^https?:/i.test(img.url)) warn(`Video „${img.url}“ liegt im Netz und läuft offline nicht`)
      if (parent && index !== undefined) imageAttrs(node, index, parent, warn, isVideo ? (u) => resolveImage(u, ctx) : undefined, ctx.zoomImages === true)
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

// ---------- draw.io ----------

/**
 * `![](arch.drawio.svg){steps=layers}` bzw. `![](map.excalidraw.svg){steps=groups order="3,1,2+4"}`
 * → SVG inline einbetten, Ebenen bzw. Gruppen als Schritte.
 * Ohne passendes `steps=` (oder ohne lesbares Modell) bleibt es ein normales Bild.
 */
function inlineDiagramSteps(root: Root, ctx: RenderContext) {
  visit(root, 'paragraph', (node, index, parent) => {
    const p = node as unknown as AnyNode
    if (!parent || index === undefined || !isImageBlock(p)) return
    const kids = p.children ?? []
    const image = kids.find((k) => k.type === 'image') as unknown as { url: string } | undefined
    if (!image || isUrl(image.url)) return
    const kind = /\.drawio\.svg$/i.test(image.url) ? 'drawio' : /\.excalidraw\.svg$/i.test(image.url) ? 'excalidraw' : /\.svg$/i.test(image.url) ? 'svg' : null
    if (!kind) return
    const attrText = kids.find((k) => k.type === 'text') as { value: string } | undefined
    const m = attrText?.value.match(/^\s*\{([^{}]*)\}/)
    const attrs = m ? parseAttrs(m[1]) : {}
    if (attrs.steps !== (kind === 'drawio' ? 'layers' : kind === 'svg' ? 'ids' : 'groups')) return
    const file = path.resolve(path.dirname(ctx.file), decodeURI(image.url))
    if (!fs.existsSync(file)) return // resolveImage meldet die fehlende Datei
    const source = fs.readFileSync(file, 'utf8')
    const where = `${image.url} (${path.relative(ctx.deckDir, ctx.file)})`
    let svg: string | undefined
    if (kind === 'svg') {
      const r = svgIdSteps(source)
      if (!r.count) ctx.warnings?.push(`Keine Elemente mit id="step-N" in ${where} – als Bild eingebunden`)
      else svg = r.svg
    } else if (kind === 'drawio') {
      svg = drawioSteps(source)?.svg
      if (!svg) ctx.warnings?.push(`Kein draw.io-Modell in ${where} – als Bild eingebunden`)
    } else {
      const result = excalidrawSteps(source, attrs.order)
      if (!result) ctx.warnings?.push(`Keine eingebettete Szene in ${where} (Export mit „Szene einbetten“) – als Bild eingebunden`)
      else {
        for (const w of result.warnings) ctx.warnings?.push(`${w} (${where})`)
        svg = result.svg
      }
    }
    if (!svg) return
    parent.children![index] = { type: 'html', value: `<div class="${kind}-block">${svg.trim()}</div>` } as RootContent
  })
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

  inlineDiagramSteps(root, ctx)
  applyDirectives(root, ctx)
  const hast = await toHtml.run(root)
  const where = path.relative(ctx.deckDir, ctx.file)
  const html = renderMath(String(toHtml.stringify(hast)).trim(), { warn: (m) => ctx.warnings?.push(`${m} (${where})`) })

  // Schritte der Folie = höchster `data-step` über alle Blöcke; gleiche Nummer = gleichzeitig.
  // Code mit `lines="a|b|c"` braucht Schritte bis zur Anzahl Abschnitte − 1.
  const count = Math.max(0,
    ...[...html.matchAll(/data-step="(\d+)"/g)].map((m) => Number(m[1])),
    ...[...html.matchAll(/data-play="(\d+)"/g)].map((m) => Number(m[1])),
    ...[...html.matchAll(/data-zoom(?:step|until)="(\d+)"/g)].map((m) => Number(m[1])),
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
export async function renderNodeContent(blocks: RootContent[], ctx: RenderContext, layout?: string, autoSteps = false): Promise<{ slides: Slide[]; notes?: string }> {
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
    if (autoSteps) markAutoSteps(content)
    const slide = await renderSlide(content, ctx, layout)
    if (n.length) {
      slide.notes = (await blocksToHtml(n, ctx)).html
      notes.push(slide.notes)
    }
    slides.push(slide)
  }
  return { slides, notes: notes.length ? notes.join('\n<hr>\n') : undefined }
}
