import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizeContainers, parseAttrs, splitHeadingAttrs } from '../src/core/syntax.ts'
import { buildNodes, parseMarkdown } from '../src/core/parse.ts'
import { loadDeck } from '../src/core/deck.ts'
import { Navigator, formatHash, parseHash, type Position } from '../src/core/navigator.ts'
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

describe('Schritte', () => {
  it('parst Zeilen-Schritte und Mermaid-Versionen', async () => {
    const { parseLineSteps, mermaidVersions } = await import('../src/core/render.ts')
    expect([...parseLineSteps('2-3|5||1,7')]).toEqual([[2, 1], [3, 1], [5, 2], [1, 4], [7, 4]])
    expect(mermaidVersions('flowchart LR\n  a\n%% step\n  a --> b\n%% step 2\n  b --> c')).toEqual([
      'flowchart LR\n  a', 'flowchart LR\n  a\n  a --> b', 'flowchart LR\n  a\n  a --> b\n  b --> c',
    ])
  })

  it('synchronisiert Liste, Code und Mermaid über die Schrittnummer', async () => {
    const dir = await tempDeck({
      'a.md': [
        '# Schritte {layout=two-col}',
        '::: col', '::: steps', '- Eins', '- Zwei', '- Drei', ':::', ':::',
        '::: col', '```ts {steps="2|3-4"}', 'function f() {', '  const a = 1', '  return a', '}', '```', ':::',
        '---',
        '```mermaid', 'flowchart LR', '  a', '%% step', '  a --> b', '```',
      ].join('\n'),
    })
    const { deck } = await loadDeck(dir)
    const [first, second] = deck.nodes[0].slides
    expect(first.steps).toHaveLength(3)
    expect(first.html).toMatch(/<li data-step="1">Eins/)
    expect(first.html).toMatch(/<li data-step="3">Drei/)
    expect(first.html.match(/class="line" data-step="2"/g)).toHaveLength(2)
    expect(second.steps).toHaveLength(1)
    expect(second.html).toContain('data-step="0" data-until="1"')
  })
})

describe('Navigator mit Schritten', () => {
  const withSteps = (id: string, steps: number[], children: DeckNode[] = []): DeckNode => ({
    ...n(id, children, steps.length),
    slides: steps.map((k) => ({ html: '', steps: Array.from({ length: k }, () => ({ selector: '', state: {} })) })),
  })
  const nav = new Navigator([withSteps('a', [2, 0], [n('a/kind')]), withSteps('b', [1])])

  it('spielt Schritte vor der nächsten Folie ab', () => {
    expect(nav.next({ id: 'a', slide: 0 })).toEqual({ pos: { id: 'a', slide: 0, step: 1 }, dir: 'step' })
    expect(nav.next({ id: 'a', slide: 0, step: 1 })?.pos).toEqual({ id: 'a', slide: 0, step: 2 })
    expect(nav.next({ id: 'a', slide: 0, step: 2 })?.pos).toEqual({ id: 'a', slide: 1 })
    expect(nav.next({ id: 'a', slide: 1 })?.pos).toEqual({ id: 'b', slide: 0 })
  })
  it('landet rückwärts vollständig aufgedeckt', () => {
    expect(nav.prev({ id: 'a', slide: 1 })?.pos).toEqual({ id: 'a', slide: 0, step: 2 })
    expect(nav.prev({ id: 'b', slide: 0, step: 1 })).toEqual({ pos: { id: 'b', slide: 0 }, dir: 'step' })
    expect(nav.prev({ id: 'b', slide: 0 })?.pos).toEqual({ id: 'a', slide: 1 })
  })
  it('merkt sich den Schritt beim Abtauchen', () => {
    nav.down({ id: 'a', slide: 0, step: 1 })
    expect(nav.up({ id: 'a/kind', slide: 0 })?.pos).toEqual({ id: 'a', slide: 0, step: 1 })
    expect(nav.relocate({ id: 'a', slide: 0, step: 9 })).toEqual({ id: 'a', slide: 0, step: 2 })
  })
})

