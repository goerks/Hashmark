// Statische Prüfung eines geladenen Decks (ohne Browser): Hinweise des Ladens, unbekannte Layouts, Attribute, Übergänge.
// Der Überlauf braucht einen Browser und steht in src/cli/check.ts.

import type { LoadResult } from './deck.ts'
import type { DeckNode } from './types.ts'

export interface Finding {
  level: 'error' | 'warning'
  message: string
  /** Quelle der Überschrift (relativ zum Deck), wenn bekannt */
  file?: string
  line?: number
}

/** Layouts, für die base.css Regeln mitbringt */
export const BUILTIN_LAYOUTS = [
  'title', 'section', 'default', 'two-col', 'three-col', 'statement', 'quote', 'image-left', 'image-right', 'agenda', 'comparison', 'code-focus', 'banner', 'image-full', 'split', 'diagram', 'two-col-wide',
]
/** Attribute einer Überschrift `{…}`, die Hashmark kennt */
export const KNOWN_ATTRS = ['layout', 'id', 'class', 'transition', 'duration', 'bg', 'bgdim', 'steps', 'fit', 'optional', 'appendix', 'plan', 'banner', 'bannerpos', 'bannerh', 'footer', 'speed', 'effect']
export const TRANSITIONS = ['slide', 'zoom', 'fade', 'none']
/** Tempo der Übergänge und Schritt-Einblendungen (`{speed=…}`, deck.yaml `motion: speed:`) */
export const SPEEDS = ['fast', 'normal', 'slow']
/** Auftritt der Schritte (`effect=…` an Folie, Container oder im Deck): fade ist der Standard */
export const EFFECTS = ['fade', 'up', 'left', 'scale', 'highlight', 'dim']

function* walk(nodes: DeckNode[]): Generator<DeckNode> {
  for (const n of nodes) {
    yield n
    yield* walk(n.children)
  }
}

export function staticChecks(result: LoadResult): Finding[] {
  const findings: Finding[] = result.warnings.map((message) => ({ level: 'warning', message }))
  const layoutCss = (name: string) => result.themeCss.includes(`.layout-${name}`)
  for (const node of walk(result.deck.nodes)) {
    const at = { file: node.source.file, line: node.source.line }
    const where = `„${node.title}“`
    const layout = node.layout ?? 'default'
    if (!BUILTIN_LAYOUTS.includes(layout) && !layoutCss(layout)) {
      findings.push({ level: 'error', ...at, message: `${where}: Layout „${layout}“ ist unbekannt (weder eingebaut noch im Theme als .layout-${layout})` })
    }
    for (const key of Object.keys(node.attrs)) {
      if (!KNOWN_ATTRS.includes(key)) findings.push({ level: 'warning', ...at, message: `${where}: Attribut „${key}“ ist unbekannt (bekannt: ${KNOWN_ATTRS.join(', ')})` })
    }
    const sp = node.attrs.speed
    if (sp && !SPEEDS.includes(sp)) findings.push({ level: 'warning', ...at, message: `${where}: speed „${sp}“ ist unbekannt (${SPEEDS.join(' | ')})` })
    const fx = node.attrs.effect
    if (fx && !EFFECTS.includes(fx)) findings.push({ level: 'warning', ...at, message: `${where}: effect „${fx}“ ist unbekannt (${EFFECTS.join(' | ')})` })
    const t = node.attrs.transition
    if (t && !TRANSITIONS.includes(t)) findings.push({ level: 'warning', ...at, message: `${where}: transition „${t}“ ist unbekannt (${TRANSITIONS.join(' | ')})` })
  }
  return findings
}
