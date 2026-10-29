import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizeContainers, parseAttrs, splitHeadingAttrs } from '../src/core/syntax.ts'
import { buildNodes, parseMarkdown } from '../src/core/parse.ts'
import { loadDeck } from '../src/core/deck.ts'
import { expandComponent, parseTemplate, TemplateError } from '../src/core/components.ts'
import { FUNCTION_NAMES, parseNumber } from '../src/core/functions.ts'
import { completionAt } from '../src/core/complete.ts'
import { COMPONENT_FILE, completeTemplate, componentKind, componentNameProblem, lintTemplate, scaffoldComponent } from '../src/core/component-edit.ts'
import { lintText } from '../src/core/lint.ts'
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
    expect(splitHeadingAttrs('Viel Text {fit}')).toEqual({ text: 'Viel Text', attrs: 'fit' })
    expect(splitHeadingAttrs('Liste {steps fit}').attrs).toBe('steps fit')
    expect(parseAttrs('steps fit')).toEqual({ steps: 'true', fit: 'true' })
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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-'))
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

  it('blendet Listen mit {steps} an der Überschrift automatisch schrittweise ein', async () => {
    const dir = await tempDeck({
      'a.md': [
        '# Auto {steps}', '- Eins', '  - Unter', '- Zwei', '', '1. Drei',
        '# Explizit {steps}', '- Davor', '::: steps', '- Eins', '- Zwei', ':::',
        '# Aus', '- Eins', '- Zwei',
        '# Spalten {steps}', '::: col', '- A', ':::', '::: col', '- B', ':::',
      ].join('\n'),
    })
    const { deck } = await loadDeck(dir)
    const [auto, explicit, off, cols] = deck.nodes
    const a = auto.slides[0]
    expect(a.steps).toHaveLength(3)
    expect(a.html).toMatch(/<li data-step="1">Eins/)
    expect(a.html).toMatch(/<li data-step="3">Drei/)
    expect(a.html).not.toMatch(/Unter<\/li>[^]*data-step="\d+">Unter/)
    expect(explicit.slides[0].html).toContain("<li>Davor")
    expect(explicit.slides[0].html).toMatch(/<li data-step="1">Eins/)
    expect(off.slides[0].steps).toHaveLength(0)
    expect(cols.slides[0].steps).toHaveLength(2)
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
    expect(parsePrintOptions(new URLSearchParams('print&depth=2&steps=1&footer=0'))).toEqual({ depth: 2, steps: true, notes: false, footer: false, plan: 'tree' })
    expect(parsePrintOptions(new URLSearchParams('print'))).toEqual({ depth: Infinity, steps: false, notes: false, footer: true, plan: 'tree' })
    expect(printQuery({ depth: 2, notes: true }, { autoprint: '1' })).toBe('?print&autoprint=1&depth=2&notes=1')
    expect(parsePrintOptions(new URLSearchParams('print&plan=grouped')).plan).toBe('grouped')
    expect(parsePrintOptions(new URLSearchParams('print&plan=quatsch')).plan).toBe('tree')
    expect(printQuery({ plan: 'path' })).toBe('?print&plan=path')
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

describe('Theme v2', () => {
  it('kurze Schreibweise: eingebautes Theme bzw. Fallback mit Hinweis', async () => {
    const dark = await loadDeck(await tempDeck({ 'deck.yaml': 'theme: dark-tech\n', 'a.md': '# A' }))
    expect(dark.themeCss).toContain('Theme "dark-tech"')
    expect(dark.warnings).toEqual([])
    const unknown = await loadDeck(await tempDeck({ 'deck.yaml': 'theme: gibtsnicht\n', 'a.md': '# A' }))
    expect(unknown.themeCss).toContain('Theme "minimal"')
    expect(unknown.warnings.join()).toContain('gibtsnicht')
  })

  it('setzt Basis, Layouts, Zusatz-CSS und zuletzt die Tokens zusammen', async () => {
    const dir = await tempDeck({
      'deck.yaml': [
        'theme:', '  extends: minimal', '  tokens:', '    color-accent: "#e30613"', '    --radius: 2px',
        '  layouts: ./l', '  css: [./x.css]',
      ].join('\n'),
      'a.md': '# A',
      'l/kpi.css': '.layout-kpi { color: red }',
      'x.css': '.x { background: url(logo.svg) }',
      'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    })
    const r = await loadDeck(dir)
    expect(r.warnings).toEqual([])
    const i = (s: string) => r.themeCss.indexOf(s)
    expect(i('Theme "minimal"')).toBeGreaterThanOrEqual(0)
    expect(i('.layout-kpi')).toBeGreaterThan(i('Theme "minimal"'))
    expect(i('.x {')).toBeGreaterThan(i('.layout-kpi'))
    expect(i('--color-accent: #e30613;')).toBeGreaterThan(i('.x {'))
    expect(r.themeCss).toContain('--radius: 2px;')
    expect(r.themeCss).toContain('url("data:image/svg+xml;base64,')
    expect(r.themeFiles.length).toBeGreaterThanOrEqual(4)
  })

  it('liest einen Theme-Ordner (theme.css + layouts/) und meldet Fehler als Hinweis', async () => {
    const dir = await tempDeck({
      'deck.yaml': 'theme:\n  extends: ./acme\n  tokens:\n    "color-x": "a; b"\n  css: ./fehlt.css\n',
      'a.md': '# A',
      'acme/theme.css': ':root { --color-bg: #fff }',
      'acme/layouts/rahmen.css': '.layout-rahmen { color: blue } /* url(nix.png) */',
    })
    const r = await loadDeck(dir)
    expect(r.themeCss).toContain('--color-bg: #fff')
    expect(r.themeCss).toContain('.layout-rahmen')
    expect(r.themeCss).not.toContain('--color-x')
    expect(r.warnings.join('\n')).toMatch(/ungültiges Token/)
    expect(r.warnings.join('\n')).toMatch(/fehlt\.css/)
    expect(r.warnings.join('\n')).not.toMatch(/nix\.png/)
  })
})

describe('hashmark check (statisch)', () => {
  it('meldet unbekannte Layouts, Attribute und Übergänge, kennt Theme-Layouts', async () => {
    const { staticChecks } = await import('../src/core/check.ts')
    const dir = await tempDeck({
      'deck.yaml': 'theme:\n  extends: minimal\n  layouts: ./l\n',
      'l/kpi.css': '.layout-kpi { color: red }',
      'a.md': ['# A {layout=kpi}', '# B {layout=gibtsnicht foo=1 transition=wirbel}', '# C {layout=comparison fit}', '# D', '![](fehlt.png)'].join('\n'),
    })
    const findings = staticChecks(await loadDeck(dir))
    const text = findings.map((f) => `${f.level}:${f.message}`).join('\n')
    expect(findings.filter((f) => f.level === 'error')).toHaveLength(1)
    expect(text).toContain('Layout „gibtsnicht“ ist unbekannt')
    expect(text).toContain('Attribut „foo“')
    expect(text).toContain('transition „wirbel“')
    expect(text).toContain('Bild nicht gefunden')
    expect(text).not.toContain('„kpi“')
    expect(text).not.toContain('„fit“')
    expect(findings.find((f) => f.message.includes('gibtsnicht'))).toMatchObject({ file: 'a.md', line: 2 })
  })

  it('ein sauberes Deck hat keine Funde', async () => {
    const { staticChecks } = await import('../src/core/check.ts')
    const dir = await tempDeck({ 'a.md': '# A {layout=title}\n# B {layout=code-focus steps}\n- x' })
    expect(staticChecks(await loadDeck(dir))).toEqual([])
  })
})

describe('Editor: Vorschläge', () => {
  const at = async (text: string, opts = {}) => {
    const { completionAt } = await import('../src/core/complete.ts')
    return completionAt(text, text.length, opts)
  }
  it('Slash am Zeilenanfang bietet Bausteine, gefiltert', async () => {
    const all = await at('Text\n/')
    expect(all?.title).toBe('Bausteine')
    expect(all?.from).toBe(5)
    const hit = await at('/hin')
    expect(hit?.options[0].label).toBe('Hinweis')
    expect(await at('a /hin')).toBeNull()
  })
  it('::: erst mit Leertaste (oder explizit), sonst schließt es nur', async () => {
    expect(await at('::: col\nx\n:::')).toBeNull()
    expect((await at('::: st'))?.options[0].label).toBe('steps')
    expect((await at(':::', { explicit: true }))?.options.length).toBeGreaterThanOrEqual(14)
  })
  it('Attribute, Layout-Werte und Theme-Layouts in {…}', async () => {
    expect((await at('## T {'))?.title).toBe('Attribute')
    expect((await at('## T {la'))?.options[0].label).toBe('layout=')
    const layouts = await at('## T {layout=two')
    expect(layouts?.options.map((o) => o.label)).toEqual(['two-col', 'two-col-wide'])
    expect(layouts?.from).toBe('## T {layout='.length)
    expect((await at('## T {layout=', { layouts: ['kpi'] }))?.options.map((o) => o.label)).toContain('kpi')
    expect(await at('## T {layout=two-col} ')).toBeNull()
    expect((await at('## T {transition=f'))?.options[0].label).toBe('fade')
  })
  it('Hinweiskasten und Codesprachen, aber nie in Codeblöcken', async () => {
    expect((await at('> [!WA'))?.options[0].label).toBe('WARNING')
    expect((await at('```mer'))?.options[0].label).toBe('mermaid')
    expect(await at('```\n/hin')).toBeNull()
    expect(await at('```ts\nx\n```\n/hin')).not.toBeNull()
  })
})

describe('Editor: Linter', () => {
  it('meldet unbekanntes Layout mit Korrektur und exakter Stelle', async () => {
    const { lintText } = await import('../src/core/lint.ts')
    const text = '# A\n\n## B {layout=two-cols id=x}\n'
    const [p] = lintText(text)
    expect(p).toMatchObject({ line: 3, severity: 'error', fix: 'two-col' })
    expect(text.slice(p.from, p.to)).toBe('two-cols')
    expect(lintText('## B {layout=kpi}', { layouts: ['kpi'] })).toEqual([])
  })
  it('meldet Attribute, Übergänge, Container und ungeschlossene Blöcke', async () => {
    const { lintText } = await import('../src/core/lint.ts')
    const msgs = lintText('## A {foo=1 transition=wirbel}\n::: colums\nx\n:::\n:::\n::: col\nx\n```ts\nx').map((p) => p.message)
    expect(msgs.some((m) => m.includes('Attribut „foo“'))).toBe(true)
    expect(msgs.some((m) => m.includes('Übergang „wirbel“'))).toBe(true)
    expect(msgs.some((m) => m.includes('Container „colums“') && m.includes('columns'))).toBe(true)
    expect(msgs.some((m) => m.includes('Schließendes'))).toBe(true)
    expect(msgs.some((m) => m.includes('wird nicht geschlossen (fehlendes'))).toBe(true)
    expect(msgs.some((m) => m.includes('Codeblock'))).toBe(true)
  })
  it('ist bei sauberem Text und in Codeblöcken still', async () => {
    const { lintText } = await import('../src/core/lint.ts')
    const ok = '# A {layout=title}\n## B {steps fit .x #y duration=5m}\n::: columns cols=2\n::: col\nx\n:::\n:::\n```md\n::: foo\n## C {layout=nix}\n```\n## Mengen {a, b}\n'
    expect(lintText(ok)).toEqual([])
    expect(lintText('## Liste {stpes}')[0].fix).toBe('steps')
  })
})

describe('Editor: Brotkrumen', () => {
  it('liefert den Pfad vom Kapitel bis zum Detail', async () => {
    const { pathToNode } = await import('../src/core/sourcemap.ts')
    const dir = await tempDeck({ 'a.md': '# A\n## A1\n### A1a\n# B' })
    const deck = (await loadDeck(dir)).deck
    const a1a = deck.nodes[0].children[0].children[0]
    expect(pathToNode(deck.nodes, a1a.id).map((n) => n.title)).toEqual(['A', 'A1', 'A1a'])
    expect(pathToNode(deck.nodes, 'gibtsnicht')).toEqual([])
  })
})

describe('Editor: Bausteine', () => {
  it('expand markiert das Platzhalterwort hinter dem Cursor-Marker', async () => {
    const { expand } = await import('../src/core/snippets.ts')
    expect(expand('## §Titel {layout=two-col}')).toEqual({ text: '## Titel {layout=two-col}', cursor: 3, select: 5 })
    expect(expand('::: notes\n§\n:::')).toMatchObject({ cursor: 10, select: 0 })
    expect(expand('ohne')).toEqual({ text: 'ohne', cursor: 4, select: 0 })
  })
})

describe('Komponenten', () => {
  const timeline = '<ol class="tl">{{#each items}}<li{{#if step}} data-step="{{ step }}"{{/if}}>{{ number }}: {{{ html }}}</li>{{/each}}</ol>{{#if title}}<h3>{{ title }}</h3>{{/if}}{{{ body }}}'

  it('setzt Attribute, Listenpunkte (items) und den Rumpf (body) in die Vorlage', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n\n::: timeline title="Q & A <b>" steps start=2\n- eins\n- **zwei**\n\nRumpf mit `code`\n:::\n',
      'components/timeline.html': timeline,
    })
    const r = await loadDeck(dir)
    expect(r.warnings).toEqual([])
    const slide = r.deck.nodes[0].slides[0]
    expect(slide.html).toContain('<div class="d-timeline"><ol class="tl">')
    expect(slide.html).toContain('<li data-step="2">1: <p>eins</p></li>')
    expect(slide.html).toContain('<li data-step="3">2: <p><strong>zwei</strong></p></li>')
    expect(slide.html).toContain('<h3>Q &amp; A &lt;b&gt;</h3>') // Attribute werden maskiert
    expect(slide.html).toContain('<p>Rumpf mit <code>code</code></p>')
    expect(slide.steps.length).toBe(3) // höchster data-step
    const marker = r.themeCss.match(/--hm-components: "([^"]+)"/)![1]
    expect(Object.keys(JSON.parse(decodeURIComponent(marker)))).toContain('timeline') // Namen und Beschreibungen für den Editor
  })

  it('ohne steps keine data-step; Flag ohne Wert gilt als gesetzt', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n\n::: timeline\n- eins\n:::\n\n::: timeline steps\n- zwei\n:::\n',
      'components/timeline.html': timeline,
    })
    const html = (await loadDeck(dir)).deck.nodes[0].slides[0].html
    expect(html.match(/data-step/g)?.length).toBe(1)
  })

  it('Deck-Ordner schlägt Theme-Ordner; CSS aus components/ landet im Theme', async () => {
    const dir = await tempDeck({
      'deck.yaml': 'theme: ./acme\n',
      'a.md': '# A\n\n::: box\nX\n:::\n',
      'acme/theme.css': ':root { --color-bg: #fff }',
      'acme/components/box.html': '<i>Theme</i>{{{ body }}}',
      'acme/components/box.css': '.d-box i { color: red }',
      'components/box.html': '<b>Deck</b>{{{ body }}}',
    })
    const r = await loadDeck(dir)
    expect(r.deck.nodes[0].slides[0].html).toContain('<b>Deck</b>')
    expect(r.deck.nodes[0].slides[0].html).not.toContain('<i>Theme</i>')
    expect(r.themeCss).toContain('.d-box i { color: red }')
  })

  it('Bildfilter löst Pfade wie normale Bilder auf', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n\n::: person photo=anna.svg name=Anna\n:::\n::: person photo=fehlt.png\n:::\n',
      'anna.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
      'components/person.html': '<img src="{{ photo|image }}" alt="{{ name }}">',
    })
    const r = await loadDeck(dir)
    expect(r.deck.nodes[0].slides[0].html).toContain('<img src="deck-assets/anna.svg" alt="Anna">')
    expect(r.assets.length).toBe(1)
    expect(r.warnings.join('\n')).toMatch(/Bild nicht gefunden: fehlt\.png/)
  })

  it('meldet Fehler als Hinweis statt still zu scheitern', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n\n::: kaputt\nX\n:::\n\n::: still\nText ohne Platz\n:::\n\n::: cards\n:::\n',
      'components/kaputt.html': '<div>\n{{#each items}}\n</div>',
      'components/still.html': '<p>fest</p>',
      'components/cards.html': '<p>überschrieben?</p>',
    })
    const r = await loadDeck(dir)
    const w = r.warnings.join('\n')
    expect(w).toMatch(/Komponente „kaputt“.*Zeile 2.*nicht geschlossen/)
    expect(w).toMatch(/still: Inhalt wird von der Vorlage nicht verwendet/)
    expect(w).toMatch(/„cards“ ist ein eingebauter Container/)
    expect(r.deck.nodes[0].slides[0].html).toContain('<p>fest</p>')
  })

  it('Vorlagenfehler nennen die Zeile', () => {
    expect(() => parseTemplate('a\n{{#if x}}\nb')).toThrow(/Zeile 2/)
    expect(() => parseTemplate('{{/each}}')).toThrow(/ohne öffnendes/)
    expect(() => parseTemplate('{{#if a}}{{/each}}')).toThrow(/passt nicht/)
    expect(() => parseTemplate('{{ x|foo }}')).toThrow(/unbekannte Funktion/)
    expect(() => parseTemplate('{{ a b }}')).toThrow(/ungültig/)
    expect(() => parseTemplate('{{else}}')).toThrow(/#if/)
    expect(parseTemplate('{{! Kommentar }}{{#if a}}1{{else}}2{{/if}}').uses.has('a')).toBe(true)
  })

  it('Editor kennt eigene Container (Linter und Vorschläge)', () => {
    const text = '::: timeline\n- x\n:::\n'
    expect(lintText(text).map((p) => p.message).join()).toMatch(/Container „timeline“ ist unbekannt/)
    expect(lintText(text, { components: { timeline: {} } })).toEqual([])
    const c = completionAt('::: ti', 6, { components: { timeline: { description: 'Zeitstrahl' } } })
    expect(c?.options.map((o) => o.label)).toContain('timeline')
  })

  const kpisMeta = { kpis: { attrs: { title: 'Titel' }, flags: { steps: 'Schritte' }, children: { kpi: { attrs: { value: 'Zahl', label: 'Text' }, flags: { big: 'Groß' } } } } }

  it('Editor: Attribute und Kind-Container aus dem Kopf der Komponente', () => {
    // Linter: bekannte Kinder, unbekannte Attribute mit Korrektur
    const text = '::: kpis stepz\n::: kpi valu=1\n:::\n:::\n'
    const messages = lintText(text, { components: kpisMeta }).map((p) => p.message).join('\n')
    expect(messages).toMatch(/„stepz“ ist für kpis unbekannt.*„steps“/)
    expect(messages).toMatch(/„valu“ ist für kpi unbekannt.*„value“/)
    expect(messages).not.toMatch(/Container/)
    // Vorschläge: Attribute (ohne schon gesetzte), auch für Kinder
    const t1 = '::: kpis ti'
    expect(completionAt(t1, t1.length, { components: kpisMeta })?.options.map((o) => o.insert)).toEqual(['title='])
    const t2 = '::: kpi value=1 '
    expect(completionAt(t2, t2.length, { components: kpisMeta })?.options.map((o) => o.insert).sort()).toEqual(['big', 'label='])
    // Kind-Container werden als Container vorgeschlagen
    expect(completionAt('::: k', 5, { components: kpisMeta })?.options.map((o) => o.label)).toEqual(expect.arrayContaining(['kpis', 'kpi']))
    // in Anführungszeichen kein Vorschlag
    const t3 = '::: kpis title="a b'
    expect(completionAt(t3, t3.length, { components: kpisMeta })).toBeNull()
  })
})

