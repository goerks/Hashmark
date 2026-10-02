// Fahrpläne speichern und laden. Bevorzugt als Datei neben dem Deck (`.hashmark/plan.json`, über den lokalen Server),
// sonst im localStorage des Browsers (Webdienst ohne Anmeldung, statischer Export).

import { emptyPlanFile, parsePlanFile, type PlanFile } from '../core/plan.ts'

// relativ, damit Builds auch in Unterverzeichnissen laufen
const API = './__hashmark/plan'
const HEADERS = { 'X-Hashmark-Editor': '1', 'Content-Type': 'application/json' }
const storageKey = () => `hashmark:plan:${location.pathname}`
/** gesetzt, solange der Server die letzte Änderung nicht angenommen hat: dann ist der Browser-Speicher neuer */
const localKey = () => `${storageKey()}:local`

function fromStorage(): PlanFile | null {
  try {
    const raw = localStorage.getItem(storageKey())
    return raw ? parsePlanFile(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function localIsNewer(): boolean {
  try { return localStorage.getItem(localKey()) === '1' } catch { return false }
}

/** Gespeicherte Fahrpläne: Server-Datei, sonst Browser-Speicher, sonst nur der Standard. */
export async function loadPlanFile(): Promise<PlanFile> {
  if (localIsNewer()) {
    const local = fromStorage()
    if (local) return local
  }
  try {
    const res = await fetch(API, { headers: HEADERS, cache: 'no-store' })
    if (res.ok) {
      const raw = await res.json()
      // der Server kennt noch keine Datei: Browser-Speicher gilt weiter
      if (raw && Object.keys(raw).length) return parsePlanFile(raw)
    }
  } catch { /* kein lokaler Server (Export, file://) */ }
  return fromStorage() ?? emptyPlanFile()
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Speichert im Browser sofort und auf dem Server gebündelt (schnelles Umschalten schreibt nicht jedes Mal). */
export function savePlanFile(file: PlanFile): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(file))
    localStorage.setItem(localKey(), '1')
  } catch { /* Speicher nicht verfügbar */ }
  clearTimeout(timer)
  timer = setTimeout(() => {
    fetch(API, { method: 'PUT', headers: HEADERS, body: JSON.stringify(file) })
      .then((res) => { if (res.ok) try { localStorage.removeItem(localKey()) } catch { /* egal */ } })
      .catch(() => {})
  }, 300)
}
