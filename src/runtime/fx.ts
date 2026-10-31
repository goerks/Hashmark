// Auftritte der Bausteine (Schritt-Effekte, siehe Slide.svelte `applySteps` und base.css): Standard je Komponente, Zähler.

/** Standard-Auftritt je eingebauter Komponente, wenn weder Container noch Folie noch Deck einen `effect` setzen (`effect=fade` schaltet ihn ab) */
export const COMPONENT_EFFECTS: Record<string, string> = {
  process: 'wipe', pipeline: 'wipe', gantt: 'wipe', roadmap: 'wipe',
  timeline: 'left', kpis: 'scale', checklist: 'up', pyramid: 'rise',
}

/** Komponenten, deren Elemente mit gleicher Schrittnummer standardmäßig leicht versetzt erscheinen */
export const COMPONENT_STAGGER = ['kpis']

/** Name der eingebauten Komponente, in der `el` steht (`d-process` → `process`) */
export function componentOf(el: Element): string | undefined {
  const host = el.closest('[class*="d-"]')
  if (!host) return undefined
  const name = [...host.classList].map((c) => (c.startsWith('d-') ? c.slice(2) : '')).find((n) => n in COMPONENT_EFFECTS)
  return name
}

export interface CountValue {
  prefix: string
  value: number
  suffix: string
  decimals: number
  /** Komma als Dezimalzeichen („3,2“) */
  comma: boolean
  /** Punkt als Tausendertrenner („1.200“) */
  thousands: boolean
}

/** Zahl aus einem Kennzahl-Text lesen („94 %“, „+12 %“, „3,2 s“, „1.200“), null ohne Zahl */
export function parseCount(text: string): CountValue | null {
  const m = /^([^\d]*)(\d+(?:[.,]\d+)*)(.*)$/s.exec(text.trim())
  if (!m) return null
  const [, prefix, num, suffix] = m
  if (/^\d{1,3}(\.\d{3})+$/.test(num)) return { prefix, value: Number(num.replace(/\./g, '')), suffix, decimals: 0, comma: false, thousands: true }
  if (/^\d+,\d+$/.test(num)) return { prefix, value: Number(num.replace(',', '.')), suffix, decimals: num.length - num.indexOf(',') - 1, comma: true, thousands: false }
  if (/^\d+\.\d+$/.test(num)) return { prefix, value: Number(num), suffix, decimals: num.length - num.indexOf('.') - 1, comma: false, thousands: false }
  if (/^\d+$/.test(num)) return { prefix, value: Number(num), suffix, decimals: 0, comma: false, thousands: false }
  return null
}

/** Text bei Fortschritt 0..1 (mit sanftem Auslaufen); bei 1 genau der Zielwert */
export function formatCount(c: CountValue, progress: number): string {
  const p = Math.min(1, Math.max(0, progress))
  const eased = 1 - Math.pow(1 - p, 3)
  const v = c.value * eased
  let num = c.decimals ? v.toFixed(c.decimals) : String(Math.round(v))
  if (c.comma) num = num.replace('.', ',')
  if (c.thousands) num = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${c.prefix}${num}${c.suffix}`
}
