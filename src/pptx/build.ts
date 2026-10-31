// PPTX-Export, Teil 2: aus dem Zwischenmodell (model.ts) eine .pptx-Datei bauen (pptxgenjs).
// Rein in Node, ohne Browser: testbar mit künstlichen Seiten.

import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import { timingXml, type AnimItem } from './animate.ts'
import type { Extracted, Para, PageData, TableCell } from './model.ts'

export interface BuildOptions {
  title?: string
  author?: string
  /** Sprache für die Rechtschreibprüfung in PowerPoint */
  lang?: string
  /** Bild je Seite: Hintergrund mit Dekoration (fehlt bei `solidBg`) */
  backgrounds?: ({ data: Buffer; mime: 'png' | 'jpeg' } | undefined)[]
  /** Folienübergänge (slide → Schieben, zoom, fade) mit exportieren */
  transitions?: boolean
  /** PNG je Raster-Element (`RasterItem.id`) */
  rasters?: Map<number, Buffer>
}

const IN = 1 / 96
const inch = (px: number) => Math.round(px * IN * 10000) / 10000
const png = (b: Buffer) => 'image/png;base64,' + b.toString('base64')

type RunOpts = Record<string, unknown>

/** Absätze → Läufe im Format von pptxgenjs (Absatz-Eigenschaften stehen an jedem Lauf, `breakLine` am letzten) */
function textRuns(paras: Para[], lang: string, linkTarget: (href: string) => RunOpts | undefined, lastBreak = false) {
  const out: { text: string; options: RunOpts }[] = []
  paras.forEach((p, pi) => {
    const runs = p.runs.length ? p.runs : [{ text: ' ', font: 'Segoe UI', size: 12, color: '000000' }]
    const lastPara = pi === paras.length - 1
    runs.forEach((r, ri) => {
      const o: RunOpts = {
        fontFace: r.font, fontSize: Math.round(r.size * 100) / 100, color: r.color, lang,
        align: p.align,
      }
      if (r.bold) o.bold = true
      if (r.italic) o.italic = true
      if (r.underline) o.underline = { style: 'sng' }
      if (r.strike) o.strike = 'sngStrike'
      if (r.spacing) o.charSpacing = Math.round(r.spacing * 100) / 100
      if (r.highlight) o.highlight = r.highlight
      if (r.baseline === 'super') o.superscript = true
      if (r.baseline === 'sub') o.subscript = true
      if (r.href) { const l = linkTarget(r.href); if (l) o.hyperlink = l }
      // Absatz-Eigenschaften nur am ersten Lauf: ein Lauf mit Aufzählungspunkt beginnt in pptxgenjs immer einen neuen Absatz
      if (ri === 0 && p.lineHeight > 0) o.lineSpacing = Math.round(p.lineHeight * 10) / 10
      if (ri === 0 && p.before > 0.1) o.paraSpaceBefore = Math.round(p.before * 10) / 10
      if (ri === 0 && p.after > 0.1) o.paraSpaceAfter = Math.round(p.after * 10) / 10
      if (ri === 0 && p.bullet) {
        const indent = Math.max(6, Math.round(p.bullet.indent * 0.75 * 10) / 10)
        o.bullet = p.bullet.type === 'number'
          ? { type: 'number', indent, numberStartAt: p.bullet.start ?? 1 }
          : { characterCode: p.bullet.code ?? '2022', indent }
        if (p.bullet.level > 0) o.indentLevel = p.bullet.level
      }
      if (ri === runs.length - 1 && (!lastPara || lastBreak)) o.breakLine = true
      out.push({ text: r.text, options: o })
    })
  })
  return out
}

function cellOptions(c: TableCell, lang: string, link: (href: string) => RunOpts | undefined) {
  const side = (b: TableCell['borders'][number]) => (b ? { type: 'solid', pt: Math.max(0.25, Math.round(b.pt * 100) / 100), color: b.color } : { type: 'none' })
  const o: Record<string, unknown> = {
    border: c.borders.map(side),
    margin: c.margin.map((v) => (v >= 1 ? Math.round(v * 10) / 10 : 0)),
    valign: c.valign,
  }
  if (c.fill) o.fill = { color: c.fill }
  if (c.colspan) o.colspan = c.colspan
  if (c.rowspan) o.rowspan = c.rowspan
  return { text: textRuns(c.paras, lang, link), options: o }
}

