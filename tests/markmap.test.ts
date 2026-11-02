import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { MAX_DEPTH, MAX_NODES, ignoredLines, inlineHtml, limitTree, markmapTree } from '../src/core/markmap.ts'
import { findCodeBlockPlugin, listPlugins } from '../src/core/plugins.ts'

async function tempDeck(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-markmap-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

const render = async (block: string) => {
  const dir = await tempDeck({ 'deck.yaml': '', 'a.md': `# Titel\n\n\`\`\`${block}\n\`\`\`\n` })
  const { deck, warnings } = await loadDeck(dir)
  return { html: deck.nodes[0].slides[0].html, warnings }
}

describe('Markmap: Baum aus der Gliederung', () => {
  it('baut Überschriften und eingerückte Listen zu einem Baum', () => {
    const tree = markmapTree('# Hashmark\n- Kern\n  - Parser\n  - Plan\n- Runtime\n## Export\n- PDF')
    expect(tree.content).toBe('Hashmark')
    expect(tree.children.map((c) => c.content)).toEqual(['Kern', 'Runtime', 'Export'])
    expect(tree.children[0].children.map((c) => c.content)).toEqual(['Parser', 'Plan'])
    expect(tree.children[2].children.map((c) => c.content)).toEqual(['PDF'])
  })

  it('macht bei mehreren obersten Einträgen eine Wurzel aus dem Titel', () => {
    expect(markmapTree('- a\n- b').content).toBe('Übersicht')
    expect(markmapTree('- a\n- b', 'Thema').content).toBe('Thema')
    expect(markmapTree('- a\n- b\n    - c').children[1].children[0].content).toBe('c')
  })

  it('versteht Tabs und nummerierte Listen', () => {
    const tree = markmapTree('# W\n1. eins\n\t- tief\n2. zwei')
    expect(tree.children.map((c) => c.content)).toEqual(['eins', 'zwei'])
    expect(tree.children[0].children[0].content).toBe('tief')
  })

  it('entschärft HTML und wandelt einfaches Markdown', () => {
    expect(inlineHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;')
    expect(inlineHtml('**fett** *kursiv* `code` [Text](https://x.de)')).toBe('<strong>fett</strong> <em>kursiv</em> <code>code</code> Text')
  })
})

describe('Markmap: Plugin', () => {
  it('ist als mitgeliefertes Plugin angemeldet', () => {
    expect(listPlugins().find((p) => p.name === 'markmap')).toMatchObject({ builtin: true, langs: ['markmap'] })
    expect(findCodeBlockPlugin('markmap')).toBeDefined()
  })

  it('liefert Baum als Daten und eine Liste als Text für Suche und Lesemodus', async () => {
    const { html, warnings } = await render('markmap\n# Mitte\n- Links\n- Rechts')
    expect(warnings).toEqual([])
    expect(html).toContain('class="markmap-block"')
    expect(html).toContain('data-tree="')
    expect(html).toContain('<ul><li>Mitte<ul><li>Links</li><li>Rechts</li></ul></li></ul>')
  })

  it('setzt Höhe und Faltung, meldet ungültige und unbekannte Attribute', async () => {
    const ok = await render('markmap {height=300 fold=2}\n- a')
    expect(ok.html).toContain('--markmap-height:300px')
    expect(ok.html).toContain('data-fold="2"')
    const bad = await render('markmap {height=hoch fold=9 farbe=rot}\n- a')
    expect(bad.warnings.join('\n')).toMatch(/height="hoch" ist ungültig/)
    expect(bad.warnings.join('\n')).toMatch(/fold="9" ist ungültig/)
    expect(bad.warnings.join('\n')).toMatch(/Attribut „farbe“ ist unbekannt/)
  })

  it('schreibt entschärfte Daten in das Attribut (keine Anführungszeichen, die es sprengen)', async () => {
    const { html } = await render('markmap\n- sagt "hallo" <script>')
    expect(html).not.toContain('<script>')
    expect(html).toMatch(/data-tree="[^"]*&quot;/)
  })

  it('meldet einen Block ohne Überschriften und Listenpunkte und ignorierte Zeilen', async () => {
    const empty = await render('markmap\nnur Text\n')
    expect(empty.warnings.join('\n')).toMatch(/keine Überschriften oder Listenpunkte/)
    const some = await render('markmap\nein Satz\n- a\n')
    expect(some.warnings.join('\n')).toMatch(/1 Zeile\(n\) ohne #/)
    expect(ignoredLines('x\n\n- a\n# b')).toBe(1)
  })

  it('kürzt zu große und zu tiefe Bäume und meldet es', async () => {
    const wide = '# R\n' + Array.from({ length: MAX_NODES + 50 }, (_, i) => `- n${i}`).join('\n')
    const tree = markmapTree(wide)
    expect(limitTree(tree)).toBe(51) // 550 Einträge, 499 plus die Wurzel bleiben
    const deep = Array.from({ length: 200 }, (_, i) => `${' '.repeat(i)}- x${i}`).join('\n')
    const t = markmapTree(deep)
    expect(limitTree(t)).toBeGreaterThan(150)
    let depth = 0
    for (let n = t; n.children.length; n = n.children[0]) depth++
    expect(depth).toBeLessThanOrEqual(MAX_DEPTH)
    const { warnings, html } = await render('markmap\n' + wide)
    expect(warnings.join('\n')).toMatch(/zu groß/)
    expect(html).toContain('class="markmap-block"')
  })
})
