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

  it('zoomstep macht das Bild vergrößerbar und zählt als Schritt, zoomuntil ebenso', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-zoom-'))
    await fs.writeFile(path.join(dir, 'deck.yaml'), '')
    await fs.writeFile(path.join(dir, 'a.md'), '# Z\n\n![a](bild.png){zoomstep=2 zoomuntil=4}')
    await fs.writeFile(path.join(dir, 'bild.png'), 'x')
    const { deck, warnings } = await loadDeck(dir)
    const slide = deck.nodes[0].slides[0]
    expect(slide.html).toContain('data-zoom="true"')
    expect(slide.html).toContain('data-zoomstep="2"')
    expect(slide.html).toContain('data-zoomuntil="4"')
    expect(slide.steps).toBe(4)
    expect(warnings).toEqual([])
  })

  it('meldet ungültige Angaben zu zoomstep und zoomuntil', async () => {
    const { warnings } = await render('# Z\n\n![a](bild.png){zoomstep=x}\n\n![b](bild.png){zoomstep=3 zoomuntil=2}\n\n![c](bild.png){zoomuntil=2}')
    expect(warnings.some((w) => w.includes('zoomstep="x" ist ungültig'))).toBe(true)
    expect(warnings.some((w) => w.includes('zoomuntil=2 muss nach zoomstep=3 liegen'))).toBe(true)
    expect(warnings.some((w) => w.includes('zoomuntil gilt nur zusammen mit zoomstep'))).toBe(true)
  })
})