/** `#knoten-id` oder `#knoten-id:2` → 1-basierte Folie */
function anchorMap(pages: PageData[]): Map<string, number> {
  const m = new Map<string, number>()
  pages.forEach((p, i) => {
    if (!p.id) return
    if (!m.has(p.id)) m.set(p.id, i + 1)
    if (!m.has(`${p.id}:${p.sub + 1}`) && p.step === 0) m.set(`${p.id}:${p.sub + 1}`, i + 1)
  })
  return m
}

export async function buildPptx(data: Extracted, opts: BuildOptions = {}): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'HASHMARK', width: 1280 * IN, height: 720 * IN })
  pptx.layout = 'HASHMARK'
  // Titel-Platzhalter: PowerPoint zeigt die Folientitel in Gliederung, Folienübersicht und für Screenreader
  pptx.defineSlideMaster({
    title: 'HASHMARK',
    objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 40 * IN, y: 30 * IN, w: 1200 * IN, h: 90 * IN }, text: '' } }],
  })
  pptx.title = opts.title ?? 'Präsentation'
  pptx.author = opts.author ?? 'Hashmark'
  pptx.company = 'Hashmark'
  const lang = opts.lang ?? 'de-DE'
  const anchors = anchorMap(data.pages)
  const link = (href: string): RunOpts | undefined => {
    if (href.startsWith('#')) {
      let key = href.slice(1)
      try { key = decodeURI(key) } catch { /* unverändert */ }
      const slide = anchors.get(key) ?? anchors.get(key.replace(/:\d+$/, ''))
      return slide ? { slide } : undefined
    }
    return /^(https?:|mailto:)/i.test(href) ? { url: href } : undefined
  }

  let section = ''
  let sectionTitle: string | undefined
  const anims: AnimItem[][] = []
  data.pages.forEach((page, pi) => {
    const anim: AnimItem[] = []
    anims.push(anim)
    if (page.section && page.section !== section) {
      section = page.section
      pptx.addSection({ title: section })
      sectionTitle = section
    }
    const slide = pptx.addSlide({ masterName: 'HASHMARK', ...(sectionTitle ? { sectionTitle } : {}) })
    let hasTitle = false
    const bg = opts.backgrounds?.[pi]
    if (page.solidBg || !bg) slide.background = { color: page.bgColor }
    else slide.background = { data: `image/${bg.mime};base64,${bg.data.toString('base64')}` }

    let n = 0
    for (const item of page.items) {
      n++
      const box = { x: inch(item.x), y: inch(item.y), w: inch(item.w), h: inch(item.h) }
      if (item.kind === 'text') {
        const slack = item.wrap ? Math.max(2, item.w * 0.006) : 12
        const first = item.paras[0]?.align ?? 'left'
        const dx = first === 'center' ? -slack / 2 : first === 'right' ? -slack : 0
        // PowerPoint setzt die erste Zeile bei fester Zeilenhöhe etwas höher als der Browser
        const dy = ((item.paras[0]?.runs[0]?.size ?? 12) / 0.75) * 0.04
        const objectName = item.title && !hasTitle ? `Titel ${n}` : `${item.name ?? 'Text'} ${n}`
        slide.addText(textRuns(item.paras, lang, link), {
          ...box, x: inch(item.x + dx), y: inch(item.y + dy), w: inch(item.w + slack),
          margin: 0, valign: 'top', wrap: item.wrap, fit: 'none', isTextBox: true,
          objectName,
        } as never)
        if (item.title) hasTitle = true
        if (item.from || item.until || item.paras.some((p) => p.from)) anim.push({ name: objectName, text: true, from: item.from, until: item.until, paras: item.paras.map((p) => p.from) })
      } else if (item.kind === 'picture') {
        const url = data.media[item.media]
        if (!url) continue
        const link0 = item.link ? link(item.link) : undefined
        slide.addImage({ ...box, data: url.replace(/^data:/, ''), altText: item.alt ?? '', objectName: `Bild ${n}`, ...(link0 ? { hyperlink: link0 } : {}) } as never)
        if (item.from || item.until) anim.push({ name: `Bild ${n}`, text: false, from: item.from, until: item.until })
      } else if (item.kind === 'raster') {
        const img = opts.rasters?.get(item.id)
        if (!img) continue
        slide.addImage({ ...box, data: png(img), altText: item.alt ?? '', objectName: `${item.name ?? 'Grafik'} ${n}` } as never)
        if (item.from || item.until) anim.push({ name: `${item.name ?? 'Grafik'} ${n}`, text: false, from: item.from, until: item.until })
      } else if (item.kind === 'table') {
        const rows = item.rows.map((r) => r.cells.map((c) => cellOptions(c, lang, link)))
        slide.addTable(rows as never, {
          ...box, colW: item.cols.map(inch), rowH: item.rows.map((r) => inch(r.h)),
          objectName: `Tabelle ${n}`,
        } as never)
        if (item.from || item.until) anim.push({ name: `Tabelle ${n}`, text: false, from: item.from, until: item.until })
      }
    }
    if (page.notes) slide.addNotes(page.notes)
  })

  const out = Buffer.from((await pptx.write({ outputType: 'nodebuffer' })) as ArrayBuffer)
  return finish(out, data.pages, anims, opts.transitions ?? false)
}

