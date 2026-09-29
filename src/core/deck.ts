// Deck laden: Manifest bzw. Ordner → Mounts → Deck-Baum.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { slug } from 'github-slugger'
import { buildNodes, parseMarkdown, type RawNode } from './parse.ts'
import { renderNodeContent, resolveImage, type RenderContext } from './render.ts'
import { parseDuration } from './timing.ts'
import type { Deck, DeckNode, Manifest, MountEntry } from './types.ts'

export const BUILTIN_THEMES_DIR = fileURLToPath(new URL('../runtime/themes/', import.meta.url))
const MANIFEST = 'deck.yaml'

export interface LoadResult {
  deck: Deck
  /** absoluter Pfad der Theme-CSS */
  themePath: string
  /** referenzierte lokale Bilder */
  assets: string[]
  /** Hinweise beim Laden, z. B. fehlende Bilder */
  warnings: string[]
}

export class DeckError extends Error {
  file?: string
  constructor(message: string, file?: string) {
    super(file ? `${message} (${file})` : message)
    this.file = file
  }
}

async function readManifest(deckDir: string): Promise<Manifest> {
  const file = path.join(deckDir, MANIFEST)
  try {
    const manifest = YAML.parse(await fs.readFile(file, 'utf8')) ?? {}
    if (typeof manifest !== 'object') throw new DeckError('deck.yaml muss ein Objekt sein', file)
    return manifest as Manifest
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
    if (e instanceof DeckError) throw e
    throw new DeckError(`deck.yaml ist ungültig: ${(e as Error).message}`, file)
  }
}

async function defaultMounts(deckDir: string): Promise<MountEntry[]> {
  const entries = await fs.readdir(deckDir)
  return entries
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'de'))
    .map((file) => ({ file }))
}

function resolveTheme(deckDir: string, theme = 'minimal') {
  if (/[\\/.]/.test(theme)) return path.resolve(deckDir, theme)
  return path.join(BUILTIN_THEMES_DIR, `${theme}.css`)
}

/** Findet den Knoten zu `"Architektur > Backend"` (Titel oder Slug, Groß/Klein egal). */
function findByPath(nodes: RawNode[], under: string): RawNode | undefined {
  let current: RawNode | undefined
  let list = nodes
  for (const segment of under.split('>').map((s) => s.trim().toLowerCase())) {
    current = list.find((n) => n.title.toLowerCase() === segment || slugOf(n) === segment)
    if (!current) return undefined
    list = current.children
  }
  return current
}

const slugOf = (n: RawNode) => n.attrs.id ?? (slug(n.title) || 'folie')

/** Wirksames Layout: Attribut am Knoten, sonst `layouts` je Ebene, sonst Deck-Default. */
export function effectiveLayout(attrs: Record<string, string>, depth: number, manifest: Manifest): string {
  return attrs.layout ?? manifest.layouts?.[String(depth)] ?? manifest.layout ?? 'default'
}

