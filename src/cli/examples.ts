// Beispiel-Decks (Unterordner von examples/): für die Startseite der Desktop-App und die Web-Auswahl (make build-examples).
// Ohne Abhängigkeiten, damit der Desktop-Sidecar schnell startet.

import fs from 'node:fs'
import path from 'node:path'
import { isDeckDir } from '../desktop/settings.ts'
import { PROJECT_ROOT, realPath } from './paths.ts'

export interface Example { dir: string; name: string; title: string }

/** Alle Beispiel-Decks mit Titel aus der deck.yaml (sonst Ordnername), alphabetisch. */
export function listExamples(root = path.join(PROJECT_ROOT, 'examples')): Example[] {
  let names: string[]
  try { names = fs.readdirSync(root).sort() } catch { return [] }
  const out: Example[] = []
  for (const name of names) {
    const dir = path.join(root, name)
    if (!isDeckDir(dir)) continue
    let title = name
    try {
      const m = fs.readFileSync(path.join(dir, 'deck.yaml'), 'utf8').match(/^title:\s*(.+?)\s*$/m)
      if (m) title = m[1].replace(/^(["'])(.*)\1$/, '$2')
    } catch { /* ohne deck.yaml: Ordnername */ }
    out.push({ dir: realPath(dir), name, title })
  }
  return out
}