/**
 * Nacharbeit am XML, was pptxgenjs nicht kann:
 * - Farbe der Aufzählungspunkte (sie folgen sonst der Textfarbe). Die Punkte stehen in Reihenfolge im XML; stimmt die
 *   Anzahl nicht, bleibt es bei der Textfarbe.
 * - Der Folientitel („Titel n“) wird zum Titel-Platzhalter, ohne seine Position zu verlieren (Gliederungsansicht,
 *   Folienübersicht, Screenreader).
 */
async function finish(file: Buffer, pages: PageData[], anims: AnimItem[][], transitions: boolean): Promise<Buffer> {
  const zip = await JSZip.loadAsync(file)
  let changed = false
  for (let i = 0; i < pages.length; i++) {
    const colors: (string | undefined)[] = []
    for (const item of pages[i].items) {
      if (item.kind === 'text') for (const p of item.paras) if (p.bullet) colors.push(p.bullet.color)
    }
    const hasTitle = pages[i].items.some((it) => it.kind === 'text' && it.title)
    const name = `ppt/slides/slide${i + 1}.xml`
    let xml = await zip.file(name)?.async('string')
    if (!xml) continue
    const marker = /<a:buSzPct val="100000"\/>/g
    if (colors.some(Boolean) && (xml.match(marker) ?? []).length === colors.length) {
      let n = 0
      xml = xml.replace(marker, (m) => { const c = colors[n++]; return c ? `<a:buClr><a:srgbClr val="${c}"/></a:buClr>${m}` : m })
    }
    // pptxgenjs legt den leeren Platzhalter der Vorlage zusätzlich auf jede Folie: entfernen
    xml = xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?hasCustomPrompt="1"(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g, '')
    if (hasTitle) {
      xml = xml.replace(
        /(<p:cNvPr id="\d+" name="Titel \d+">(?:<a:hlinkClick[^>]*\/>)*<\/p:cNvPr>)<p:cNvSpPr txBox="1"\/><p:nvPr><\/p:nvPr>/,
        '$1<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr>',
      )
    }
    // Übergang zur Folie (vor den Animationen; die Reihenfolge im XML ist festgelegt)
    let extra = ''
    if (transitions) {
      const t = pages[i].transition
      if (t === 'fade') extra = '<p:transition spd="med"><p:fade/></p:transition>'
      else if (t === 'zoom') extra = '<p:transition spd="med"><p:zoom dir="in"/></p:transition>'
      else if (t === 'slide' || t === 'push') extra = '<p:transition spd="med"><p:push dir="l"/></p:transition>'
      else if (t === 'depth') extra = '<p:transition spd="med"><p:push dir="u"/></p:transition>'
      else if (t === 'blur') extra = '<p:transition spd="med"><p:fade/></p:transition>'
      else if (t === 'cover') extra = '<p:transition spd="med"><p:cover dir="l"/></p:transition>'
      else if (t === 'reveal') extra = '<p:transition spd="med"><p:pull dir="l"/></p:transition>'
      else if (t === 'iris') extra = '<p:transition spd="med"><p:circle/></p:transition>'
      else if (t === 'curtain') extra = '<p:transition spd="med"><p:split orient="vert" dir="out"/></p:transition>'
      else if (t === 'diagonal') extra = '<p:transition spd="med"><p:strips dir="rd"/></p:transition>'
      else if (t === 'mosaic') extra = '<p:transition spd="med"><p:randomBar dir="vert"/></p:transition>'
      else if (t === 'blinds') extra = '<p:transition spd="med"><p:blinds dir="vert"/></p:transition>'
    }
    // Animationen: Schritte als „bei Klick“-Effekte (Namen → Form-IDs aus dem XML)
    if (anims[i]?.length) {
      const ids = new Map<string, string>()
      for (const m of xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]*)"/g)) ids.set(m[2], m[1])
      const timing = timingXml(anims[i], (n) => ids.get(n))
      if (timing) extra += timing
    }
    if (extra) xml = xml.replace(/<\/p:sld>\s*$/, extra + '</p:sld>')
    zip.file(name, xml)
    changed = true
  }
  return changed ? zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) : file
}
