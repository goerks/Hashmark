// Bild-Zoom: `{zoom}` am Bild, `zoom: true` in der deck.yaml, `{zoom=off}` zum Ausnehmen.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'

async function render(md: string, manifest = '') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-zoom-'))
  await fs.writeFile(path.join(dir, 'deck.yaml'), manifest)
  await fs.writeFile(path.join(dir, 'a.md'), md)
  await fs.writeFile(path.join(dir, 'bild.png'), 'x')
  await fs.writeFile(path.join(dir, 'clip.webm'), 'x')
  const { deck, warnings } = await loadDeck(dir)
  return { html: deck.nodes[0].slides.map((s) => s.html).join('\n'), warnings }
}

const zoomable = (html: string) => (html.match(/data-zoom="true"/g) ?? []).length

describe('Bild-Zoom', () => {
  it('macht ein Bild mit {zoom} vergrößerbar, andere nicht', async () => {
    const { html, warnings } = await render('# Z\n\n![a](bild.png){zoom width=40%}\n\n![b](bild.png){width=40%}\n\n![c](bild.png)')
    expect(zoomable(html)).toBe(1)
    expect(html).toMatch(/<img[^>]*data-zoom="true"[^>]*style="width:40%"|<img[^>]*style="width:40%"[^>]*data-zoom="true"/)
    expect(warnings).toEqual([])
  })

  it('macht mit zoom: true in der deck.yaml alle Bilder vergrößerbar und nimmt {zoom=off} aus', async () => {
    const { html, warnings } = await render('# Z\n\n![a](bild.png)\n\n![b](bild.png){width=40%}\n\n![c](bild.png){zoom=off}\n\n![d](bild.png){zoom=false}', 'zoom: true\n')
    expect(zoomable(html)).toBe(2)
    expect(warnings).toEqual([])
  })

  it('betrifft keine Videos und meldet zoom an einem Video als unbekannt', async () => {
    const { html, warnings } = await render('# Z\n\n![v](clip.webm)\n\n![w](clip.webm){zoom}', 'zoom: true\n')
    expect(zoomable(html)).toBe(0)
    expect(warnings.some((w) => w.includes('Video-Attribut „zoom“ ist unbekannt'))).toBe(true)
  })

  it('meldet einen ungültigen Wert, ohne das Bild zu verlieren', async () => {
    const { html, warnings } = await render('# Z\n\n![a](bild.png){zoom=banane}')
    expect(warnings.some((w) => w.includes('zoom="banane" ist ungültig'))).toBe(true)
    expect(html).toContain('<img')
  })

  it('lässt ein Bild ohne Zoom unverändert', async () => {
    const { html } = await render('# Z\n\n![a](bild.png)')
    expect(html).not.toContain('data-zoom')
    expect(html).toContain('src="deck-assets/bild.png"')
  })
})