describe('Komponenten: Kopf, Kinder, Bibliothek', () => {
  it('liest den Kopf {{!meta}} und behält die Zeilennummern der Datei', () => {
    const meta = parseTemplate('{{!meta\ndescription: Test\nattrs:\n  a: Eins\nflags:\n  b: Zwei\nrequired: a\nchildren:\n  k:\n    attrs:\n      v: Wert\n}}\n<p>{{ a }}</p>').meta
    expect(meta).toEqual({ description: 'Test', attrs: { a: 'Eins' }, flags: { b: 'Zwei' }, required: ['a'], children: { k: { attrs: { v: 'Wert' } } } })
    expect(() => parseTemplate('{{!meta\ndescription: x\n}}\n<p>\n{{#if x}}')).toThrow(/Zeile 5/)
    expect(() => parseTemplate('{{!meta\nattrs: [a\n}}\n')).toThrow(/YAML/)
    expect(() => parseTemplate('{{!meta\nattrs: 5\n}}\n')).toThrow(/Liste/)
  })

  it('eingebaute Komponenten stehen in jedem Deck bereit', async () => {
    const r = await loadDeck(await tempDeck({ 'a.md': '# A\n\n::: process steps\n- **Eins** a\n- **Zwei** b\n:::\n' }))
    expect(r.warnings).toEqual([])
    expect(r.deck.nodes[0].slides[0].html).toContain('class="process-step" data-step="2"')
    expect(r.themeCss).toContain('.d-process')
    const names = Object.keys(JSON.parse(decodeURIComponent(r.themeCss.match(/--hm-components: "([^"]+)"/)![1])))
    expect(names).toEqual(expect.arrayContaining(['timeline', 'person', 'process', 'kpis']))
  })

  it('kpis: Kind-Container, Schritte, eigene Schrittnummer und Anmerkung', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n\n::: kpis steps title="Q1 & Q2"\n::: kpi value="87 %" label="Zufriedenheit" trend=up delta="+4 %"\n:::\n::: kpi value=42 label=Teams step=1\nAnmerkung **fett**\n:::\n:::\n',
    })
    const r = await loadDeck(dir)
    expect(r.warnings).toEqual([])
    const html = r.deck.nodes[0].slides[0].html
    expect(html).toContain('<div class="kpis-title">Q1 &amp; Q2</div>')
    expect(html).toContain('<div class="kpi kpi-up" data-step="1">')
    expect(html).toContain('<div class="kpi" data-step="1">') // eigenes step=1 gewinnt gegen den Zähler (2)
    expect(html).toContain('<div class="kpi-value">87 %</div>')
    expect(html).toContain('<div class="kpi-delta">+4 %</div>')
    expect(html).toContain('<p>Anmerkung <strong>fett</strong></p>')
    expect(html).not.toContain('d-kpi"') // das Kind wurde zur Kachel, kein eigener Container
  })

  it('prüft Attribute gegen den Kopf: unbekannt (mit Vorschlag), Pflicht, unbekanntes Kind', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n\n::: kpis stepz\n::: kpi label=x\n:::\n::: foo\n:::\n:::\n\n::: person\n:::\n',
    })
    const w = (await loadDeck(dir)).warnings.join('\n')
    expect(w).toMatch(/kpis: Attribut „stepz“ ist unbekannt \(meintest du „steps“\?\)/)
    expect(w).toMatch(/kpis › kpi: Attribut „value“ fehlt/)
    expect(w).toMatch(/kpis: „foo“ ist hier unbekannt \(erlaubt: kpi\)/)
    expect(w).toMatch(/person: Attribut „name“ fehlt/)
  })
})

