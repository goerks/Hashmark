import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { drawioLayers, drawioModel, drawioSteps } from '../src/core/drawio.ts'
import { loadDeck } from '../src/core/deck.ts'

const DEMO = path.resolve(import.meta.dirname, '../examples/strata-demo/bilder/architektur.drawio.svg')

const MODEL = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" value="Basis" parent="0"/>'
  + '<mxCell id="l2" value="Extra &amp; mehr" parent="0"/><mxCell id="x" value="Box" vertex="1" parent="1"/></root></mxGraphModel>'

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const svgWith = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" content="${escapeAttr(content)}"><g><g data-cell-id="0"><g data-cell-id="1"><g data-cell-id="x"/></g><g data-cell-id="l2"><g data-cell-id="y"/></g></g></g></svg>`

describe('draw.io', () => {
  it('liest Ebenen aus unkomprimiertem Modell', () => {
    const svg = svgWith(`<mxfile><diagram id="d">${MODEL}</diagram></mxfile>`)
    expect(drawioLayers(drawioModel(svg)!)).toEqual([{ id: '1', name: 'Basis' }, { id: 'l2', name: 'Extra & mehr' }])
  })

  it('liest komprimierte Diagramme (deflate + Base64)', () => {
    const packed = deflateRawSync(Buffer.from(encodeURIComponent(MODEL))).toString('base64')
    const svg = svgWith(`<mxfile><diagram id="d">${packed}</diagram></mxfile>`)
    expect(drawioLayers(drawioModel(svg)!).map((l) => l.id)).toEqual(['1', 'l2'])
  })

  it('markiert alle Ebenen außer der ersten mit data-step und entfernt content', () => {
    const svg = svgWith(`<mxfile><diagram id="d">${MODEL}</diagram></mxfile>`)
    const out = drawioSteps(svg)!.svg
    expect(out).not.toContain('content=')
    expect(out).toContain('<g data-cell-id="l2" data-step="1">')
    expect(out).toContain('<g data-cell-id="1">')
  })

  it('überspringt Ebenen, die im SVG fehlen (ausgeblendet)', () => {
    const svg = svgWith(`<mxfile><diagram id="d">${MODEL}</diagram></mxfile>`).replace('<g data-cell-id="1"><g data-cell-id="x"/></g>', '')
    const r = drawioSteps(svg)!
    expect(r.layers.map((l) => l.id)).toEqual(['l2'])
    expect(r.svg).not.toContain('data-step')
  })

  it('liefert null ohne draw.io-Modell', () => {
    expect(drawioSteps('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull()
  })

  it('bindet das Demo-Diagramm mit steps=layers als Schritte ein', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'strata-'))
    fs.copyFileSync(DEMO, path.join(dir, 'a.drawio.svg'))
    await fsp.writeFile(path.join(dir, 'a.md'), '# A\n\n![Arch](a.drawio.svg){steps=layers}\n\n![Plain](a.drawio.svg)\n')
    const { deck } = await loadDeck(dir)
    const slide = deck.nodes[0].slides[0]
    expect(slide.html).toContain('<div class="drawio-block"><svg')
    expect(slide.html).toContain('data-step="1"')
    expect(slide.html).toContain('data-step="2"')
    expect(slide.steps).toHaveLength(2)
    // ohne steps=layers bleibt es ein normales Bild
    expect(slide.html).toContain('<img src="deck-assets/a.drawio.svg"')
  })
})
