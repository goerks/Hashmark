// Zeitplanung für die Presenter-View: Dauer parsen, Uhrzeit formatieren, Tempo bewerten. Ohne DOM.

/**
 * `"5m"`, `"90s"`, `"1h30m"`, `"1:30"` (mm:ss), `"2.5m"` oder eine Zahl (Minuten) → Sekunden.
 * Ungültig → undefined.
 */
export function parseDuration(input: string | number | undefined | null): number | undefined {
  if (input === undefined || input === null || input === '') return undefined
  if (typeof input === 'number') return input > 0 ? Math.round(input * 60) : undefined
  const s = input.trim().toLowerCase()
  if (/^\d+(\.\d+)?$/.test(s)) return parseDuration(Number(s))
  const clock = s.match(/^(\d+):([0-5]\d)$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const re = /(\d+(?:\.\d+)?)\s*(h|min|m|s)/g
  let total = 0
  let consumed = ''
  for (const m of s.matchAll(re)) {
    const unit = m[2] === 'h' ? 3600 : m[2] === 's' ? 1 : 60
    total += Number(m[1]) * unit
    consumed += m[0]
  }
  if (!total || consumed.replace(/\s/g, '') !== s.replace(/\s/g, '')) return undefined
  return Math.round(total)
}

/** Sekunden → `m:ss` bzw. `h:mm:ss`; negative Werte mit Minus. */
export function formatClock(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const t = Math.floor(Math.abs(seconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = String(t % 60).padStart(2, '0')
  return h ? `${sign}${h}:${String(m).padStart(2, '0')}:${s}` : `${sign}${m}:${s}`
}

export type Pace = 'ahead' | 'on-time' | 'behind'

/**
 * Liegt man im Plan? Vergleicht den Anteil der gezeigten Folien mit dem Anteil der verbrauchten Zeit.
 * `tolerance` = erlaubte Abweichung (Anteil der Gesamtzeit), Standard 5 %.
 */
export function pace(progress: number, elapsed: number, planned: number, tolerance = 0.05): Pace {
  if (planned <= 0) return 'on-time'
  const diff = elapsed / planned - progress
  if (diff > tolerance) return 'behind'
  if (diff < -tolerance) return 'ahead'
  return 'on-time'
}