/** Farben und Verläufe bleiben CSS, alles andere ist ein Bild (Pfad oder URL). */
const CSS_BACKGROUND = /^(#[0-9a-f]{3,8}|[a-z]+|(rgba?|hsla?|oklch|color-mix|(linear|radial|conic)-gradient)\(.*\))$/i

/** `{bg=bilder/x.jpg}` bzw. `{bg=#123}` → CSS-Wert für `background` */
function background(value: string, ctx: RenderContext): string {
  const v = value.trim()
  if (CSS_BACKGROUND.test(v)) return v
  return `url("${resolveImage(v, ctx)}") center / cover no-repeat`
}

type FinalizeContext = Omit<RenderContext, 'file'> & { manifest: Manifest }

async function finalize(raw: RawNode[], parentId: string, ctx: FinalizeContext): Promise<DeckNode[]> {
  const used = new Map<string, number>()
  const out: DeckNode[] = []
  for (const n of raw) {
    let s = slugOf(n)
    const count = used.get(s) ?? 0
    used.set(s, count + 1)
    if (count) s = `${s}-${count + 1}`
    const id = parentId ? `${parentId}/${s}` : s
    const layout = effectiveLayout(n.attrs, n.depth, ctx.manifest)
    const nodeCtx = { ...ctx, file: n.source.file }
    const { slides, notes } = await renderNodeContent(n.content, nodeCtx, layout)
    const duration = parseDuration(n.attrs.duration)
    if (n.attrs.duration && duration === undefined) {
      ctx.warnings?.push(`Ungültige Dauer "${n.attrs.duration}" bei "${n.title}" (z. B. 5m, 90s, 1h30m)`)
    }
    out.push({
      id,
      title: n.title,
      depth: n.depth,
      attrs: n.attrs.bg ? { ...n.attrs, bg: background(n.attrs.bg, nodeCtx) } : n.attrs,
      slides,
      ...(notes ? { notes } : {}),
      layout,
      ...(duration ? { duration } : {}),
      children: await finalize(n.children, id, ctx),
      source: { file: path.relative(ctx.deckDir, n.source.file).split(path.sep).join('/'), line: n.source.line },
    })
  }
  return out
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Kapitel für die Agenda: Hauptpfad ohne Titel- und Agenda-Folien */
const isChapter = (n: DeckNode) => n.layout !== 'title' && n.layout !== 'agenda'

/**
 * `layout=agenda`: listet die Kapitel des Hauptpfads. Steht die Agenda zwischen den Kapiteln,
 * sind die vorherigen erledigt und das folgende ist „als Nächstes“; unter einem Kapitel ist dieses „aktuell“.
 */
function injectAgendas(nodes: DeckNode[]) {
  const chapters = nodes.filter(isChapter)
  const visit = (list: DeckNode[], top: DeckNode | undefined) => {
    for (const node of list) {
      const chapter = top ?? node
      if (node.layout === 'agenda') {
        const topIndex = nodes.indexOf(chapter)
        // Index des Kapitels, das gerade dran ist bzw. als Nächstes kommt
        const pivot = chapters.findIndex((c) => nodes.indexOf(c) >= topIndex)
        const inside = top !== undefined && isChapter(chapter)
        const items = chapters.map((c, i) => {
          const state = i < pivot || pivot < 0 ? 'done' : i === pivot ? (inside ? 'current' : 'next') : 'todo'
          const count = c.children.length ? `<span class="agenda-count">${c.children.length} Details</span>` : ''
          return `<li class="agenda-${state}"><a href="#${encodeURI(c.id)}">${escapeHtml(c.title)}</a>${count}</li>`
        })
        // Zeilen für die zweispaltige Darstellung ab 10 Kapiteln (siehe base.css)
        const html = `<ol class="agenda" style="--agenda-rows:${Math.ceil(items.length / 2)}">${items.join('')}</ol>`
        node.slides[0].html = node.slides[0].html ? `${node.slides[0].html}\n${html}` : html
      }
      visit(node.children, chapter)
    }
  }
  visit(nodes, undefined)
}

export async function loadDeck(deckDirInput: string): Promise<LoadResult> {
  const deckDir = path.resolve(deckDirInput)
  const manifest = await readManifest(deckDir)
  const maxDepth = Number(manifest.maxDepth ?? 6)
  const mounts = manifest.mount ?? (await defaultMounts(deckDir))
  if (!mounts.length) throw new DeckError('Keine Markdown-Dateien gefunden', deckDir)

  const top: RawNode[] = []
  const files = [path.join(deckDir, MANIFEST)]
  for (const mount of mounts) {
    const file = path.resolve(deckDir, mount.file)
    files.push(file)
    let text: string
    try {
      text = await fs.readFile(file, 'utf8')
    } catch {
      throw new DeckError(`Datei nicht gefunden: ${mount.file}`, path.join(deckDir, MANIFEST))
    }
    const root = parseMarkdown(text)
    if (mount.under) {
      const target = findByPath(top, mount.under)
      if (!target) throw new DeckError(`under: Knoten "${mount.under}" nicht gefunden (muss in einer früheren Datei stehen)`, file)
      if (target.depth >= maxDepth) throw new DeckError(`under: "${mount.under}" liegt bereits auf maxDepth ${maxDepth}`, file)
      target.children.push(...buildNodes(root, { file, baseDepth: target.depth + 1, maxDepth }))
    } else {
      top.push(...buildNodes(root, { file, baseDepth: 1, maxDepth }))
    }
  }

  const assets = new Set<string>()
  const warnings: string[] = []
  const nodes = await finalize(top, '', { deckDir, assets, warnings, embedImages: manifest.embedImages === true, manifest })
  injectAgendas(nodes)
  const duration = parseDuration(manifest.duration)
  if (manifest.duration !== undefined && duration === undefined) warnings.push(`deck.yaml: ungültige Dauer "${manifest.duration}" (z. B. 30m, 1h)`)
  return {
    deck: {
      title: manifest.title ?? nodes[0]?.title ?? 'Strata',
      maxDepth,
      layout: manifest.layout ?? 'default',
      ...(duration ? { duration } : {}),
      nodes,
      files: files.map((f) => path.relative(deckDir, f).split(path.sep).join('/')),
    },
    themePath: resolveTheme(deckDir, manifest.theme),
    assets: [...assets],
    warnings,
  }
}
