// Neue Bausteine: Komponenten versus, roadmap, pyramid, matrix, aside und die Layouts image-full, split, diagram, two-col-wide.

import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { BUILTIN_LAYOUTS } from '../src/core/check.ts'
import { loadDeck } from '../src/core/deck.ts'
import { LAYOUT_INFO } from '../src/core/vocab.ts'
import type { DeckNode } from '../src/core/types.ts'

const flat = (nodes: DeckNode[]): DeckNode[] => nodes.flatMap((n) => [n, ...flat(n.children)])

describe('Bausteine im Beispiel-Deck', () => {
  it('laden ohne Hinweise und erzeugen das Markup der Komponenten', async () => {
    const { deck, warnings } = await loadDeck(path.resolve('examples/komponenten-demo'))
    expect(warnings).toEqual([])
    const html = flat(deck.nodes).flatMap((n) => n.slides.map((s) => s.html)).join('\n')
    expect(html).toContain('versus-grid')
    expect(html).toContain('versus-before')
    expect(html).toContain('versus-after')
    expect(html).toMatch(/data-done="2"/)
    expect(html).toMatch(/--today: 41%/)
    expect(html).toContain('pyramid-levels')
    expect(html).toMatch(/style="--n: 4"/)
    expect(html).toContain('matrix-cell')
    expect(html).toMatch(/data-focus="2"/)
    expect(html).toContain('class="aside"')
  })

  it('„Nachher“ erscheint mit seinem Schritt', async () => {
    const { deck } = await loadDeck(path.resolve('examples/komponenten-demo'))
    const versus = flat(deck.nodes).find((n) => n.title === 'Vorher und Nachher')!
    expect(versus.slides[0].html).toMatch(/versus-after"[^>]*data-step="1"/)
    expect(versus.slides[0].steps.length).toBe(1)
  })

  it('die Layouts sind eingebaut und beschrieben', () => {
    for (const name of ['image-full', 'split', 'diagram', 'two-col-wide', 'contact', 'kpi', 'big-number', 'gallery', 'timeline', 'blank']) {
      expect(BUILTIN_LAYOUTS).toContain(name)
      expect(LAYOUT_INFO[name]).toBeTruthy()
    }
  })
})
