// Stufe 1 „vortragsreif“: Code-Zeilen, Hinweiskästen, Layouts, Agenda, Notizen, Zeitplanung, Suche.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { gridColumns, parseLineHighlights } from '../src/core/render.ts'
import { printPages, DEFAULT_PRINT } from '../src/core/print.ts'
import { formatClock, pace, parseDuration } from '../src/core/timing.ts'
import { buildSearchIndex, htmlToText, search } from '../src/core/search.ts'
import type { DeckNode } from '../src/core/types.ts'

async function tempDeck(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'strata-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

const n = (id: string, slides = 1): DeckNode => ({
  id, title: id, depth: 1, attrs: {}, children: [],
  slides: Array.from({ length: slides }, () => ({ html: '', steps: [] })), source: { file: '', line: 1 },
})

describe('Code-Zeilen hervorheben', () => {
  it('parst Abschnitte, all bzw. leer dunkelt nichts ab', () => {
    expect(parseLineHighlights('2-3|5,7|all|').map((s) => (s ? [...s] : null))).toEqual([[2, 3], [5, 7], null, null])
  })
  it('markiert Zeilen je Abschnitt und zählt Abschnitte als Schritte', async () => {
    const dir = await tempDeck({ 'a.md': '# A\n```ts {lines="1|2-3|all"}\nconst a = 1\nconst b = 2\nconst c = 3\n```' })
    const slide = (await loadDeck(dir)).deck.nodes[0].slides[0]
    expect(slide.html).toContain('data-hl-count="3"')
    expect(slide.html).toContain('data-hl-all=" 2 "')
    expect(slide.html).toContain('data-hl=" 0 "')
    expect(slide.html.match(/data-hl=" 1 "/g)).toHaveLength(2)
    expect(slide.steps).toHaveLength(2)
  })
  it('ein einzelner Abschnitt hebt statisch hervor, ohne Schritt', async () => {
    const dir = await tempDeck({ 'a.md': '# A\n```ts {lines="2"}\na\nb\n```' })
    const slide = (await loadDeck(dir)).deck.nodes[0].slides[0]
    expect(slide.steps).toHaveLength(0)
    expect(slide.html).toContain('data-hl-count="1"')
  })
})

describe('Hinweiskästen', () => {
  it('macht aus > [!TYP] einen Kasten mit deutschem oder eigenem Titel', async () => {
    const dir = await tempDeck({
      'a.md': '# A\n> [!WARNING]\n> Vorsicht **heiß**\n\n> [!TIP] Mein Tipp\n> Text\n\n> [!UNBEKANNT]\n> bleibt Zitat\n\n> normales Zitat',
    })
    const html = (await loadDeck(dir)).deck.nodes[0].slides[0].html
    expect(html).toContain('<div class="callout callout-warning">\n<p class="callout-title">Warnung</p>')
    expect(html).toContain('Vorsicht <strong>heiß</strong>')
    expect(html).not.toContain('[!WARNING]')
    expect(html).toContain('<p class="callout-title">Mein Tipp</p>')
    expect(html).toContain('<blockquote>\n<p>[!UNBEKANNT]')
    expect(html).toContain('<blockquote>\n<p>normales Zitat')
  })
})

describe('Spalten und Layouts', () => {
  it('übersetzt cols in grid-template-columns', async () => {
    expect(gridColumns('3')).toBe('repeat(3,minmax(0,1fr))')
    expect(gridColumns('2:1')).toBe('minmax(0,2fr) minmax(0,1fr)')
    expect(gridColumns('300px 1fr')).toBe('300px 1fr')
    const dir = await tempDeck({ 'a.md': '# A\n::: columns cols=3\n::: col\n1\n:::\n:::' })
    expect((await loadDeck(dir)).deck.nodes[0].slides[0].html).toContain('grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:row')
  })
  it('wählt Layouts nach Attribut, dann nach Ebene, dann Deck-Default', async () => {
    const dir = await tempDeck({
      'deck.yaml': 'layout: two-col\nlayouts:\n  1: section\nmount:\n  - file: a.md\n',
      'a.md': '# A\n## B\n## C {layout=quote}',
    })
    const { deck } = await loadDeck(dir)
    expect(deck.nodes[0].layout).toBe('section')
    expect(deck.nodes[0].children.map((c) => c.layout)).toEqual(['two-col', 'quote'])
  })
  it('teilt bei image-right das erste Bild bzw. Diagramm ab', async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgo='
    const dir = await tempDeck({
      'a.md': `# A {layout=image-right}\n- Punkt\n\n![Bild](${PNG}){width=80%}\n\n---\n\n\`\`\`mermaid\nflowchart LR\n a\n\`\`\`\nText\n\n---\n\nnur Text`,
    })
    const [s1, s2, s3] = (await loadDeck(dir)).deck.nodes[0].slides
    expect(s1.html).toMatch(/^<div class="media"><p><img src="data:image\/png[^>]*style="width:80%"[^>]*><\/p><\/div><div class="body"><ul>/)
    expect(s2.html).toMatch(/^<div class="media"><div class="mermaid-block">/)
    expect(s3.html).not.toContain('class="media"')
  })
  it('löst Hintergründe auf: Farbe bleibt, Bild wird URL', async () => {
    const dir = await tempDeck({
      'a.md': '# A {bg=#112233}\n# B {bg="linear-gradient(red, blue)"}\n# C {bg=bilder/x.png}',
      'bilder/x.png': 'x',
    })
    const { deck, assets } = await loadDeck(dir)
    expect(deck.nodes.map((x) => x.attrs.bg)).toEqual([
      '#112233', 'linear-gradient(red, blue)', 'url("deck-assets/bilder/x.png") center / cover no-repeat',
    ])
    expect(assets.map((a) => path.basename(a))).toEqual(['x.png'])
  })
})

describe('Agenda', () => {
  it('listet die Kapitel mit Stand: erledigt, nächstes bzw. aktuelles', async () => {
    const dir = await tempDeck({
      'a.md': '# Titel {layout=title}\n# Agenda {layout=agenda}\n# Eins\n## Mitte {layout=agenda}\n# Zwei\n## Z1\n# Wo stehen wir {layout=agenda}\n# Drei',
    })
    const { deck } = await loadDeck(dir)
    const items = (html: string) => [...html.matchAll(/<li class="agenda-(\w+)"><a href="#([^"]+)"/g)].map((m) => `${m[2]}:${m[1]}`)
    expect(items(deck.nodes[1].slides[0].html)).toEqual(['eins:next', 'zwei:todo', 'drei:todo'])
    expect(items(deck.nodes[2].children[0].slides[0].html)).toEqual(['eins:current', 'zwei:todo', 'drei:todo'])
    expect(items(deck.nodes[4].slides[0].html)).toEqual(['eins:done', 'zwei:done', 'drei:next'])
    expect(deck.nodes[3].slides[0].html).toBe('')
    expect(deck.nodes[1].slides[0].html).toContain('<span class="agenda-count">1 Details</span>')
  })
})

describe('Notizen pro Sub-Slide und Schritt', () => {
  it('ordnet Notizen der Sub-Slide zu und markiert Schritt-Notizen', async () => {
    const dir = await tempDeck({
      'a.md': '# A\neins\n\n::: notes\nzu eins\n:::\n\n---\n\nzwei\n\n::: notes step=1\nbeim ersten Schritt\n:::\n\n<!-- notes -->\nRest',
    })
    const node = (await loadDeck(dir)).deck.nodes[0]
    expect(node.slides[0].notes).toBe('<p>zu eins</p>')
    expect(node.slides[1].notes).toContain('<div data-note-step="1" class="d-note-step"><p>beim ersten Schritt</p></div>')
    expect(node.slides[1].notes).toContain('<p>Rest</p>')
    expect(node.slides[1].html).not.toContain('beim ersten')
    expect(node.notes).toContain('zu eins')
    expect(node.notes).toContain('Rest')
  })
  it('Handout: Notizen auf der ersten Seite jeder Sub-Slide', () => {
    const node: DeckNode = { ...n('a', 2), slides: [{ html: '', steps: [{ selector: '', state: {} }] }, { html: '', steps: [] }] }
    const pages = printPages([node], { ...DEFAULT_PRINT, steps: true })
    expect(pages.map((p) => `${p.slide}:${p.step}:${p.slideFirst}`)).toEqual(['0:0:true', '0:1:false', '1:0:true'])
  })
})

describe('Zeitplanung', () => {
  it('parst Dauern', () => {
    expect(parseDuration('5m')).toBe(300)
    expect(parseDuration('90s')).toBe(90)
    expect(parseDuration('1h30m')).toBe(5400)
    expect(parseDuration('1h 30min')).toBe(5400)
    expect(parseDuration('2.5m')).toBe(150)
    expect(parseDuration('1:30')).toBe(90)
    expect(parseDuration('10')).toBe(600)
    expect(parseDuration(30)).toBe(1800)
    expect(parseDuration('bald')).toBeUndefined()
    expect(parseDuration('5x')).toBeUndefined()
    expect(parseDuration(undefined)).toBeUndefined()
  })
  it('formatiert Uhrzeiten und bewertet das Tempo', () => {
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(-30)).toBe('-0:30')
    expect(pace(0.5, 900, 1800)).toBe('on-time')
    expect(pace(0.2, 900, 1800)).toBe('behind')
    expect(pace(0.8, 900, 1800)).toBe('ahead')
  })
  it('übernimmt duration aus Knoten und deck.yaml und warnt bei Unsinn', async () => {
    const dir = await tempDeck({ 'deck.yaml': 'duration: 30m\nmount:\n  - file: a.md\n', 'a.md': '# A {duration=5m}\n# B {duration=bald}' })
    const { deck, warnings } = await loadDeck(dir)
    expect(deck.duration).toBe(1800)
    expect(deck.nodes[0].duration).toBe(300)
    expect(deck.nodes[1].duration).toBeUndefined()
    expect(warnings).toEqual([expect.stringContaining('bald')])
  })
})

