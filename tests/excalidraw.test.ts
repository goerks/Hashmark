import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { excalidrawElements, excalidrawSteps } from '../src/core/excalidraw.ts'
import { loadDeck } from '../src/core/deck.ts'

const DEMO = path.resolve(import.meta.dirname, '../examples/hashmark-demo/bilder/user-story-map.excalidraw.svg')

/** Minimaler Export: Szene wie Excalidraw (bstring + zlib, Base64 über latin1) und je Element ein `<g>`. */
function svgOf(elements: { groupIds?: string[]; isDeleted?: boolean }[], body: string[]) {
  const encoded = deflateSync(Buffer.from(JSON.stringify({ elements }), 'utf8')).toString('latin1')
  const wrapper = JSON.stringify({ version: '1', encoding: 'bstring', compressed: true, encoded })
  const payload = Buffer.from(wrapper, 'latin1').toString('base64')
  return `<svg xmlns="http://www.w3.org/2000/svg"><!-- svg-source:excalidraw --><metadata><!-- payload-start -->${payload}<!-- payload-end --></metadata>`
    + `<defs><style>a{}</style></defs>${body.join('<mask></mask>')}</svg>`
}

const G = (n: number) => `<g id="e${n}" transform="translate(${n} 0)"><path d="M0 0"/></g>`
const stepsOf = (svg: string) => [...svg.matchAll(/<g id="e(\d+)"([^>]*)>/g)].map((m) => /data-step="(\d+)"/.exec(m[2])?.[1] ?? '-')

describe('Excalidraw', () => {
  const elements = [{ groupIds: ['a'] }, { groupIds: [] }, { groupIds: ['b'] }, { groupIds: ['b', 'outer'] }, { isDeleted: true }, { groupIds: ['a'] }]
  const svg = svgOf(elements, [G(0), G(1), G(2), G(3), G(5)])

  it('liest die eingebettete Szene', () => {
    expect(excalidrawElements(svg)).toHaveLength(6)
    expect(excalidrawElements('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull()
  })

  it('macht Gruppen zu Schritten, Ungruppiertes bleibt Gerüst, äußerste Gruppe zählt', () => {
    const r = excalidrawSteps(svg)!
    expect(stepsOf(r.svg)).toEqual(['1', '-', '2', '3', '1'])
    expect([r.groups, r.steps]).toEqual([3, 3])
    expect(r.svg).not.toContain('<metadata>')
  })

  it('order ändert Reihenfolge und erlaubt gleichzeitige Gruppen', () => {
    const r = excalidrawSteps(svg, '3,1+2')!
    expect(stepsOf(r.svg)).toEqual(['2', '-', '2', '1', '2'])
    expect(r.steps).toBe(2)
  })

  it('warnt bei ungültiger Nummer und bei abweichender Elementzahl', () => {
    expect(excalidrawSteps(svg, '1,9')!.warnings[0]).toContain('9')
    const r = excalidrawSteps(svgOf(elements, [G(0)]))!
    expect(r.steps).toBe(0)
    expect(r.warnings[0]).toContain('Zuordnung unsicher')
    expect(r.svg).not.toContain('data-step')
  })

  it('ordnet im echten Export alle 61 Elemente zu', () => {
    const r = excalidrawSteps(fs.readFileSync(DEMO, 'utf8'), '3,1,2,4+5,6')!
    expect(r.warnings).toEqual([])
    expect([r.groups, r.steps]).toEqual([6, 5])
    expect([...r.svg.matchAll(/data-step="4"/g)]).toHaveLength(13)
  })

  it('bindet steps=groups als Schritte ein, ohne bleibt es ein Bild', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'hashmark-'))
    fs.copyFileSync(DEMO, path.join(dir, 'm.excalidraw.svg'))
    await fsp.writeFile(path.join(dir, 'a.md'), '# A\n\n![Map](m.excalidraw.svg){steps=groups order="3,1,2,4+5,6"}\n\n![Plain](m.excalidraw.svg)\n')
    const { deck, warnings } = await loadDeck(dir)
    const slide = deck.nodes[0].slides[0]
    expect(slide.html).toContain('<div class="excalidraw-block"><svg')
    expect(slide.steps).toHaveLength(5)
    expect(slide.html).toContain('<img src="deck-assets/m.excalidraw.svg"')
    expect(warnings).toEqual([])
  })
})
