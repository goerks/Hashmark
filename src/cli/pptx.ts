// PPTX-Export: die Druckansicht in Edge/Chrome headless öffnen, Seiten auslesen (src/pptx/extract.ts), Hintergründe
// und Diagramme als Bilder aufnehmen und daraus mit pptxgenjs (src/pptx/build.ts) eine bearbeitbare Präsentation bauen.

import fsp from 'node:fs/promises'
import path from 'node:path'
import type { InlineConfig } from 'vite'
import { buildPptx } from '../pptx/build.ts'
import { extractPages } from '../pptx/extract.ts'
import type { Extracted } from '../pptx/model.ts'
import { findBrowser, serveBuild, withPrintView, type Cdp } from './pdf.ts'

export interface PptxResult { slides: number; bytes: number; rasters: number; warnings: string[] }

/** Stile für die Aufnahmen: Leiste weg, Seiten ohne Rand; `hm-bg` = Hintergrund ohne Text, `hm-r` = ein Element allein */
const CAPTURE_CSS = `
.print-bar { display: none !important; }
.print-view { padding: 0 !important; background: none !important; }
.print-page { margin: 0 !important; box-shadow: none !important; zoom: 1 !important; }
html.hm-bg .print-stage * {
  color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important;
  text-decoration-color: transparent !important; -webkit-text-stroke-color: transparent !important; caret-color: transparent !important;
}
html.hm-bg .print-stage *::before { color: var(--hm-pb, transparent) !important; -webkit-text-fill-color: var(--hm-pb, transparent) !important; }
html.hm-bg .print-stage *::after { color: var(--hm-pa, transparent) !important; -webkit-text-fill-color: var(--hm-pa, transparent) !important; }
html.hm-bg [data-pr], html.hm-bg [data-pn], html.hm-bg [data-pt] { visibility: hidden !important; }
html.hm-bg [data-ph] { background: transparent !important; }
html.hm-r .print-stage * { visibility: hidden !important; }
html.hm-r [data-pr-active], html.hm-r [data-pr-active] * { visibility: visible !important; }
html.hm-r [data-pr-active] [data-pr-off], html.hm-r [data-pr-active] [data-pn], html.hm-r [data-pr-active] [data-pt], html.hm-r [data-pr-active] [data-pr] { visibility: hidden !important; }
html.hm-r [data-pr-active="overlay"], html.hm-r [data-pr-active="overlay"] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }
html.hm-r [data-pr-active="overlay"] *::before, html.hm-r [data-pr-active="overlay"]::before { color: var(--hm-pb, transparent) !important; -webkit-text-fill-color: var(--hm-pb, transparent) !important; }
html.hm-r [data-pr-active="overlay"] *::after, html.hm-r [data-pr-active="overlay"]::after { color: var(--hm-pa, transparent) !important; -webkit-text-fill-color: var(--hm-pa, transparent) !important; }
html.hm-r, html.hm-r body, html.hm-r .print-view, html.hm-r .print-page, html.hm-r .print-slide, html.hm-r .print-stage { background: transparent !important; box-shadow: none !important; }
`

/** doppelte Auflösung: Bilder bleiben auf großen Bildschirmen scharf */
const SCALE = 2

const evaluate = (cdp: Cdp, expression: string) => cdp.send('Runtime.evaluate', { expression, returnByValue: true })

type Rect = { x: number; y: number; width: number; height: number }

async function shot(cdp: Cdp, rect: Rect, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format, ...(format === 'jpeg' ? { quality: 88 } : {}),
    clip: { ...rect, scale: 1 }, captureBeyondViewport: false, fromSurface: true,
  })
  return Buffer.from(data, 'base64')
}

