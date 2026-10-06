// Dokumentation (GitLab Pages): das Handbuch ist ein gültiges Deck, die Beispiele der Startseite stammen aus seinen Quelltexten.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { DEMOS, demosFromHandbook, docsDir, sectionSource } from '../scripts/build-docs.ts'
import { landingPage } from '../scripts/docs-landing.ts'

describe('Handbuch (docs/)', () => {
  it('lädt ohne Hinweise und hat die Knoten für die Beispiele', async () => {
    const { deck, warnings } = await loadDeck(docsDir)
    expect(warnings).toEqual([])
    const ids = new Set<string>()
    const walk = (nodes: typeof deck.nodes) => nodes.forEach((n) => { ids.add(n.id); walk(n.children) })
    walk(deck.nodes)
    for (const d of DEMOS) expect(ids.has(d.id), `Knoten ${d.id}`).toBe(true)
  })

  it('jedes Kapitel hat einen Erklärtext in den Notizen (Lesemodus)', async () => {
    const { deck } = await loadDeck(docsDir)
    const without = deck.nodes.filter((n) => !n.slides.some((s) => s.notes))
    expect(without.map((n) => n.title)).toEqual([])
  })

  it('liest die Quelltexte der Beispiele aus den Markdown-Dateien', async () => {
    const demos = await demosFromHandbook()
    const steps = demos.find((d) => d.id === 'schritte')!
    expect(steps.source).toContain('# Schritte')
    expect(steps.source).toContain('::: steps')
    expect(steps.source).not.toContain('::: notes') // Notizen gehören nicht zum Beispiel
    expect(steps.steps).toBe(3)
    const formula = demos.find((d) => d.id === 'formeln')!
    expect(formula.source).toContain('\\htmlData')
    expect(formula.steps).toBe(2)
  })
})

describe('Abschnitt eines Knotens', () => {
  it('endet an der nächsten Überschrift, nicht in einem Codeblock', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashmark-docs-'))
    const file = path.join(dir, 'a.md')
    fs.writeFileSync(file, '# Eins\n\n```md\n# keine Überschrift\n```\n\ntext\n\n## Zwei\n\nanderes\n')
    const src = sectionSource('a.md', 1, dir)
    expect(src).toContain('# keine Überschrift')
    expect(src).toContain('text')
    expect(src).not.toContain('## Zwei')
  })
})

describe('Startseite', () => {
  const html = landingPage({
    title: 'T', projectUrl: 'https://gitlab.example/g/p',
    demos: [{ tab: 'A', id: 'baum', steps: 2, file: 'a.md', source: '# A <b>&</b>', hint: 'h' }],
  })

  it('bettet die Beispiele mit Quelltext ein und maskiert ihn', () => {
    expect(html).toContain('handbuch/?card')
    expect(html).toContain('handbuch/?reader')
    expect(html).toContain('"source":"# A \\u003cb>&\\u003c/b>"')
    expect(html).not.toContain('<b>&</b>')
  })

  it('verlinkt die Releases des Projekts und braucht nichts von außen', () => {
    expect(html).toContain('https://gitlab.example/g/p/-/releases')
    expect(html).not.toMatch(/(src|href)="https?:\/\/(?!gitlab\.example)/)
    expect(html).not.toMatch(/url\(https?:/)
  })
})
