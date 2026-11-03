// `hashmark trust [deck]`: Plugins aus dem Deck freigeben, auflisten oder die Freigabe entziehen (Ticket #56, Stufe 2).
// Die Freigabe gilt für die Prüfsumme der Plugin-Dateien und liegt im Benutzerordner (siehe src/core/plugin-loader.ts).

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import YAML from 'yaml'
import { inspectPlugins, readTrusted, revokeTrust, trustFilePath, trustPlugin, type PluginStatus } from '../core/plugin-loader.ts'

export interface TrustOptions {
  /** alle Plugins des Decks ohne Rückfrage freigeben */
  yes?: boolean
  /** gespeicherte Freigaben auflisten */
  list?: boolean
  /** Freigabe mit dieser Prüfsumme (mindestens 6 Zeichen) entziehen */
  revoke?: string
}

/** Einträge `plugins:` aus der deck.yaml (ohne etwas auszuführen) */
export function deckPluginSpecs(deckDir: string): unknown {
  try {
    const manifest = YAML.parse(fs.readFileSync(path.join(deckDir, 'deck.yaml'), 'utf8')) ?? {}
    return (manifest as { plugins?: unknown }).plugins
  } catch {
    return undefined
  }
}

const LABEL: Record<PluginStatus['state'], string> = {
  loaded: 'freigegeben',
  untrusted: 'NICHT freigegeben',
  blocked: 'hier gesperrt',
  invalid: 'ungültig',
  missing: 'nicht gefunden',
}

/** Rückfrage im Terminal; ohne Terminal wird nie freigegeben */
async function ask(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    return /^(j|ja|y|yes)$/i.test((await rl.question(question)).trim())
  } finally {
    rl.close()
  }
}

/** Gibt Zeilen für die Ausgabe zurück und setzt bei Bedarf `process.exitCode` nicht selbst: der Aufrufer entscheidet */
export async function runTrust(deck: string, opts: TrustOptions, print: (line: string) => void = console.log): Promise<number> {
  if (opts.list) {
    const all = Object.entries(readTrusted())
    print(`Freigaben in ${trustFilePath()}:`)
    if (!all.length) print('  (keine)')
    for (const [hash, e] of all) print(`  ${hash.slice(0, 12)}  ${e.label}  (${e.at.slice(0, 10)})`)
    return 0
  }
  if (opts.revoke) {
    const hit = revokeTrust(opts.revoke)
    print(hit.length ? `Freigabe entzogen: ${hit.map((h) => h.slice(0, 12)).join(', ')}` : 'Keine Freigabe mit dieser Prüfsumme (mindestens 6 Zeichen angeben, siehe --list).')
    return hit.length ? 0 : 1
  }

  const deckDir = path.resolve(deck)
  const specs = deckPluginSpecs(deckDir)
  const found = inspectPlugins(deckDir, specs)
  if (!found.length) {
    print('Das Deck nutzt keine Plugins (deck.yaml: plugins).')
    return 0
  }
  let code = 0
  for (const s of found) {
    const hash = s.hash ? ` (Prüfsumme ${s.hash.slice(0, 12)})` : ''
    print(`${s.spec}: ${LABEL[s.state]}${hash}`)
    if (s.state === 'untrusted' && s.hash) {
      const ok = opts.yes || await ask(`  „${s.spec}“ kann beliebigen Code auf diesem Rechner ausführen. Hast du ihn gelesen und vertraust ihm? [j/N] `)
      if (ok) {
        trustPlugin(s.hash, `${path.basename(deckDir)}: ${s.spec}`)
        print('  → freigegeben')
      } else {
        print(process.stdin.isTTY || opts.yes ? '  → nicht freigegeben' : '  → nicht freigegeben (ohne Terminal nur mit --yes)')
        code = 1
      }
    } else if (s.state !== 'loaded') {
      if (s.message) print(`  ${s.message}`)
      code = 1
    }
  }
  return code
}
