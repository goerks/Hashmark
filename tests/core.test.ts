import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizeContainers, parseAttrs, splitHeadingAttrs } from '../src/core/syntax.ts'
import { buildNodes, parseMarkdown } from '../src/core/parse.ts'
import { loadDeck } from '../src/core/deck.ts'
import { Navigator, formatHash, parseHash } from '../src/core/navigator.ts'
import type { DeckNode } from '../src/core/types.ts'

describe('Syntax', () => {
  it('verschachtelt Pandoc-Container mit mehr Doppelpunkten außen', () => {
    const src = '::: columns\n::: col\nA\n:::\n::: col\nB\n:::\n:::'
    expect(normalizeContainers(src)).toBe('::::columns\n:::col\nA\n:::\n:::col\nB\n:::\n::::')
  })
  it('lässt Codeblöcke unangetastet und wandelt Attribute', () => {
    const src = '```md\n::: col\n```\n::: grid cols="2fr 1fr" gap=2\nx\n:::'
    expect(normalizeContainers(src)).toBe('```md\n::: col\n```\n:::grid{cols="2fr 1fr" gap=2}\nx\n:::')
  })
  it('parst Überschriften-Attribute', () => {
    expect(splitHeadingAttrs('Backend {layout=two-col id=backend}')).toEqual({ text: 'Backend', attrs: 'layout=two-col id=backend' })
    expect(splitHeadingAttrs('Mengen {a, b}').attrs).toBeNull()
    expect(parseAttrs('layout=two-col title="a b" .x #y')).toEqual({ layout: 'two-col', title: 'a b', class: 'x', id: 'y' })
  })
})

describe('Baum', () => {
  const md = '# A\ntext\n## A1\n### A1a\n#### tief\n## A2\n# B\n---\nx'
  it('baut Ebenen und respektiert maxDepth', () => {
    const nodes = buildNodes(parseMarkdown(md), { file: 'x.md', baseDepth: 1, maxDepth: 3 })
    expect(nodes.map((n) => n.title)).toEqual(['A', 'B'])
    expect(nodes[0].children.map((n) => n.title)).toEqual(['A1', 'A2'])
    const a1a = nodes[0].children[0].children[0]
    expect(a1a.depth).toBe(3)
    expect(a1a.children).toEqual([])
    expect(a1a.content.some((b) => b.type === 'heading')).toBe(true)
  })
  it('normalisiert Dateien, die mit ## beginnen', () => {
    const nodes = buildNodes(parseMarkdown('## X\n### Y'), { file: 'x.md', baseDepth: 2, maxDepth: 6 })
    expect(nodes[0].depth).toBe(2)
    expect(nodes[0].children[0].depth).toBe(3)
  })
})

