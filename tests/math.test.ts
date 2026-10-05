// Formeln (KaTeX): Schutz vor dem Markdown-Parser, Setzen, Regeln für `$`, Fehlermeldungen, Schritte.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { protectMath, renderMath, renderTex } from '../src/core/math.ts'
import { loadDeck } from '../src/core/deck.ts'

const tex = (s: string) => decodeURIComponent(s.match(/data-tex="([^"]*)"/)![1])

describe('protectMath', () => {
  it('ersetzt $…$ und $$…$$ durch Platzhalter und bewahrt LaTeX unverändert', () => {
    const out = protectMath('Satz $a \\{ b \\, c\\}$ und\n\n$$\\int_0^1 x\\,dx$$\n')
    expect(out.match(/hm-math/g)).toHaveLength(2)
    expect(tex(out.split('\n')[0])).toBe('a \\{ b \\, c\\}')
    expect(out).toContain('data-display')
  })

  it('lässt Preise, Escapes, Inline-Code, Codeblöcke und Überschriften unberührt', () => {
    const src = ['Das kostet $5 und $6 insgesamt', 'Zeichen \\$ bleibt', 'Code `$x$` bleibt', '```js', 'const a = `$y$`; // $z$', '```', '# Titel $t$'].join('\n')
    expect(protectMath(src)).toBe(src)
  })

  it('hält die Zeilenzahl bei mehrzeiligen Blöcken stabil (Editor-Sync)', () => {
    const src = 'vorher\n$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$\nnachher'
    const out = protectMath(src)
    // Platzhalter + Füllzeilen belegen genauso viele Zeilen wie die Formel; "nachher" bleibt in derselben Zeile
    expect(out.split('\n')).toHaveLength(src.split('\n').length)
    expect(out.split('\n').indexOf('nachher')).toBe(src.split('\n').indexOf('nachher'))
  })

  it('verlangt ein schließendes $$ vor dem nächsten Codeblock', () => {
    const src = '$$ offen\n```\ncode\n```'
    expect(protectMath(src)).toBe(src)
  })
})

describe('Formeln setzen', () => {
  it('setzt HTML und MathML', () => {
    const html = renderTex('E = mc^2', false)
    expect(html).toContain('class="katex"')
    expect(html).toContain('katex-mathml')
  })

  it('meldet Fehler und zeigt den Quelltext', () => {
    const warnings: string[] = []
    const html = renderTex('\\frac{1}{', true, { warn: (m) => warnings.push(m) })
    expect(html).toContain('math-error')
    expect(warnings[0]).toMatch(/Formel/)
  })

  it('blendet Teilformeln schrittweise ein (\\htmlData)', () => {
    const html = renderTex('a \\htmlData{step=2}{= b}', false)
    expect(html).toContain('data-step="2"')
  })

  it('erlaubt keine Links oder Bilder in Formeln', () => {
    // nicht vertraute Befehle setzt KaTeX als roten Text, ohne Link und ohne Bild
    const link = renderTex('\\href{https://example.com}{x}', false)
    const image = renderTex('\\includegraphics{x.png}', false)
    expect(link).not.toContain('<a ')
    expect(link).not.toContain('example.com"')
    expect(image).not.toContain('<img')
  })

  it('renderMath ersetzt nur Platzhalter', () => {
    const html = renderMath(`<p>Wert ${protectMath('$x^2$')} ok</p>`)
    expect(html).toContain('class="katex"')
    expect(html).not.toContain('hm-math')
  })
})

describe('Formeln im Deck', () => {
  async function deck(md: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashmark-math-'))
    fs.writeFileSync(path.join(dir, '01.md'), md)
    return loadDeck(dir)
  }

  it('rendert Formeln im Satz, als Block und als ```math; Schritte zählen mit', async () => {
    const { deck: d, warnings } = await deck('# Formeln\n\nIm Satz $a^2 + b^2 = c^2$ und\n\n$$\\htmlData{step=1}{x} + \\htmlData{step=2}{y}$$\n\n```math\n\\sum_{i=1}^n i\n```\n')
    const slide = d.nodes[0].slides[0]
    expect(slide.html.match(/class="katex"/g)?.length).toBe(3)
    expect(slide.html).toContain('math-block')
    expect(slide.steps).toHaveLength(2)
    expect(warnings).toEqual([])
  })

  it('meldet kaputte Formeln als Ladehinweis mit Dateiname', async () => {
    const { warnings } = await deck('# Fehler\n\n$$\\frac{1}{$$\n')
    expect(warnings.some((w) => w.includes('Formel') && w.includes('01.md'))).toBe(true)
  })
})