/** Element samt seiner Druckseite in den Sichtbereich holen; liefert sein Rechteck in Seitenkoordinaten */
async function reveal(cdp: Cdp, selector: string, area?: { x: number; y: number; w: number; h: number }): Promise<Rect | null> {
  const r = await evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const page = el.closest('.print-page') ?? el;
    window.scrollTo(0, page.getBoundingClientRect().top + scrollY);
    const b = el.getBoundingClientRect();
    const stage = el.closest('.print-stage')?.getBoundingClientRect();
    const a = ${JSON.stringify(area ? [area.x, area.y, area.w, area.h] : null)};
    if (a && stage) return { x: stage.left + scrollX + a[0], y: stage.top + scrollY + a[1], width: a[2], height: a[3] };
    return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height };
  })()`)
  return (r.result?.value as Rect | null) ?? null
}

export async function printUrlToPptx(url: string, out: string, browserPath?: string, onProgress?: (msg: string) => void): Promise<PptxResult> {
  return withPrintView(url, browserPath, async (cdp) => {
    await evaluate(cdp, `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CAPTURE_CSS)}; document.head.append(s); })()`)
    // eine Atempause für das neue Layout ohne Leiste
    await new Promise((r) => setTimeout(r, 300))

    onProgress?.('Folien auslesen …')
    const res = await cdp.send('Runtime.evaluate', { expression: `(${extractPages.toString()})()`, awaitPromise: true, returnByValue: true })
    if (res.exceptionDetails) throw new Error('Auslesen der Folien fehlgeschlagen: ' + (res.exceptionDetails.exception?.description ?? res.exceptionDetails.text))
    const data = res.result.value as Extracted
    if (!data.pages.length) throw new Error('Keine Folien gefunden')

    // Hintergründe: Text unsichtbar, Bilder/Tabellen/Diagramme ausgeblendet → Dekoration bleibt
    onProgress?.('Hintergründe aufnehmen …')
    const backgrounds: ({ data: Buffer; mime: 'png' | 'jpeg' } | undefined)[] = []
    await evaluate(cdp, `document.documentElement.classList.add('hm-bg')`)
    for (let i = 0; i < data.pages.length; i++) {
      if (data.pages[i].solidBg) { backgrounds.push(undefined); continue }
      const rect = await reveal(cdp, `.print-page:nth-of-type(${i + 1}) .print-stage`)
      if (!rect) { backgrounds.push(undefined); continue }
      let buf = await shot(cdp, rect)
      let mime: 'png' | 'jpeg' = 'png'
      if (buf.length > 1_500_000) { buf = await shot(cdp, rect, 'jpeg'); mime = 'jpeg' } // Fotos als JPEG
      backgrounds.push({ data: buf, mime })
    }
    await evaluate(cdp, `document.documentElement.classList.remove('hm-bg')`)

    // Diagramme, SVG, runde Bilder …: einzeln, mit durchsichtigem Hintergrund
    onProgress?.('Diagramme und Bilder aufnehmen …')
    const rasters = new Map<number, Buffer>()
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
    await evaluate(cdp, `document.documentElement.classList.add('hm-r')`)
    for (const page of data.pages) {
      for (const item of page.items) {
        if (item.kind !== 'raster') continue
        await evaluate(cdp, `document.querySelector('[data-pr-active]')?.removeAttribute('data-pr-active'); document.querySelector('[data-pr="${item.id}"]')?.setAttribute('data-pr-active', '${item.overlay ? 'overlay' : '1'}')`)
        const rect = await reveal(cdp, `[data-pr="${item.id}"]`, item)
        if (rect && rect.width >= 1 && rect.height >= 1) rasters.set(item.id, await shot(cdp, rect))
      }
    }
    await evaluate(cdp, `document.documentElement.classList.remove('hm-r')`)
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', {})

    onProgress?.('PPTX schreiben …')
    const title = await evaluate(cdp, `document.title.replace(/ – Druckansicht$/, '')`)
    const buf = await buildPptx(data, { title: String(title.result?.value || 'Präsentation'), backgrounds, rasters })
    await fsp.mkdir(path.dirname(out), { recursive: true })
    await fsp.writeFile(out, buf)
    return { slides: data.pages.length, bytes: buf.length, rasters: rasters.size, warnings: cdp.errors }
  }, async (cdp) => {
    // Bühne in voller Größe (die Druckansicht skaliert sonst auf die Fensterbreite)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: SCALE, mobile: false })
  })
}

export async function exportPptx(config: InlineConfig, opts: { out: string; query: string; browser?: string }) {
  const browser = findBrowser(opts.browser)
  console.log('[hashmark] baue Deck …')
  const site = await serveBuild(config)
  try {
    console.log(`[hashmark] rendere mit ${path.basename(browser)} …`)
    const r = await printUrlToPptx(site.url + opts.query, opts.out, browser, (m) => console.log(`[hashmark] ${m}`))
    console.log(`[hashmark] PPTX: ${opts.out} (${r.slides} Folien, ${r.rasters} Bilder, ${(r.bytes / 1024 / 1024).toFixed(1)} MB)`)
    if (r.warnings.length) console.warn(`[hashmark] Hinweise aus dem Browser:\n${r.warnings.join('\n')}`)
  } finally {
    await site.close()
  }
}
