// Node-Sidecar der Desktop-App (Tauri). Tauri bringt kein Node mit; die App startet dieses Skript mit
// vendor/node/node.exe und spricht über stdin/stdout mit ihm.
//
// Protokoll (je eine Zeile JSON):
//   App → Sidecar (stdin):   {"id": 1, "cmd": "open", "dir": "C:\\decks\\x"}
//   Sidecar → App (stdout):  @@strata {"id": 1, "ok": true, "result": {…}}   bzw. {"id": 1, "ok": false, "error": "…"}
//                            @@strata {"event": "action", "action": "present", "hash": "#…"}   (aus den Seiten)
// Alles ohne Präfix `@@strata ` auf stdout ist Log und wird von der App ignoriert; Logs gehen nach stderr.

import path from 'node:path'
import readline from 'node:readline'
import fs from 'node:fs'
// Nur leichte Module beim Start – Vite, remark und Shiki kommen per import() (Aufwärmen im Hintergrund bzw. bei Bedarf)
import { PROJECT_ROOT, realPath } from '../cli/paths.ts'
import { scaffoldDeck } from '../cli/scaffold.ts'
import type { LoadResult } from '../core/deck.ts'
import type { LiveServer } from './live-server.ts'
import { ensureRuntime } from './runtime-build.ts'
import { addRecent, existingRecent, isDeckDir, readSettings, removeRecent, writeSettings } from './settings.ts'

export const PREFIX = '@@strata '
export const EXAMPLE_DECK = path.join(PROJECT_ROOT, 'examples/strata-demo')

export interface Request { id: number; cmd: string; [key: string]: unknown }
export type Emit = (msg: Record<string, unknown>) => void

export interface SidecarOptions {
  /** Datenordner der App (Einstellungen, Vite-Cache) */
  dataDir: string
  emit: Emit
  log?: (msg: string) => void
}

/** Ist ein vorab gelesenes Deck noch aktuell? Keine seiner Dateien und nicht der Ordner selbst neuer als der Zeitpunkt. */
export function isStale(deckDir: string, result: LoadResult, at: number): boolean {
  const paths = [deckDir, ...result.deck.files.map((f) => path.join(deckDir, f))]
  return paths.some((p) => {
    try { return fs.statSync(p).mtimeMs >= at } catch { return p !== path.join(deckDir, 'deck.yaml') }
  })
}

