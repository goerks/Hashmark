// Deck laden: Manifest bzw. Ordner → Mounts → Deck-Baum.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { slug } from 'github-slugger'
import { buildNodes, parseMarkdown, type RawNode } from './parse.ts'
import { renderNodeContent, type RenderContext } from './render.ts'
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

async function finalize(raw: RawNode[], parentId: string, ctx: Omit<RenderContext, 'file'>): Promise<DeckNode[]> {
  const used = new Map<string, number>()
  const out: DeckNode[] = []
  for (const n of raw) {
    let s = slugOf(n)
    const count = used.get(s) ?? 0
    used.set(s, count + 1)
    if (count) s = `${s}-${count + 1}`
    const id = parentId ? `${parentId}/${s}` : s
    const { slides, notes } = await renderNodeContent(n.content, { ...ctx, file: n.source.file })
    out.push({
      id,
      title: n.title,
      depth: n.depth,
      attrs: n.attrs,
      slides,
      ...(notes ? { notes } : {}),
      children: await finalize(n.children, id, ctx),
      source: { file: path.relative(ctx.deckDir, n.source.file).split(path.sep).join('/'), line: n.source.line },
    })
  }
  return out
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
  const nodes = await finalize(top, '', { deckDir, assets, warnings, embedImages: manifest.embedImages === true })
  return {
    deck: {
      title: manifest.title ?? nodes[0]?.title ?? 'Strata',
      maxDepth,
      layout: manifest.layout ?? 'default',
      nodes,
      files: files.map((f) => path.relative(deckDir, f).split(path.sep).join('/')),
    },
    themePath: resolveTheme(deckDir, manifest.theme),
    assets: [...assets],
    warnings,
  }
}