describe('Komponenten im Editor: Gerüst, Prüfung, Vorschläge', () => {
  it('erkennt Komponentendateien nur unter components/', () => {
    expect(componentKind('components/fact.html')).toBe('template')
    expect(componentKind('theme/components/fact.CSS')).toBe('style')
    expect(componentKind('fact.html')).toBeNull()
    expect(componentKind('components/unter/fact.html')).toBeNull()
    expect(COMPONENT_FILE.test('mycomponents/fact.html')).toBe(false)
  })

  it('prüft Namen: Schreibweise und eingebaute Container', () => {
    expect(componentNameProblem('merksatz')).toBeNull()
    expect(componentNameProblem('Merksatz')).toMatch(/Kleinbuchstaben/)
    expect(componentNameProblem('1abc')).toMatch(/Kleinbuchstaben/)
    expect(componentNameProblem('cards')).toMatch(/eingebauter Container/)
  })

  it('Gerüst: einfacher Kasten ist gültig, hat Kopf mit Beispiel und lädt ohne Hinweise', async () => {
    const { html, css } = scaffoldComponent({ name: 'merksatz', description: 'Hervorgehobener Satz', attrs: ['title'] })
    const t = parseTemplate(html)
    expect(t.meta).toMatchObject({ description: 'Hervorgehobener Satz', required: ['title'] })
    expect(t.meta?.example).toContain('::: merksatz title="Titel"')
    expect(lintTemplate(html)).toEqual([])
    expect(css).toContain('.d-merksatz')
    const dir = await tempDeck({ 'a.md': '# A\n\n' + t.meta!.example, 'components/merksatz.html': html, 'components/merksatz.css': css })
    const r = await loadDeck(dir)
    expect(r.warnings).toEqual([])
    expect(r.deck.nodes[0].slides[0].html).toContain('class="merksatz-title">Titel</div>')
  })

  it('Gerüst: mit Kind-Containern lädt das Beispiel ohne Hinweise', async () => {
    const { html } = scaffoldComponent({ name: 'ablauf', attrs: ['title', 'untertitel'], children: true })
    const t = parseTemplate(html)
    expect(Object.keys(t.meta?.children ?? {})).toEqual(['ablauf-eintrag'])
    expect(t.meta?.attrs).toHaveProperty('untertitel')
    const dir = await tempDeck({ 'a.md': '# A\n\n' + t.meta!.example, 'components/ablauf.html': html })
    const r = await loadDeck(dir)
    expect(r.warnings).toEqual([])
    expect(r.deck.nodes[0].slides[0].html).toContain('<strong>Erster</strong>')
  })

  it('Gerüst lehnt schlechte Namen und Attribute ab', () => {
    expect(() => scaffoldComponent({ name: 'cards' })).toThrow(/eingebauter Container/)
    expect(() => scaffoldComponent({ name: 'ok', attrs: ['Titel!'] })).toThrow(/Attribute/)
  })

  it('lintTemplate nennt Zeile und Ursache', () => {
    expect(lintTemplate('<p>{{ a }}</p>')).toEqual([])
    const open = lintTemplate('<div>\n{{#each items}}\n</div>')
    expect(open).toHaveLength(1)
    expect(open[0]).toMatchObject({ line: 2, severity: 'error' })
    expect(open[0].message).toMatch(/nicht geschlossen/)
    expect(open[0].from).toBe(6)
    const head = lintTemplate('{{!meta\nattrs: [a\n}}\n')
    expect(head[0]).toMatchObject({ line: 1, from: 0 })
    expect(head[0].message).toMatch(/YAML/)
  })

  it('completeTemplate schlägt Attribute aus dem Kopf, eingebaute Namen und Blöcke vor', () => {
    const text = '{{!meta\nattrs:\n  title: Überschrift\nflags:\n  wide: breit\n}}\n<p>{{ ti'
    const r = completeTemplate(text, text.length)!
    expect(r.options.map((o) => o.label)).toEqual(['title'])
    expect(r.from).toBe(text.length - 2)
    const all = completeTemplate(text.replace(/ti$/, ''), text.length - 2)!
    expect(all.options.map((o) => o.label)).toEqual(expect.arrayContaining(['title', 'wide', 'body', 'children', '#each', '/each', 'else']))
    expect(completeTemplate('<p>{{{ bo', 9)!.options.map((o) => o.label)).toEqual(['body'])
    expect(completeTemplate('<p>Text', 7)).toBeNull()
    expect(completeTemplate('{{ zzz', 6)).toBeNull()
  })
})

