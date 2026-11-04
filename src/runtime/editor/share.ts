// Anzeige des Teilen-Zustands (Chip, Zähler); rein, ohne DOM

import type { ShareStatus } from '../../share/client.ts'

export interface ShareCounts { up: number; down: number; conflict: number; gone: number }

export function shareCounts(s: ShareStatus): ShareCounts {
  const c = { up: 0, down: 0, conflict: 0, gone: 0 }
  for (const f of Object.values(s.files)) c[f.state]++
  return c
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export type Tone = 'ok' | 'warn' | 'info' | 'danger' | 'muted'

/** Text und Farbe des Statuschips in der Kopfzeile */
export function shareLabel(s: ShareStatus): { text: string; tone: Tone } {
  const c = shareCounts(s)
  switch (s.state) {
    case 'sync': return { text: 'Geteilt · synchron', tone: 'ok' }
    case 'local': return { text: plural(c.up, 'lokale Änderung', 'lokale Änderungen'), tone: 'warn' }
    case 'remote': return { text: `Online: ${plural(c.down, 'Änderung', 'Änderungen')}`, tone: 'info' }
    case 'conflict': return { text: `Konflikt in ${plural(c.conflict, 'Datei', 'Dateien')}`, tone: 'danger' }
    case 'asleep': return { text: 'Dienst wird geweckt …', tone: 'muted' }
    case 'restarted': return { text: 'Online-Kopie fehlt', tone: 'warn' }
    case 'unreachable': return { text: 'Dienst nicht erreichbar', tone: 'muted' }
    default: return { text: 'Nicht geteilt', tone: 'muted' }
  }
}
