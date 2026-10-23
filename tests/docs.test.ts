// Dokumentation (statische Seiten): das Handbuch ist ein gültiges Deck, die Beispiele der Startseite stammen aus seinen Quelltexten.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { DEMOS, cardSteps, demosFromHandbook, docsDir, sectionSource } from '../scripts/build-docs.ts'
import { FEATURES, SHOTS, fallbackUrl, featurePage, featuresIndexPage } from '../scripts/docs-features.ts'
import { landingPage } from '../scripts/docs-landing.ts'
import { BUILTIN_LAYOUTS, CONTAINERS, KNOWN_ATTRS, TRANSITIONS } from '../src/core/vocab.ts'

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
    const chapters = deck.nodes.flatMap((n) => [n, ...n.children])
    const without = chapters.filter((n) => !n.slides.some((s) => s.notes))
    expect(without.map((n) => n.title)).toEqual([])
  })

  it('hat die drei Teile, die Themen heißen wie die Funktionsseiten', async () => {
    const { deck } = await loadDeck(docsDir)
    expect(deck.nodes.map((n) => n.id)).toEqual(['start', 'lernen', 'themen', 'nachschlagen'])
    const themen = deck.nodes.find((n) => n.id === 'themen')!.children
    expect(themen.map((n) => n.title)).toEqual(FEATURES.map((f) => f.title))
    expect(themen.map((n) => n.id)).toEqual(FEATURES.map((f) => f.doc))
  })

  it('die Tabellen unter „Nachschlagen“ nennen alles, was die App kennt', () => {
    const text = fs.readFileSync(path.join(docsDir, 'nachschlagen', '01-syntax.md'), 'utf8')
    const missing = [
      ...BUILTIN_LAYOUTS.filter((l) => !text.includes(`| \`${l}\` |`)).map((l) => `Layout ${l}`),
      ...TRANSITIONS.filter((t) => !text.includes(`| \`${t}\` |`)).map((t) => `Übergang ${t}`),
      ...CONTAINERS.filter((c) => !text.includes(`| \`::: ${c}\` |`)).map((c) => `Container ${c}`),
      ...KNOWN_ATTRS.filter((a) => !(a === 'class' ? text.includes('`.klasse`') : new RegExp(`\\| \`${a}[=\`]`).test(text))).map((a) => `Attribut ${a}`),
    ]
    expect(missing).toEqual([])
  })

  it('liest die Quelltexte der Beispiele aus den Markdown-Dateien', async () => {
    const demos = await demosFromHandbook()
    const steps = demos.find((d) => d.id === 'themen/schritte')!
    expect(steps.source).toContain('# Schritte')
    expect(steps.source).toContain('::: steps')
    expect(steps.source).not.toContain('::: notes') // Notizen gehören nicht zum Beispiel
    expect(steps.steps).toBe(3)
    const formula = demos.find((d) => d.id === 'themen/medien/formeln')!
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
    title: 'T', projectUrl: 'https://github.example/g/p',
    demos: [{ tab: 'A', id: 'baum', steps: 2, file: 'a.md', source: '# A <b>&</b>', hint: 'h' }],
  })

  it('bettet die Beispiele mit Quelltext ein und maskiert ihn', () => {
    expect(html).toContain('handbuch/?card')
    expect(html).toContain('handbuch/?reader')
    expect(html).toContain('"source":"# A \\u003cb>&\\u003c/b>"')
    expect(html).not.toContain('<b>&</b>')
  })

  it('verlinkt die Releases des Projekts und braucht nichts von außen', () => {
    expect(html).toContain('https://github.example/g/p/releases')
    expect(html).not.toMatch(/(src|href)="https?:\/\/(?!github.example)/)
    expect(html).not.toMatch(/url\(https?:/)
  })
})

describe('Funktionsseiten', () => {
  it('jede eingebettete Folie und jeder Verweis ins Handbuch existiert', async () => {
    const stepsOf = await cardSteps()
    expect(stepsOf(FEATURES.find((f) => f.id === 'schritte')!.card)).toBe(3)
  })

  it('jede Rubrik hat ein Vorschaubild aus der Liste der Aufnahmen, Namen sind eindeutig', () => {
    const names = SHOTS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
    for (const f of FEATURES) {
      expect(names, f.id).toContain(f.thumb)
      for (const h of f.highlights) if (h.shot) expect(names, `${f.id}: ${h.title}`).toContain(h.shot)
      for (const h of f.highlights) expect(fallbackUrl(h), `${f.id}: ${h.title} braucht eine Folie, falls das Bild fehlt`).toBeTruthy()
    }
  })

  const site = { shots: new Set(['baum.jpg']), stepsOf: () => 2, projectUrl: 'https://github.example/g/p' }

  it('zeigt Bilder, wo vorhanden, sonst die echte Folie, und verlinkt ins Handbuch', () => {
    const html = featurePage(FEATURES[0], site)
    expect(html).toContain('src="../../screenshots/baum.jpg"')
    expect(html).toContain('../../handbuch/?card&amp;step=3#themen/navigation/ausflug') // Ausflug: ohne Bild die Folie (& im Attribut maskiert)
    expect(html).toContain('../../handbuch/?reader#themen/navigation')
    expect(html).toContain('id="stepbtn"')
    expect(html).not.toMatch(/(src|href)="https?:\/\/(?!github.example)/)
  })

  it('die Übersicht verlinkt alle Rubriken', () => {
    const html = featuresIndexPage(site)
    for (const f of FEATURES) expect(html).toContain(`href="../funktionen/${f.id}/"`)
  })
})