describe('Bilder', () => {
  // 1×1-PNG
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const DATA = `data:image/png;base64,${PNG.toString('base64')}`

  async function deckWithImages(manifest = '') {
    const dir = await tempDeck({
      'deck/deck.yaml': manifest + 'mount:\n  - file: a.md\n',
      'deck/a.md': [
        '# Bilder',
        '![lokal](bilder/x.png){width=60% .rund}',
        '',
        '![aussen](../shared/logo.png)',
        '',
        `![inline](${DATA})`,
        '---',
        '![Referenz][logo]',
        '',
        '![fehlt](nicht-da.png)',
        '',
        `[logo]: ${DATA}`,
      ].join('\n'),
    })
    await fs.mkdir(path.join(dir, 'deck/bilder'), { recursive: true })
    await fs.mkdir(path.join(dir, 'shared'), { recursive: true })
    await fs.writeFile(path.join(dir, 'deck/bilder/x.png'), PNG)
    await fs.writeFile(path.join(dir, 'shared/logo.png'), PNG)
    return loadDeck(path.join(dir, 'deck'))
  }

  it('verlinkt Deck-Bilder, bettet externe und Data-URIs ein, löst Referenzen folienübergreifend auf', async () => {
    const { deck, assets, warnings } = await deckWithImages()
    const [s1, s2] = deck.nodes[0].slides
    expect(s1.html).toContain('src="deck-assets/bilder/x.png"')
    expect(s1.html).toContain('style="width:60%"')
    expect(s1.html).toContain('class="rund"')
    expect(s1.html).not.toContain('{width')
    expect(s1.html).toContain(`src="${DATA}" alt="aussen"`) // außerhalb des Decks → eingebettet
    expect(s1.html).toContain(`src="${DATA}" alt="inline"`)
    expect(s2.html).toContain(`src="${DATA}" alt="Referenz"`) // Definition stand auf einer anderen Folie
    expect(s2.html).not.toContain('[logo]')
    expect(assets.map((a) => path.basename(a))).toEqual(['x.png'])
    expect(warnings).toEqual([expect.stringContaining('nicht-da.png')])
  })

  it('bettet mit embedImages alle Bilder als Base64 ein', async () => {
    const { deck, assets } = await deckWithImages('embedImages: true\n')
    expect(deck.nodes[0].slides[0].html).toContain(`src="${DATA}" alt="lokal"`)
    expect(assets).toEqual([])
  })
})

describe('Folientrenner', () => {
  it('macht aus Text + --- keinen Setext-Titel und behält die Zeilennummern', () => {
    const nodes = buildNodes(parseMarkdown('# A\nEins\n---\nZwei\n## B'), { file: 'x.md', baseDepth: 1, maxDepth: 6 })
    expect(nodes).toHaveLength(1)
    expect(nodes[0].content.map((b) => b.type)).toEqual(['paragraph', 'thematicBreak', 'paragraph'])
    expect(nodes[0].children[0].source.line).toBe(5)
    // echte Setext-Überschrift mit === bleibt, Frontmatter ebenso
    expect(parseMarkdown('Titel\n===').children[0].type).toBe('heading')
    expect(parseMarkdown('---\ntitle: x\n---\n# A').children[0].type).toBe('yaml')
  })
})

describe('Editor-Sync', () => {
  it('ordnet Zeilen Knoten und Sub-Slides zu und zurück', async () => {
    const { nodeAtLine, lineOfSlide } = await import('../src/core/sourcemap.ts')
    const text = ['Vorwort', '# A', 'eins', '---', 'zwei', '```', '---', '```', '## B', 'b'].join('\n')
    const dir = await tempDeck({ 'a.md': text })
    const { deck } = await loadDeck(dir)
    expect(nodeAtLine(deck.nodes, 'a.md', text, 1)).toEqual({ id: 'a', slide: 0 })
    expect(nodeAtLine(deck.nodes, 'a.md', text, 3)).toEqual({ id: 'a', slide: 0 })
    expect(nodeAtLine(deck.nodes, 'a.md', text, 5)).toEqual({ id: 'a', slide: 1 })
    expect(nodeAtLine(deck.nodes, 'a.md', text, 8)).toEqual({ id: 'a', slide: 1 }) // --- im Codeblock zählt nicht
    expect(nodeAtLine(deck.nodes, 'a.md', text, 10)).toEqual({ id: 'a/b', slide: 0 })
    expect(nodeAtLine(deck.nodes, 'andere.md', text, 1)).toBeNull()
    expect(lineOfSlide(deck.nodes, 'a/b', 0)).toEqual({ file: 'a.md', line: 9 })
    expect(lineOfSlide(deck.nodes, 'a', 1, text)).toEqual({ file: 'a.md', line: 5 })
  })
})

describe('Editor-Hilfen', () => {
  it('bildet Bildpfade relativ zur bearbeiteten Datei', async () => {
    const { relativeTo } = await import('../src/runtime/editor/api.ts')
    expect(relativeTo('a.md', 'bilder/x.png')).toBe('bilder/x.png')
    expect(relativeTo('details/parser.md', 'bilder/x.png')).toBe('../bilder/x.png')
    expect(relativeTo('details/tief/b.md', 'details/bild.png')).toBe('../bild.png')
  })
})

