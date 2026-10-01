// `hashmark serve`: Webdienst für Docker/Render. Ein Prozess liefert die Präsentation (öffentlich) und den Editor
// (nur mit Passwort) aus demselben Deck-Ordner, Änderungen im Editor erscheinen sofort in der Präsentation.

import fs from 'node:fs'
import path from 'node:path'
import { ensureRuntime } from '../desktop/runtime-build.ts'
import { startLiveServer } from '../desktop/live-server.ts'
import { realPath } from './paths.ts'

export interface ServeOptions {
  deck: string
  /** Deck, das beim ersten Start in einen leeren Deck-Ordner kopiert wird (z. B. auf einer neuen Festplatte) */
  seed?: string
  host: string
  port: number
  editorUser?: string
  /** Ohne Passwort gibt es keinen Editor, nur die Präsentation */
  editorPassword?: string
}

const isEmpty = (dir: string) => !fs.existsSync(dir) || fs.readdirSync(dir).filter((f) => !f.startsWith('.')).length === 0

export async function serve(opts: ServeOptions) {
  const deckDir = path.resolve(opts.deck)
  if (opts.seed && isEmpty(deckDir)) {
    fs.mkdirSync(deckDir, { recursive: true })
    fs.cpSync(path.resolve(opts.seed), deckDir, { recursive: true })
    console.log(`[hashmark] Deck-Ordner war leer, Beispiel kopiert: ${opts.seed} → ${deckDir}`)
  }
  if (isEmpty(deckDir)) throw new Error(`Deck-Ordner ist leer oder fehlt: ${deckDir} (--seed <ordner> legt ein Beispiel an)`)

  const runtimeDir = await ensureRuntime(console.log)
  const server = await startLiveServer({
    deckDir: realPath(deckDir),
    runtimeDir,
    onAppAction: () => {},
    web: { host: opts.host, port: opts.port, editorUser: opts.editorUser, editorPassword: opts.editorPassword },
  })
  console.log(`[hashmark] Präsentation: ${server.url}`)
  console.log(opts.editorPassword
    ? `[hashmark] Editor:       ${server.url}editor.html (Benutzer „${opts.editorUser ?? 'editor'}“, Passwort aus EDITOR_PASSWORD)`
    : '[hashmark] Editor aus: EDITOR_PASSWORD ist nicht gesetzt, es gibt nur die Präsentation')

  const stop = () => { void server.close().then(() => process.exit(0)) }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  return server
}
