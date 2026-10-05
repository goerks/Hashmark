// PPTX-Export: Zwischenmodell → Datei (ohne Browser). Das Auslesen im Browser prüft `make sidecar-smoke`/`make pptx`.

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildPptx } from '../src/pptx/build.ts'
import type { Extracted, PageData, Para, Run } from '../src/pptx/model.ts'

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const run = (text: string, extra: Partial<Run> = {}): Run => ({ text, font: 'Segoe UI', size: 24, color: '1F2328', ...extra })
const para = (runs: Run[], extra: Partial<Para> = {}): Para => ({ runs, align: 'left', lineHeight: 30, before: 0, after: 0, ...extra })

function page(over: Partial<PageData> = {}): PageData {
  return { id: 'a', sub: 0, step: 0, title: 'A', section: 'A', depth: 1, items: [], notes: '', solidBg: true, bgColor: 'FFFFFF', ...over }
}

async function files(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf)
  const read = async (name: string) => (await zip.file(name)!.async('string'))
  return { zip, read, names: Object.keys(zip.files) }
}

const data = (pages: PageData[]): Extracted => ({ pages, media: { 'x.png': 'data:image/png;base64,' + PNG.toString('base64') } })

describe('PPTX-Export', () => {
  it('baut je Seite eine Folie im Format 16:9 mit Notizen und Abschnitten', async () => {
    const buf = await buildPptx(data([
      page({ id: 'a', notes: 'Erst das Problem nennen', items: [{ kind: 'text', x: 40, y: 40, w: 600, h: 50, wrap: false, paras: [para([run('Titel', { bold: true, size: 39 })])] }] }),
      page({ id: 'b', section: 'B', bgColor: '0D1117' }),
    ]))
    const { read, names } = await files(buf)
    expect(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(2)
    expect(names.some((n) => n.startsWith('ppt/notesSlides/'))).toBe(true)
    const pres = await read('ppt/presentation.xml')
    expect(pres).toContain('cx="12192000"') // 13,333 Zoll
    expect(pres).toContain('cy="6858000"') // 7,5 Zoll
    expect(pres).toMatch(/<p14:section[^>]*name="A"/)
    const s1 = await read('ppt/slides/slide1.xml')
    expect(s1).toContain('<a:t>Titel</a:t>')
    expect(s1).toContain('lang="de-DE"')
    expect(await read('ppt/slides/slide2.xml')).toContain('0D1117')
  })

  it('setzt die Farbe der Aufzählungspunkte und behält mehrere Läufe in einem Absatz', async () => {
    const buf = await buildPptx(data([page({
      items: [{
        kind: 'text', x: 40, y: 100, w: 500, h: 100, wrap: true, name: 'Liste',
        paras: [
          para([run('Idee: ', { bold: true }), run('der Baum')], { bullet: { type: 'bullet', code: '2022', level: 0, indent: 24, color: '22D3EE' }, after: 8 }),
          para([run('zweiter Punkt')], { bullet: { type: 'bullet', code: '2022', level: 1, indent: 24, color: 'FF0000' } }),
        ],
      }],
    })]))
    const xml = await (await files(buf)).read('ppt/slides/slide1.xml')
    expect(xml).toContain('<a:buClr><a:srgbClr val="22D3EE"/></a:buClr>')
    expect(xml).toContain('<a:buClr><a:srgbClr val="FF0000"/></a:buClr>')
    // zwei Absätze, nicht drei: der zweite Lauf bleibt im ersten Absatz
    expect((xml.match(/<a:p>/g) ?? []).length).toBe(2)
    expect(xml).toContain('lvl="1"')
  })

  it('übersetzt Links: Web-Adressen und Querverweise auf Folien', async () => {
    const buf = await buildPptx(data([
      page({ id: 'start', items: [{ kind: 'text', x: 0, y: 0, w: 400, h: 40, wrap: false, paras: [para([run('Zur Doku', { href: 'https://example.com/x' }), run(' und weiter', { href: '#ziel' })])] }] }),
      page({ id: 'ziel' }),
    ]))
    const { read } = await files(buf)
    const xml = await read('ppt/slides/slide1.xml')
    const rels = await read('ppt/slides/_rels/slide1.xml.rels')
    expect(rels).toContain('https://example.com/x')
    expect(rels).toContain('slide2.xml') // Querverweis → Folie 2
    expect(xml).toContain('hlinkClick')
  })

  it('fügt Bilder, Aufnahmen und Tabellen ein; Hintergrundbild nur bei Dekoration', async () => {
    const buf = await buildPptx(data([
      page({
        solidBg: false,
        items: [
          { kind: 'picture', x: 700, y: 100, w: 400, h: 300, media: 'x.png', alt: 'Ein Bild' },
          { kind: 'raster', id: 7, x: 40, y: 400, w: 300, h: 200, name: 'Diagramm' },
          { kind: 'table', x: 40, y: 100, w: 400, h: 80, cols: [200, 200], rows: [{ h: 40, cells: [
            { paras: [para([run('Taste', { bold: true })])], borders: [null, null, { pt: 1, color: 'CCCCCC' }, null], margin: [4, 8, 4, 8], valign: 'middle', fill: 'F3F5F8' },
            { paras: [para([run('Wirkung')])], borders: [null, null, { pt: 1, color: 'CCCCCC' }, null], margin: [4, 8, 4, 8], valign: 'middle' },
          ] }] },
        ],
      }),
    ]), { backgrounds: [{ data: PNG, mime: 'png' }], rasters: new Map([[7, PNG]]) })
    const { read, names } = await files(buf)
    const xml = await read('ppt/slides/slide1.xml')
    expect(xml).toContain('descr="Ein Bild"')
    expect(xml).toContain('<a:tbl>')
    expect(xml).toContain('<a:t>Taste</a:t>')
    expect(xml).toContain('F3F5F8')
    // Hintergrundbild + Bild + Diagramm
    expect(names.filter((n) => /^ppt\/media\/.+/.test(n)).length).toBeGreaterThanOrEqual(2)
    expect(await read('ppt/slides/_rels/slide1.xml.rels')).toMatch(/image/)
  })

  it('lässt bei einfarbigem Hintergrund das Bild weg', async () => {
    const buf = await buildPptx(data([page({ solidBg: true, bgColor: 'ABCDEF' })]), { backgrounds: [{ data: PNG, mime: 'png' }] })
    const { read, names } = await files(buf)
    expect(await read('ppt/slides/slide1.xml')).toContain('ABCDEF')
    expect(names.some((n) => /^ppt\/media\/.+/.test(n))).toBe(false)
  })
})

describe('PPTX-Animationen', () => {
  const list = (from?: number): Para[] => [
    para([run('immer da')], { bullet: { type: 'bullet', code: '2022', level: 0, indent: 24 } }),
    para([run('Schritt 1')], { bullet: { type: 'bullet', code: '2022', level: 0, indent: 24 }, from: 1 }),
    para([run('Schritt 2a')], { bullet: { type: 'bullet', code: '2022', level: 0, indent: 24 }, from: 2 }),
    para([run('Schritt 2b')], { bullet: { type: 'bullet', code: '2022', level: 0, indent: 24 }, from: 2 }),
  ]

  it('baut Listen absatzweise auf: ein Klick je Schritt, gleiche Schritte zusammen', async () => {
    const buf = await buildPptx(data([page({ items: [{ kind: 'text', x: 40, y: 100, w: 500, h: 200, wrap: false, name: 'Liste', paras: list() }] })]))
    const xml = await (await files(buf)).read('ppt/slides/slide1.xml')
    expect(xml).toContain('<p:timing>')
    // zwei Klicks (Schritt 1 und 2), Absatz 0 bleibt ohne Effekt
    expect((xml.match(/delay="indefinite"/g) ?? []).length).toBe(2)
    expect(xml).toContain('<p:pRg st="1" end="1"/>')
    expect(xml).toContain('<p:pRg st="2" end="3"/>')
    expect(xml).not.toContain('<p:pRg st="0"')
    expect(xml).toMatch(/<p:bldP spid="\d+" grpId="0" build="p"\/>/)
    expect((xml.match(/nodeType="clickEffect"/g) ?? []).length).toBe(2)
  })

  it('blendet Bilder und Dekoration ein und aus (until), Nachfolger laufen mit dem Klick', async () => {
    const buf = await buildPptx(data([page({
      items: [
        { kind: 'raster', id: 1, x: 0, y: 0, w: 100, h: 100, name: 'Diagramm', until: 1 },
        { kind: 'raster', id: 2, x: 0, y: 0, w: 100, h: 100, name: 'Diagramm', from: 1 },
        { kind: 'picture', x: 200, y: 0, w: 100, h: 100, media: 'x.png', from: 1 },
      ],
    })]), { rasters: new Map([[1, PNG], [2, PNG]]) })
    const xml = await (await files(buf)).read('ppt/slides/slide1.xml')
    expect((xml.match(/delay="indefinite"/g) ?? []).length).toBe(1)
    expect(xml).toContain('presetClass="exit"')
    expect(xml).toContain('presetClass="entr"')
    expect((xml.match(/nodeType="withEffect"/g) ?? []).length).toBe(2)
    expect(xml).not.toContain('<p:bldLst>') // Bilder brauchen keinen Aufbau-Eintrag
  })

  it('schreibt nichts, wenn nichts animiert wird', async () => {
    const buf = await buildPptx(data([page({ items: [{ kind: 'text', x: 0, y: 0, w: 100, h: 20, wrap: false, paras: [para([run('x')])] }] })]))
    expect(await (await files(buf)).read('ppt/slides/slide1.xml')).not.toContain('<p:timing>')
  })
})