describe('Druck', () => {
  const withSteps = (id: string, steps: number[], children: DeckNode[] = []): DeckNode => ({
    ...n(id, children, steps.length),
    slides: steps.map((k) => ({ html: '', steps: Array.from({ length: k }, () => ({ selector: '', state: {} })) })),
  })
  const tree = [withSteps('a', [2, 0], [n('a/x', [n('a/x/y')])]), n('b')]

  it('liefert Seiten in Lesereihenfolge, Endzustand, mit Tiefenfilter', async () => {
    const { printPages, DEFAULT_PRINT } = await import('../src/core/print.ts')
    const all = printPages(tree, DEFAULT_PRINT)
    expect(all.map((p) => `${p.node.id}:${p.slide}:${p.step}`)).toEqual(['a:0:2', 'a:1:0', 'a/x:0:0', 'a/x/y:0:0', 'b:0:0'])
    expect(all.map((p) => p.first)).toEqual([true, false, true, true, true])
    expect(all[3].trail.map((t) => t.id)).toEqual(['a', 'a/x', 'a/x/y'])
    expect(printPages(tree, { ...DEFAULT_PRINT, depth: 1 }).map((p) => p.node.id)).toEqual(['a', 'a', 'b'])
  })
  it('erzeugt mit steps eine Seite pro Schritt', async () => {
    const { printPages, DEFAULT_PRINT } = await import('../src/core/print.ts')
    const pages = printPages(tree, { ...DEFAULT_PRINT, steps: true, depth: 1 })
    expect(pages.map((p) => `${p.node.id}:${p.slide}:${p.step}`)).toEqual(['a:0:0', 'a:0:1', 'a:0:2', 'a:1:0', 'b:0:0'])
  })
  it('liest und schreibt die Optionen als URL-Parameter', async () => {
    const { parsePrintOptions, printQuery } = await import('../src/core/print.ts')
    expect(parsePrintOptions(new URLSearchParams('print&depth=2&steps=1&footer=0'))).toEqual({ depth: 2, steps: true, notes: false, footer: false })
    expect(parsePrintOptions(new URLSearchParams('print'))).toEqual({ depth: Infinity, steps: false, notes: false, footer: true })
    expect(printQuery({ depth: 2, notes: true }, { autoprint: '1' })).toBe('?print&autoprint=1&depth=2&notes=1')
  })
})

describe('Navigator: Space der Linie nach', () => {
  const withSteps = (id: string, steps: number[], children: DeckNode[] = []): DeckNode => ({
    ...n(id, children, steps.length),
    slides: steps.map((k) => ({ html: '', steps: Array.from({ length: k }, () => ({ selector: '', state: {} })) })),
  })
  // a (1 Schritt) → a/x → a/x/y → a/z → b (2 Folien)
  const tree = [withSteps('a', [1], [n('a/x', [n('a/x/y')]), n('a/z')]), n('b', [], 2)]
  const nav = new Navigator(tree)
  const walk = () => {
    const seen: string[] = []
    for (let p: Position | null = nav.first; p; p = nav.forward(p)?.pos ?? null) seen.push(`${p.id}:${p.slide}:${p.step ?? 0}`)
    return seen
  }

  it('geht vorwärts in Tiefensuche durch Schritte, Details und Sub-Slides', () => {
    expect(walk()).toEqual(['a:0:0', 'a:0:1', 'a/x:0:0', 'a/x/y:0:0', 'a/z:0:0', 'b:0:0', 'b:1:0'])
  })
  it('geht rückwärts exakt denselben Weg (vollständig aufgedeckt)', () => {
    const back: string[] = []
    for (let p: Position | null = { id: 'b', slide: 1 }; p; p = nav.backward(p)?.pos ?? null) back.push(`${p.id}:${p.slide}:${p.step ?? 0}`)
    expect(back).toEqual(['b:1:0', 'b:0:0', 'a/z:0:0', 'a/x/y:0:0', 'a/x:0:0', 'a:0:1', 'a:0:0'])
  })
  it('meldet Richtungen und Fortschritt', () => {
    expect(nav.forward({ id: 'a', slide: 0, step: 1 })?.dir).toBe('down')
    expect(nav.forward({ id: 'a/x/y', slide: 0 })).toEqual({ pos: { id: 'a/z', slide: 0 }, dir: 'up' })
    expect(nav.backward({ id: 'b', slide: 0 })?.dir).toBe('up')
    expect(nav.progress({ id: 'a/z', slide: 0 })).toEqual({ index: 4, total: 6 })
    expect(nav.progress({ id: 'b', slide: 1 })).toEqual({ index: 6, total: 6 })
  })
})

describe('Leere Sub-Slides', () => {
  it('verwirft --- am Ende eines Knotens, behält eine gewollt leere erste Folie', async () => {
    const dir = await tempDeck({
      'a.md': [
        '# A', 'Inhalt', '', '---', '', '## Kind', 'x', '',
        '# B', '', '---', '', 'Inhalt nach Titelfolie', '',
        '# C', 'eins', '', '---', '', '::: notes', 'Notiz', ':::', '',
      ].join('\n'),
    })
    const { deck } = await loadDeck(dir)
    const [a, b, c] = deck.nodes
    expect(a.slides).toHaveLength(1) // --- direkt vor "## Kind"
    expect(b.slides).toHaveLength(2) // leere Titelfolie bleibt
    expect(c.slides).toHaveLength(1) // nur Notizen danach → keine eigene Folie …
    expect(c.notes).toContain('Notiz') // … aber die Notiz bleibt
  })
})
