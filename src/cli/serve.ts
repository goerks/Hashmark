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
  /** Deck-Ordner bei jedem Start durch `seed` ersetzen (Vorschau eines Pull Requests, nie auf einer dauerhaften Festplatte) */
  reseed?: boolean
  host: string
  port: number
  editorUser?: string
  /** Ohne Passwort gibt es keinen Editor, nur die Präsentation */
  editorPassword?: string
  /** Editor ohne Passwort erreichbar (EDITOR_OPEN=1): nur für Vorschauen mit zurückgesetztem Deck, nie als Standard */
  editorOpen?: boolean
  /** fertig gebaute Webseite (make docs), unter /webseite/ ausgeliefert; nur in der Vorschau eines Pull Requests */
  siteDir?: string
}

const isEmpty = (dir: string) => !fs.existsSync(dir) || fs.readdirSync(dir).filter((f) => !f.startsWith('.')).length === 0

/** Beispiel in den Deck-Ordner kopieren: in einen leeren immer, mit `reseed` auch in einen gefüllten (dessen Inhalt wird zuerst entfernt, der Ordner selbst bleibt, er kann eine Festplatte sein). true = kopiert. */
export function seedDeck(deckDir: string, seed: string | undefined, reseed = false): boolean {
  if (!seed || !(reseed || isEmpty(deckDir))) return false
  fs.mkdirSync(deckDir, { recursive: true })
  if (reseed) for (const entry of fs.readdirSync(deckDir)) fs.rmSync(path.join(deckDir, entry), { recursive: true, force: true })
  fs.cpSync(path.resolve(seed), deckDir, { recursive: true })
  return true
}

export async function serve(opts: ServeOptions) {
  const deckDir = path.resolve(opts.deck)
  if (seedDeck(deckDir, opts.seed, opts.reseed)) console.log(`[hashmark] Beispiel kopiert: ${opts.seed} → ${deckDir}${opts.reseed ? ' (ersetzt den Inhalt)' : ''}`)
  if (isEmpty(deckDir)) throw new Error(`Deck-Ordner ist leer oder fehlt: ${deckDir} (--seed <ordner> legt ein Beispiel an)`)

  const runtimeDir = await ensureRuntime(console.log)
  // ein leerer Ordner (Image ohne Webseite) zählt nicht
  const siteDir = opts.siteDir && fs.existsSync(path.join(opts.siteDir, 'index.html')) ? path.resolve(opts.siteDir) : undefined
  const server = await startLiveServer({
    deckDir: realPath(deckDir),
    runtimeDir,
    onAppAction: () => {},
    web: { host: opts.host, port: opts.port, editorUser: opts.editorUser, editorPassword: opts.editorPassword, editorOpen: opts.editorOpen, siteDir },
  })
  console.log(`[hashmark] Präsentation: ${server.url}`)
  if (siteDir) console.log(`[hashmark] Webseite:     ${server.url}webseite/`)
  console.log(opts.editorOpen
    ? `[hashmark] Editor:       ${server.url}editor.html (OFFEN, ohne Passwort: EDITOR_OPEN=1)`
    : opts.editorPassword
    ? `[hashmark] Editor:       ${server.url}editor.html (Benutzer „${opts.editorUser ?? 'editor'}“, Passwort aus EDITOR_PASSWORD)`
    : '[hashmark] Editor aus: EDITOR_PASSWORD ist nicht gesetzt, es gibt nur die Präsentation')

  const stop = () => { void server.close().then(() => process.exit(0)) }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  return server
}