async function tempDeck(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strata-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

describe('Deck', () => {
  it('lädt Ordner alphabetisch, mountet unter Knoten, rendert Sub-Slides und Notizen', async () => {
    const dir = await tempDeck({
      'deck.yaml': 'title: T\nmount:\n  - file: b.md\n  - file: a.md\n  - file: sub/d.md\n    under: "Architektur > Backend"\n',
      'a.md': '# Fazit\nEnde',
      'b.md': '# Architektur\n## Backend {layout=two-col}\nEins\n\n---\n\nZwei\n\n::: notes\nGeheim\n:::\n',
      'sub/d.md': '# DB-Schema\n```ts {title="db.ts"}\nconst a = 1\n```\n```mermaid\nflowchart LR\n a --> b\n```',
    })
    const { deck } = await loadDeck(dir)
    expect(deck.title).toBe('T')
    expect(deck.nodes.map((n) => n.id)).toEqual(['architektur', 'fazit'])
    const backend = deck.nodes[0].children[0]
    expect(backend.id).toBe('architektur/backend')
    expect(backend.attrs.layout).toBe('two-col')
    expect(backend.slides).toHaveLength(2)
    expect(backend.notes).toContain('Geheim')
    expect(backend.slides[1].html).not.toContain('Geheim')
    const db = backend.children[0]
    expect(db.id).toBe('architektur/backend/db-schema')
    expect(db.depth).toBe(3)
    expect(db.slides[0].html).toContain('shiki')
    expect(db.slides[0].html).toContain('db.ts')
    expect(db.slides[0].html).toContain('mermaid-src')
  })
  it('meldet unbekannte under-Ziele', async () => {
    const dir = await tempDeck({ 'deck.yaml': 'mount:\n  - file: a.md\n    under: Nix\n', 'a.md': '# A' })
    await expect(loadDeck(dir)).rejects.toThrow(/Nix/)
  })
})

const n = (id: string, children: DeckNode[] = [], slides = 1): DeckNode => ({
  id, title: id, depth: id.split('/').length, attrs: {}, children,
  slides: Array.from({ length: slides }, () => ({ html: '', steps: [] })), source: { file: '', line: 1 },
})

describe('Navigator', () => {
  const tree = [n('intro'), n('arch', [n('arch/fe'), n('arch/be', [n('arch/be/db')])], 2), n('fazit')]
  const nav = new Navigator(tree)

  it('bleibt auf dem Hauptpfad', () => {
    expect(nav.next({ id: 'intro', slide: 0 })?.pos).toEqual({ id: 'arch', slide: 0 })
    expect(nav.next({ id: 'arch', slide: 0 })?.pos).toEqual({ id: 'arch', slide: 1 })
    expect(nav.next({ id: 'arch', slide: 1 })?.pos).toEqual({ id: 'fazit', slide: 0 })
    expect(nav.prev({ id: 'fazit', slide: 0 })?.pos).toEqual({ id: 'arch', slide: 1 })
    expect(nav.next({ id: 'fazit', slide: 0 })).toBeNull()
  })
  it('taucht ab und auf und merkt sich die Sub-Slide', () => {
    expect(nav.down({ id: 'arch', slide: 1 })?.pos).toEqual({ id: 'arch/fe', slide: 0 })
    expect(nav.up({ id: 'arch/be', slide: 0 })?.pos).toEqual({ id: 'arch', slide: 1 })
    expect(nav.down({ id: 'fazit', slide: 0 })).toBeNull()
    expect(nav.up({ id: 'intro', slide: 0 })).toBeNull()
  })
  it('geht am Ende einer Ebene zum Nachfolger des Elternknotens', () => {
    expect(nav.next({ id: 'arch/be/db', slide: 0 })).toEqual({ pos: { id: 'fazit', slide: 0 }, dir: 'up' })
    expect(nav.prev({ id: 'arch/fe', slide: 0 })?.dir).toBe('up')
  })
  it('findet nach Umbenennung die nächste Position', () => {
    const renamed = new Navigator([n('intro'), n('arch', [n('arch/frontend'), n('arch/be')])])
    expect(renamed.relocate({ id: 'arch/fe', slide: 0 }, nav)).toEqual({ id: 'arch/frontend', slide: 0 })
    expect(renamed.relocate({ id: 'arch/be/db', slide: 0 }, nav)).toEqual({ id: 'arch/be', slide: 0 })
    expect(renamed.relocate({ id: 'arch', slide: 5 }, nav)).toEqual({ id: 'arch', slide: 0 })
  })
  it('liefert Breadcrumb-Pfad und Deep-Links', () => {
    expect(nav.path('arch/be/db').map((x) => x.id)).toEqual(['arch', 'arch/be', 'arch/be/db'])
    expect(formatHash({ id: 'arch/be', slide: 1 })).toBe('#arch/be:2')
    expect(parseHash('#arch/be:2')).toEqual({ id: 'arch/be', slide: 1 })
    expect(parseHash('#einf%C3%BChrung')).toEqual({ id: 'einführung', slide: 0 })
  })
})
