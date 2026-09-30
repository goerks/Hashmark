// Vorgebaute Runtime der Desktop-App (runtime-dist/). Gebaut wird nur, wenn sich die Quellen geändert haben:
// Stempel = Hash über den Inhalt von src/runtime, src/core, src/vite und package.json.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT } from '../cli/paths.ts'

export const RUNTIME_OUT = path.join(PROJECT_ROOT, 'runtime-dist')
const STAMP = '.strata-runtime.json'
const SOURCES = ['src/runtime', 'src/core', 'src/vite', 'package.json']

function files(p: string): string[] {
  if (!fs.existsSync(p)) return []
  if (fs.statSync(p).isFile()) return [p]
  return fs.readdirSync(p).sort().flatMap((f) => files(path.join(p, f)))
}

/** Inhalts-Hash der Quellen – unabhängig von Änderungsdatum und Speicherort */
export function sourceHash(root = PROJECT_ROOT): string {
  const h = crypto.createHash('sha256')
  for (const rel of SOURCES) {
    for (const file of files(path.join(root, rel))) {
      h.update(path.relative(root, file).split(path.sep).join('/'))
      h.update(fs.readFileSync(file))
    }
  }
  return h.digest('hex').slice(0, 16)
}

/** Hash der eigenen Quellen – ändert sich während eines Prozesses nicht, also nur einmal berechnen */
let ownHash: string | undefined
const currentHash = () => (ownHash ??= sourceHash())

export function isFresh(out = RUNTIME_OUT): boolean {
  try {
    const stamp = JSON.parse(fs.readFileSync(path.join(out, STAMP), 'utf8'))
    return stamp.hash === currentHash() && fs.existsSync(path.join(out, 'index.html')) && fs.existsSync(path.join(out, 'editor.html'))
  } catch {
    return false
  }
}

/** Baut die Runtime, falls nötig. Liefert den Ordner. */
export async function ensureRuntime(log: (msg: string) => void = console.error, out = RUNTIME_OUT, cacheDir?: string): Promise<string> {
  if (isFresh(out)) return out
  const started = Date.now()
  log('[strata] baue die Runtime der App (einmalig nach Änderungen) …')
  // Vite nur laden, wenn wirklich gebaut wird (spart beim Start der App ~1 s)
  const [{ build }, { liveConfig }] = await Promise.all([import('vite'), import('../cli/config.ts')])
  await build(liveConfig(out, { cacheDir }))
  ownHash = sourceHash()
  fs.writeFileSync(path.join(out, STAMP), JSON.stringify({ hash: ownHash, built: new Date().toISOString() }))
  log(`[strata] Runtime gebaut in ${((Date.now() - started) / 1000).toFixed(0)} s`)
  return out
}

// Aufruf als Skript: node src/desktop/runtime-build.ts  (make app / make app-package)
if (process.argv[1] && path.basename(process.argv[1]) === 'runtime-build.ts') {
  await ensureRuntime(console.log)
  console.log(`[strata] Runtime: ${RUNTIME_OUT}${isFresh() ? ' (aktuell)' : ''}`)
}
