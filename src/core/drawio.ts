// draw.io-Diagramme (`.drawio.svg`): Ebenen (Layers) werden zu Schritten.
// Das SVG enthält das Modell im Attribut `content` (mxfile, ggf. deflate + Base64) und je Zelle ein
// `<g data-cell-id="…">`. Ebene 1 ist sofort sichtbar, jede weitere Ebene blendet einen Schritt später ein.

import { inflateRawSync } from 'node:zlib'

export interface DrawioLayer { id: string; name: string }

const unescapeXml = (s: string) =>
  s.replace(/&#xa;|&#10;/gi, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = unescapeXml(m[2])
  return out
}

/** Modell (`<mxGraphModel>`) aus dem `content`-Attribut des SVG; unterstützt komprimierte und unkomprimierte Diagramme. */
export function drawioModel(svg: string): string | null {
  const content = svg.match(/<svg\b[^>]*?\scontent="([^"]*)"/)?.[1]
  if (!content) return null
  const xml = unescapeXml(content)
  const inner = xml.match(/<diagram\b[^>]*>([\s\S]*?)<\/diagram>/)?.[1]?.trim()
  if (!inner) return xml.includes('<mxGraphModel') ? xml : null
  if (inner.startsWith('<')) return inner
  try {
    return decodeURIComponent(inflateRawSync(Buffer.from(inner, 'base64')).toString('utf8'))
  } catch {
    return null
  }
}

/** Ebenen in Zeichenreihenfolge (unten → oben): Zellen direkt unter der Wurzel `0`. */
export function drawioLayers(model: string): DrawioLayer[] {
  const layers: DrawioLayer[] = []
  for (const m of model.matchAll(/<mxCell\b[^>]*>/g)) {
    const a = attrsOf(m[0])
    if (a.parent === '0' && a.id && a.id !== '0') layers.push({ id: a.id, name: a.value ?? '' })
  }
  return layers
}

/**
 * Macht aus den Ebenen Schritte: die erste vorhandene Ebene bleibt immer sichtbar, jede weitere bekommt
 * `data-step="k"` (kumulativ, keine `data-until`). Das `content`-Attribut entfällt (nur für den Editor nötig).
 * Liefert `null`, wenn das SVG kein draw.io-Modell enthält.
 */
export function drawioSteps(svg: string): { svg: string; layers: DrawioLayer[] } | null {
  const model = drawioModel(svg)
  if (!model) return null
  const layers = drawioLayers(model)
  let out = svg.replace(/(<svg\b[^>]*?)\scontent="[^"]*"/, '$1')
  const found: DrawioLayer[] = []
  for (const layer of layers) {
    // ausgeblendete Ebenen fehlen im Export
    const tag = new RegExp(`<g\\b[^>]*\\sdata-cell-id="${escapeRe(layer.id)}"[^>]*>`)
    if (!tag.test(out)) continue
    const step = found.length
    if (step > 0) out = out.replace(tag, (t) => t.replace(/>$/, ` data-step="${step}">`))
    found.push(layer)
  }
  return { svg: out, layers: found }
}