describe('Suche', () => {
  it('findet Titel vor Pfad vor Text, ohne Umlaute, mit Ausschnitt', async () => {
    expect(htmlToText('<p>a &amp; <b>b</b></p><pre class="mermaid-src">flowchart</pre>')).toBe('a & b')
    const dir = await tempDeck({
      'a.md': '# Architektur\nÜberblick\n## Parser\nremark und Direktiven\n---\nZweite Folie mit Tokens\n# Fazit\nParser erwähnt',
    })
    const index = buildSearchIndex((await loadDeck(dir)).deck.nodes)
    expect(index).toHaveLength(4)
    const hits = search(index, 'parser')
    expect(hits.map((h) => `${h.id}:${h.slide}`)).toEqual(['architektur/parser:0', 'fazit:0'])
    expect(hits[0].trail).toEqual(['Architektur'])
    expect(hits[1].snippet).toContain('Parser erwähnt')
    expect(search(index, 'uberblick').map((h) => h.id)).toEqual(['architektur'])
    expect(search(index, 'tokens').map((h) => `${h.id}:${h.slide}`)).toEqual(['architektur/parser:1'])
    expect(search(index, 'arch pars').map((h) => h.id)[0]).toBe('architektur/parser')
    expect(search(index, 'arpa').map((h) => h.id)).toEqual(['architektur/parser']) // unscharf über Pfad + Titel
    expect(search(index, '   ')).toEqual([])
  })
})

describe('Titel-Folie auf tieferer Ebene', () => {
  it('Größe je Ebene hat keine höhere Spezifität als die Layouts', async () => {
    const css = await fs.readFile(path.join(import.meta.dirname, '../src/runtime/base.css'), 'utf8')
    expect(css).not.toMatch(/^\.slide\[data-depth="\d"\] \.slide-title/m)
    expect(css).toMatch(/:where\(\.slide\[data-depth="2"\]\) \.slide-title/)
  })
})
