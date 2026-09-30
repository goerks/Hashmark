// Excalidraw-Zeichnungen (`.excalidraw.svg`): Gruppen werden zu Schritten.
// Der Export enthält je Element ein Top-Level-`<g>` (Pfeile/Linien mit Unter-`<g>`), aber keine Gruppen.
// Nur mit „Szene einbetten“ steckt die Szene komprimiert in `<metadata>`; daraus kommen die `groupIds`,
// die Zuordnung zu den `<g>` läuft über die Reihenfolge. Ungruppierte Elemente bilden das Gerüst (immer sichtbar).

import { inflateSync } from 'node:zlib'

interface SceneElement { isDeleted?: boolean; groupIds?: string[] }

export interface ExcalidrawResult {
  svg: string
  /** Anzahl Gruppen in Z-Reihenfolge (Nummer 1…n im Attribut `order`) */
  groups: number
  /** Schritte nach Anwendung von `order` */
  steps: number
  warnings: string[]
}

/** Szenen-Elemente aus `<metadata>`; `null`, wenn die Szene nicht eingebettet ist. */
export function excalidrawElements(svg: string): SceneElement[] | null {
  const payload = svg.match(/<!--\s*payload-start\s*-->([\s\S]*?)<!--\s*payload-end\s*-->/)?.[1]?.trim()
  if (!payload) return null
  try {
    const wrapper = JSON.parse(Buffer.from(payload, 'base64').toString('latin1'))
    let json: string
    if (wrapper.compressed) {
      // „bstring“: jedes Zeichen ist ein Byte; pako hat es mit zlib gepackt
      json = inflateSync(Buffer.from(wrapper.encoded, 'latin1')).toString('utf8')
    } else {
      json = wrapper.encoded
    }
    const scene = JSON.parse(json)
    return Array.isArray(scene.elements) ? scene.elements : null
  } catch {
    return null
  }
}

/** Anfang (nach `>`) jedes Top-Level-`<g>` hinter `</defs>`; `<mask>` und Leerraum sind keine Elemente. */
function topLevelGroups(svg: string): number[] {
  const from = svg.indexOf('</defs>')
  const to = svg.lastIndexOf('</svg>')
  if (from < 0 || to < 0) return []
  const starts: number[] = []
  let depth = 0
  for (const m of svg.slice(from, to).matchAll(/<g\b[^>]*?(\/?)>|<\/g>/g)) {
    if (m[0] === '</g>') { depth--; continue }
    if (depth === 0) starts.push(from + m.index! + m[0].length - 1) // Index des schließenden `>`
    if (!m[1]) depth++
  }
  return starts
}

/** `order="3,1,2,4+5"` → Schritt k = Gruppen dieses Eintrags (1-basiert, `+` = gleichzeitig). */
function parseOrder(order: string, groups: number, warnings: string[]): number[][] {
  const out: number[][] = []
  for (const part of order.split(',')) {
    const nums = part.split('+').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= groups)
    if (nums.length !== part.split('+').length) warnings.push(`order="${order}": „${part.trim()}“ ist keine gültige Gruppennummer (1–${groups})`)
    if (nums.length) out.push(nums)
  }
  return out
}

/**
 * Macht aus den Gruppen Schritte: Gruppe k (in Z-Reihenfolge, äußerste Gruppe) wird Schritt k, ungruppierte
 * Elemente bleiben sichtbar. `order` legt eine andere Reihenfolge fest; nicht genannte Gruppen bleiben sichtbar.
 * Die Szene (`<metadata>`) entfällt im Ergebnis. Liefert `null`, wenn keine Szene eingebettet ist.
 */
export function excalidrawSteps(svg: string, order?: string): ExcalidrawResult | null {
  const all = excalidrawElements(svg)
  if (!all) return null
  const warnings: string[] = []
  const elements = all.filter((e) => !e.isDeleted)
  const starts = topLevelGroups(svg)
  if (starts.length !== elements.length) {
    warnings.push(`Excalidraw: ${starts.length} SVG-Elemente, aber ${elements.length} in der Szene – Zuordnung unsicher, Zeichnung bleibt statisch`)
    return { svg: stripScene(svg), groups: 0, steps: 0, warnings }
  }

  // Gruppen in Reihenfolge des ersten Auftretens; die äußerste Gruppe steht zuletzt in groupIds
  const groupIndex = new Map<string, number>()
  const elementGroup = elements.map((e) => {
    const id = e.groupIds?.at(-1)
    if (!id) return -1
    if (!groupIndex.has(id)) groupIndex.set(id, groupIndex.size)
    return groupIndex.get(id)!
  })

  const groups = groupIndex.size
  const stepOfGroup = new Map<number, number>()
  if (order) {
    parseOrder(order, groups, warnings).forEach((nums, k) => nums.forEach((n) => stepOfGroup.set(n - 1, k + 1)))
  } else {
    for (let g = 0; g < groups; g++) stepOfGroup.set(g, g + 1)
  }

  let out = svg
  // von hinten einfügen, damit die Indizes stabil bleiben
  for (let i = starts.length - 1; i >= 0; i--) {
    const step = elementGroup[i] >= 0 ? stepOfGroup.get(elementGroup[i]) : undefined
    if (!step) continue
    out = out.slice(0, starts[i]) + ` data-step="${step}"` + out.slice(starts[i])
  }
  return { svg: stripScene(out), groups, steps: Math.max(0, ...stepOfGroup.values()), warnings }
}

const stripScene = (svg: string) => svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')