describe('Komponenten: Funktionsbausteine', () => {
  const warns: string[] = []
  const env = { image: (u: string) => `IMG:${u}`, warn: (m: string) => { warns.push(m) } }
  const kid = (name: string, attributes: Record<string, string>) => ({ type: 'containerDirective', name, attributes, children: [] }) as never
  const render = (template: string, attrs: Record<string, string>, children: unknown[] = []) =>
    (expandComponent(parseTemplate(template), { name: 't', attrs, children: children as never[] }, env) as { value?: string }[]).map((n) => n.value ?? '').join('')
  const problem = (template: string) => {
    try { parseTemplate(template) } catch (e) { return e instanceof TemplateError ? e.message : String(e) }
    return null
  }

  it('liest Zahlen mit Komma, Punkt und Prozentzeichen', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5)
    expect(parseNumber('1,234.5')).toBe(1234.5)
    expect(parseNumber('1,5')).toBe(1.5)
    expect(parseNumber('72 %')).toBe(72)
    expect(parseNumber('1.234.567')).toBe(1234567)
    expect(parseNumber('abc')).toBeNull()
  })

  it('rechnet und formatiert: percent, number, default, upper, truncate', () => {
    expect(render('{{ v | percent:max }}', { v: '72', max: '96' })).toBe('75%')
    expect(render('{{ v | percent:100:1 }}', { v: '72,55' })).toBe('72.6%')
    expect(render('{{ v | number:1 }}', { v: '1234.56' })).toBe('1.234,6')
    expect(render('{{ v | number:1:"en" }}', { v: '1234.56' })).toBe('1,234.6')
    expect(render('{{ v | default:"–" }}', {})).toBe('–')
    expect(render('{{ v | default:alt }}', { alt: 'Ersatz' })).toBe('Ersatz')
    expect(render('{{ v | default:"–" }}', { v: 'da' })).toBe('da')
    expect(render('{{ v | upper | truncate:2 }}', { v: 'abc' })).toBe('A…')
    expect(render('{{ v | image }}', { v: 'a.png' })).toBe('IMG:a.png')
  })

  it('formatiert Datum in der Sprache des Decks und kennt Stichwörter', () => {
    expect(render('{{ d | date:long }}', { d: '2026-10-29' })).toBe('29. Oktober 2026')
    expect(render('{{ d | date:short:"en" }}', { d: '2026-10-29' })).toBe('10/29/2026')
    expect(render('{{ d | date:iso }}', { d: '2026-10-29' })).toBe('2026-10-29')
    expect(problem('{{ d | date:fancy }}')).toMatch(/„fancy“ ist unbekannt/)
  })

  it('fasst Kind-Container zusammen: sum, max, min', () => {
    const kids = [kid('bar', { value: '72' }), kid('bar', { value: '48,5' }), kid('bar', { value: '95' })]
    expect(render('{{ children | sum:value }}|{{ children | max:value }}|{{ children | min:value | number:1 }}', {}, kids)).toBe('215.5|95|48,5')
    expect(render('{{ children | sum:value | number:1 }}', {}, kids)).toBe('215,5')
    expect(render('{{#each children}}{{ value | percent:100 }};{{/each}}', {}, kids)).toBe('72%;49%;95%;')
  })

  it('vergleicht in {{#if}}: is, is not und Zahlen', () => {
    expect(render('{{#if t is up}}U{{else}}N{{/if}}', { t: 'UP' })).toBe('U')
    expect(render('{{#if t is not up}}X{{else}}Y{{/if}}', { t: 'up' })).toBe('Y')
    expect(render('{{#if v > 50}}hoch{{else}}tief{{/if}}', { v: '72' })).toBe('hoch')
    expect(render('{{#if v <= 50}}hoch{{else}}tief{{/if}}', { v: '72' })).toBe('tief')
    expect(render('{{#if v is 5}}ja{{/if}}', { v: '5,0' })).toBe('ja')
    expect(render('{{#if t is "a b"}}ja{{/if}}', { t: 'a b' })).toBe('ja')
  })

  it('meldet Fehler beim Lesen der Vorlage mit Zeile', () => {
    expect(problem('{{ v | foo }}')).toMatch(/^Zeile 1: unbekannte Funktion „foo“ \(erlaubt: /)
    expect(problem('\n{{ v | percent:a:b:c }}')).toMatch(/^Zeile 2: „percent“ braucht 0 bis 2 Argumente/)
    expect(problem('{{ v | sum:"x" }}')).toMatch(/Name eines Feldes/)
    expect(problem('{{ v | default }}')).toMatch(/braucht 1 Argument/)
    expect(problem('{{{ body | upper }}}')).toMatch(/keine Funktionen/)
    expect(problem('{{#if v > abc}}x{{/if}}')).toMatch(/vergleicht Zahlen/)
    expect(problem('{{#each c is 1}}{{/each}}')).toMatch(/kennt keinen Vergleich/)
    expect(problem('{{ v | default:a b }}')).toMatch(/ungültiges Argument/)
    expect(FUNCTION_NAMES).toEqual(expect.arrayContaining(['default', 'percent', 'number', 'date', 'sum', 'max', 'min', 'upper', 'lower', 'truncate', 'image']))
  })

  it('meldet Fehler beim Ausführen als Hinweis und zeigt den Wert unverändert', () => {
    warns.length = 0
    expect(render('{{ v | percent:max }}', { v: 'abc', max: '10' })).toBe('abc')
    expect(warns[0]).toMatch(/keine Zahl/)
    warns.length = 0
    render('{{ v | sum:x }}', { v: '1' })
    expect(warns[0]).toMatch(/Liste/)
    warns.length = 0
    render('{{ children | upper }}', {}, [kid('a', {})])
    expect(warns[0]).toMatch(/einzelnen Wert/)
    warns.length = 0
    render('{{ d | date }}', { d: '2026-13-40' })
    expect(warns[0]).toMatch(/gültiges Datum/)
  })

  it('maskiert das Ergebnis von Funktionen', () => {
    expect(render('{{ v | default:"<b>" }}', {})).toBe('&lt;b&gt;')
  })

  it('Standardwerte im Kopf gelten, wenn das Attribut fehlt, und erfüllen „required“', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n\n::: gauge\n:::\n\n::: gauge unit=" kg"\n:::\n',
      'components/gauge.html': '{{!meta\nattrs:\n  unit: Einheit\nrequired: unit\ndefaults:\n  unit: " Mio."\n}}\n<i>{{ unit }}</i>',
    })
    const r = await loadDeck(dir)
    expect(r.warnings).toEqual([])
    const html = r.deck.nodes[0].slides[0].html
    expect(html).toContain('<i> Mio.</i>')
    expect(html).toContain('<i> kg</i>')
  })

  it('Editor schlägt nach | die Funktionen vor', () => {
    const text = '<p>{{ value | pe'
    const r = completeTemplate(text, text.length)!
    expect(r.options.map((o) => o.label)).toEqual(['percent'])
    expect(r.from).toBe(text.length - 2)
    expect(completeTemplate('{{ v | upper | ', 15)!.options.map((o) => o.label)).toContain('truncate')
    expect(completeTemplate('{{ v | default:"a|b" | tr', 25)!.options.map((o) => o.label)).toEqual(['truncate'])
    expect(completeTemplate('{{ v | default:"a|', 17)).toBeNull() // noch im Text in Anführungszeichen
  })
})