/** Befehle des Sidecars – ohne stdin/stdout, damit testbar */
export function createSidecar({ dataDir, emit, log = () => {} }: SidecarOptions) {
  const settingsFile = path.join(dataDir, 'settings.json')
  let settings = readSettings(settingsFile)
  let server: LiveServer | null = null
  let deckDir: string | null = null
  let baseUrl = ''
  /** letzte gemeldete Folie (für „Präsentieren ab aktueller Folie“) */
  let position = ''

  /** vorab gelesene Decks: Ordner → Ergebnis + Zeitpunkt (vor dem Lesen) */
  const preloaded = new Map<string, { result: Promise<LoadResult>; at: number }>()
  const ms = (t0: number) => `${Math.round(performance.now() - t0)} ms`

  /** Kern (remark, Shiki) laden und Shiki starten; danach das zuletzt geöffnete Deck vorab lesen */
  async function warmUp() {
    const t0 = performance.now()
    const [{ loadDeck }, { warmHighlighter }] = await Promise.all([import('../core/deck.ts'), import('../core/render.ts'), import('./live-server.ts')])
    await warmHighlighter(['ts', 'js', 'sh', 'yaml', 'json', 'md'])
    log(`[strata] Kern aufgewärmt in ${ms(t0)}`)
    const last = existingRecent(settings.recent)[0]
    if (last && isDeckDir(last) && !preloaded.has(last)) {
      const t1 = performance.now()
      const at = Date.now()
      const result = loadDeck(last)
      preloaded.set(last, { result, at })
      result.then(() => log(`[strata] zuletzt geöffnetes Deck vorab gelesen in ${ms(t1)}: ${last}`), () => preloaded.delete(last))
    }
  }

  const save = () => { try { writeSettings(settingsFile, settings) } catch { /* nicht kritisch */ } }
  const str = (v: unknown, name: string): string => {
    if (typeof v !== 'string' || !v) throw new Error(`${name} fehlt`)
    return v
  }

  async function stop() {
    const s = server
    server = null
    baseUrl = ''
    deckDir = null
    await s?.close().catch(() => {})
  }

  const onAppAction = (action: Record<string, unknown>) => {
    if (action.action === 'position') position = String(action.hash ?? '')
    else emit({ event: 'action', ...action })
  }

  const commands: Record<string, (r: Request) => Promise<unknown> | unknown> = {
    ping: () => ({ node: process.versions.node, root: PROJECT_ROOT }),
    isDeck: (r) => isDeckDir(str(r.dir, 'dir')),
    example: () => EXAMPLE_DECK,
    scaffold: (r) => scaffoldDeck(str(r.dir, 'dir')),
    recent: () => {
      settings.recent = existingRecent(settings.recent)
      return settings.recent.map((dir) => ({ dir, name: path.basename(dir) }))
    },
    forget: (r) => {
      settings.recent = removeRecent(settings.recent, str(r.dir, 'dir'))
      save()
      return true
    },
    async open(r) {
      // langer Pfad: dieselbe Schreibweise in „zuletzt geöffnet“, egal wie der Ordner gewählt wurde
      const dir = realPath(str(r.dir, 'dir'))
      if (!isDeckDir(dir)) throw new Error(`Kein Deck: ${dir}`)
      const t0 = performance.now()
      await stop()
      // vorgebaute Runtime (baut nur nach Änderungen an den Quellen) + Live-Server auf 127.0.0.1, freier Port
      const [runtimeDir, { startLiveServer }] = await Promise.all([
        ensureRuntime(log, undefined, path.join(dataDir, 'vite-cache')),
        import('./live-server.ts'),
      ])
      // vorab gelesenes Deck nutzen, wenn sich seitdem nichts geändert hat
      let initial: LoadResult | undefined
      const pre = preloaded.get(dir)
      preloaded.delete(dir)
      if (pre) {
        const result = await pre.result.catch(() => undefined)
        if (result && !isStale(dir, result, pre.at)) initial = result
      }
      const s = await startLiveServer({ deckDir: dir, runtimeDir, onAppAction, initial, log })
      log(`[strata] Deck geöffnet in ${ms(t0)}${initial ? ' (vorab gelesen)' : ''}: ${dir}`)
      server = s
      deckDir = dir
      baseUrl = s.url
      position = ''
      settings.recent = addRecent(settings.recent, dir)
      save()
      return { url: baseUrl, dir, name: path.basename(dir) }
    },
    close: () => stop(),
    position: () => position,
    async pdf(r) {
      if (!baseUrl) throw new Error('Kein Deck geöffnet')
      const query = typeof r.query === 'string' && r.query.startsWith('?print') ? r.query : '?print'
      const t0 = performance.now()
      const { printUrlToPdf } = await import('../cli/pdf.ts')
      const res = await printUrlToPdf(baseUrl + query, str(r.out, 'out'))
      log(`[strata] PDF in ${ms(t0)}: ${res.pages} Seiten`)
      return { pages: res.pages, bytes: res.bytes }
    },
    async html(r) {
      if (!deckDir) throw new Error('Kein Deck geöffnet')
      const out = str(r.out, 'out')
      const [{ exportSingleFile }, { config }] = await Promise.all([import('../cli/export.ts'), import('../cli/config.ts')])
      await exportSingleFile(config(deckDir, { logLevel: 'warn' }, { inlineAssets: true }, { cacheDir: path.join(dataDir, 'vite-cache') }), out)
      return { out }
    },
  }

  async function handle(req: Request): Promise<void> {
    const cmd = commands[req.cmd]
    try {
      if (!cmd) throw new Error(`Unbekannter Befehl: ${req.cmd}`)
      emit({ id: req.id, ok: true, result: (await cmd(req)) ?? null })
    } catch (e) {
      emit({ id: req.id, ok: false, error: (e as Error).message ?? String(e) })
    }
  }

  return { handle, stop, warmUp, get url() { return baseUrl } }
}

// ---------- Start als eigener Prozess ----------

// sidecar.ts direkt oder als Bündel (sidecar.bundle.mjs, siehe scripts/bundle-sidecar.ts)
if (process.argv[1] && /^sidecar(.bundle)?.(ts|mjs)$/.test(path.basename(process.argv[1]))) {
  const dataArg = process.argv.find((a) => a.startsWith('--data='))?.slice('--data='.length)
  const dataDir = path.resolve(dataArg ?? path.join(PROJECT_ROOT, 'node_modules/.strata-app'))
  // stdout gehört dem Protokoll: Logs (auch von Vite und den Exporten) nach stderr
  const write = process.stdout.write.bind(process.stdout)
  console.log = console.info = (...args: unknown[]) => console.error(...args)
  const emit: Emit = (msg) => write(PREFIX + JSON.stringify(msg) + '\n')
  const sidecar = createSidecar({ dataDir, emit, log: (m) => console.error(m) })

  const rl = readline.createInterface({ input: process.stdin })
  rl.on('line', (line) => {
    if (!line.trim()) return
    let req: Request
    try {
      req = JSON.parse(line)
    } catch {
      console.error(`[sidecar] ungültige Zeile: ${line.slice(0, 200)}`)
      return
    }
    void sidecar.handle(req)
  })
  // App beendet → stdin schließt → aufräumen
  rl.on('close', () => { void sidecar.stop().finally(() => process.exit(0)) })
  emit({ event: 'ready', node: process.versions.node })
  console.error(`[strata] Sidecar bereit nach ${Math.round(performance.now())} ms`)
  // im Hintergrund: Kern laden, Shiki starten, letztes Deck vorab lesen – während die Startseite angezeigt wird
  setTimeout(() => void sidecar.warmUp().catch((e) => console.error('[strata] Aufwärmen fehlgeschlagen:', e)), 0)
}
