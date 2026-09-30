// Pfade des Projekts – ohne Abhängigkeiten, damit der Desktop-Sidecar schnell startet (Vite lädt er nur bei Bedarf).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Echter, langer Pfad. Unter Windows kann ein Pfad 8.3-Kurznamen enthalten (`C:\Users\MICHAE~1\…`, z. B. aus %TEMP%).
 * Vite vergleicht die Freigaben (server.fs.allow) dann mit dem langen Pfad und verweigert die eigenen Dateien.
 */
export function realPath(p: string): string {
  try {
    return fs.realpathSync.native(p)
  } catch {
    return path.resolve(p)
  }
}

export const PROJECT_ROOT = realPath(fileURLToPath(new URL('../../', import.meta.url)))
export const RUNTIME_DIR = path.join(PROJECT_ROOT, 'src/runtime')
