// Einstellungen der Desktop-App: zuletzt geöffnete Decks. JSON im Datenordner der App.

import fs from 'node:fs'
import path from 'node:path'

export interface Settings {
  /** zuletzt geöffnete Decks, neuestes zuerst (absolute Pfade) */
  recent: string[]
}

export const MAX_RECENT = 8

export function readSettings(file: string): Settings {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { recent: Array.isArray(s?.recent) ? s.recent.filter((r: unknown) => typeof r === 'string') : [] }
  } catch {
    return { recent: [] }
  }
}

export function writeSettings(file: string, settings: Settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(settings, null, 2))
}

/** Pfade gleich behandeln, egal ob Groß/Klein oder Schrägstrich (Windows) */
const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()

/** Deck nach vorne holen, Duplikate entfernen, auf MAX_RECENT kürzen */
export function addRecent(recent: string[], dir: string): string[] {
  const abs = path.resolve(dir)
  return [abs, ...recent.filter((r) => !same(r, abs))].slice(0, MAX_RECENT)
}

export function removeRecent(recent: string[], dir: string): string[] {
  return recent.filter((r) => !same(r, dir))
}

/** Nicht mehr vorhandene Ordner aus der Liste entfernen */
export function existingRecent(recent: string[], exists: (p: string) => boolean = fs.existsSync): string[] {
  return recent.filter((r) => exists(r))
}

/** Ist das ein Deck? Ordner mit deck.yaml oder mindestens einer .md-Datei */
export function isDeckDir(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some((f) => f === 'deck.yaml' || f.toLowerCase().endsWith('.md'))
  } catch {
    return false
  }
}
