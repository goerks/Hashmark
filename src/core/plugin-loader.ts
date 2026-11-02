// Plugins aus dem Deck laden (Ticket #56, Stufe 2). Ein Plugin aus dem Deck ist fremder Code und läuft nur, wenn
//  - die Umgebung es erlaubt (Webdienst: nie, `HASHMARK_PLUGINS=off`) und
//  - die Prüfsumme seiner Dateien vom Nutzer freigegeben wurde (`hashmark trust`). Die Freigabe liegt im Benutzerordner,
//    nie im Deck: ein Deck kann sich nicht selbst vertrauen. Ändert sich eine Datei, gilt die Freigabe nicht mehr.
// Nur Node, nie im Browser. Nichts wird importiert, bevor beides erfüllt ist.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pluginProblems, registerPlugin, unregisterPlugin, type HashmarkPlugin } from './plugins.ts'

export type PluginState = 'loaded' | 'untrusted' | 'blocked' | 'invalid' | 'missing'

export interface PluginStatus {
  /** Eintrag aus `plugins:` in der deck.yaml */
  spec: string
  state: PluginState
  /** Prüfsumme (sha256) aller Dateien des Plugins */
  hash?: string
  /** Name des Plugins, sobald es geladen ist */
  name?: string
  message?: string
}

const ENTRIES = ['index.mjs', 'index.js', 'index.ts']
const SKIP_DIRS = new Set(['node_modules', '.git'])
const MAX_FILE = 5 * 1024 * 1024

// ---------- Freigabe ----------

export interface TrustEntry { label: string; at: string }

/** Datei mit den freigegebenen Prüfsummen: im Benutzerordner, überschreibbar mit HASHMARK_TRUST_FILE */
export function trustFilePath(): string {
  return process.env.HASHMARK_TRUST_FILE || path.join(os.homedir(), '.hashmark', 'trusted-plugins.json')
}

/** Freigaben lesen; fehlt die Datei oder ist sie kaputt, gilt nichts als freigegeben */
export function readTrusted(): Record<string, TrustEntry> {
  try {
    const data = JSON.parse(fs.readFileSync(trustFilePath(), 'utf8')) as unknown
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data as Record<string, unknown>).filter(([k, v]) => /^[0-9a-f]{64}$/.test(k) && typeof v === 'object' && v !== null) as [string, TrustEntry][])
  } catch {
    return {}
  }
}

export function trustPlugin(hash: string, label: string): void {
  const file = trustFilePath()
  const all = readTrusted()
  all[hash] = { label, at: new Date().toISOString() }
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n', { mode: 0o600 })
}

/** Freigabe entziehen; `prefix` darf eine Kurzform der Prüfsumme sein. Gibt die entzogenen Prüfsummen zurück. */
export function revokeTrust(prefix: string): string[] {
  const file = trustFilePath()
  const all = readTrusted()
  const hit = Object.keys(all).filter((h) => prefix.length >= 6 && h.startsWith(prefix.toLowerCase()))
  for (const h of hit) delete all[h]
  if (hit.length) fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n')
  return hit
}

// ---------- Prüfsumme ----------

/** Alle Dateien eines Plugin-Ordners, nach Pfad mit `/` sortiert (auf jedem System gleich). Verknüpfungen sind verboten: Sie könnten auf Code außerhalb zeigen, den die Prüfsumme nicht deckt. */
function listFiles(root: string, dir = root): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isSymbolicLink()) throw new Error(`enthält eine Verknüpfung (${path.relative(root, p).split(path.sep).join('/')}), das ist nicht erlaubt`)
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) out.push(...listFiles(root, p)) }
    else if (e.isFile()) out.push(p)
  }
  return out.sort((a, b) => rel(root, a).localeCompare(rel(root, b), 'en'))
}

const rel = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/')

const CODE_FILE = /\.(?:m?js|cjs|m?ts)$/
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](\.{1,2}(?:\/[^'"]*)?)['"]/g

/**
 * Relative Importe dürfen nur auf Dateien im Plugin-Ordner zeigen, sonst deckt die Prüfsumme den geladenen Code nicht.
 * Eine Einzeldatei darf gar nichts Relatives importieren. Dynamisch berechnete Importe erkennt das nicht: Wer einem Plugin
 * vertraut, vertraut seinem ganzen Code.
 */
function checkImports(root: string, single: boolean, files: string[]) {
  for (const file of files.filter((f) => CODE_FILE.test(f))) {
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(RELATIVE_IMPORT)) {
      const target = path.resolve(path.dirname(file), m[1])
      const outside = path.relative(root, target).startsWith('..') || path.isAbsolute(path.relative(root, target))
      if (single || outside) {
        throw new Error(`importiert „${m[1]}“, das die Prüfsumme nicht abdeckt${single ? ' (eine einzelne Datei darf nichts Relatives importieren: alles in die Datei oder das Plugin in einen Ordner legen)' : ' (liegt außerhalb des Plugin-Ordners)'}`)
      }
    }
  }
}

/** Einstiegsdatei und Prüfsumme eines Plugins: eine Datei oder ein Ordner mit index.mjs/js/ts (dann zählen alle Dateien darin) */
export function hashPlugin(abs: string): { entry: string; hash: string } {
  const stat = fs.lstatSync(abs)
  const h = crypto.createHash('sha256')
  if (stat.isFile()) {
    if (fs.statSync(abs).size > MAX_FILE) throw new Error('Datei zu groß (über 5 MB)')
    checkImports(abs, true, [abs])
    h.update(fs.readFileSync(abs))
    return { entry: abs, hash: h.digest('hex') }
  }
  if (!stat.isDirectory()) throw new Error('weder Datei noch Ordner')
  const entry = ENTRIES.map((e) => path.join(abs, e)).find((p) => fs.existsSync(p))
  if (!entry) throw new Error(`Im Ordner fehlt eine Einstiegsdatei (${ENTRIES.join(', ')})`)
  const files = listFiles(abs)
  checkImports(abs, false, files)
  for (const file of files) {
    if (fs.statSync(file).size > MAX_FILE) throw new Error(`Datei zu groß (über 5 MB): ${rel(abs, file)}`)
    h.update(rel(abs, file) + '\0')
    h.update(fs.readFileSync(file))
    h.update('\0')
  }
  return { entry, hash: h.digest('hex') }
}

/** Pfad im Deck-Ordner auflösen; nach außen (auch über Verknüpfungen) ist verboten */
function resolveInside(deckDir: string, spec: string): string | undefined {
  const root = fs.realpathSync(deckDir)
  const abs = path.resolve(root, spec)
  if (!fs.existsSync(abs)) return undefined
  const real = fs.realpathSync(abs)
  const rel = path.relative(root, real)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('liegt außerhalb des Deck-Ordners')
  return real
}

// ---------- Laden ----------

const NAMES_LOADED: string[] = []

/** `HASHMARK_PLUGINS=off`: keine Plugins aus dem Deck (der Webdienst setzt das) */
export const deckPluginsAllowed = () => process.env.HASHMARK_PLUGINS !== 'off'

/** Prüft die Einträge ohne etwas auszuführen: Zustand und Prüfsumme je Plugin (für `hashmark trust` und die Meldungen) */
export function inspectPlugins(deckDir: string, specs: unknown): PluginStatus[] {
  if (specs === undefined || specs === null) return []
  if (!Array.isArray(specs) || specs.some((s) => typeof s !== 'string' || !s.trim())) {
    return [{ spec: String(specs), state: 'invalid', message: 'deck.yaml: plugins muss eine Liste von Pfaden sein, z. B. plugins: [./plugins/meins]' }]
  }
  const trusted = readTrusted()
  return (specs as string[]).map((spec): PluginStatus => {
    try {
      const abs = resolveInside(deckDir, spec)
      if (!abs) return { spec, state: 'missing', message: `Plugin „${spec}“ nicht gefunden (deck.yaml: plugins)` }
      const { hash } = hashPlugin(abs)
      if (!deckPluginsAllowed()) return { spec, state: 'blocked', hash, message: `Plugin „${spec}“ wird hier nicht geladen: Der Webdienst führt keine Plugins aus dem Deck aus.` }
      if (!trusted[hash]) return { spec, state: 'untrusted', hash, message: `Plugin „${spec}“ ist nicht freigegeben und wird nicht geladen (Prüfsumme ${hash.slice(0, 12)}). Mit „hashmark trust“ freigeben, nachdem du den Code gelesen hast.` }
      return { spec, state: 'loaded', hash }
    } catch (e) {
      return { spec, state: 'invalid', message: `Plugin „${spec}“ ungültig: ${(e as Error).message}` }
    }
  })
}

/** Meldet die Plugins des vorigen Decks ab und lädt die freigegebenen des aktuellen. Gibt je Eintrag den Zustand zurück. */
export async function loadDeckPlugins(deckDir: string, specs: unknown, warnings: string[]): Promise<PluginStatus[]> {
  for (const name of NAMES_LOADED.splice(0)) unregisterPlugin(name)
  const found = inspectPlugins(deckDir, specs)
  for (const status of found) {
    if (status.state !== 'loaded') {
      if (status.message) warnings.push(status.message)
      continue
    }
    try {
      // Der Code kann sich zwischen Prüfung und Laden geändert haben: nochmals prüfen, direkt vor dem Import
      const { entry, hash } = hashPlugin(resolveInside(deckDir, status.spec)!)
      if (hash !== status.hash) throw new Error('hat sich während des Ladens geändert, bitte noch einmal laden')
      // die Prüfsumme in der Adresse: geänderte Dateien werden neu gelesen statt aus dem Zwischenspeicher
      const mod = await import(/* @vite-ignore */ `${pathToFileURL(entry).href}?v=${status.hash!.slice(0, 16)}`) as { default?: unknown; plugin?: unknown }
      const plugin = (mod.default ?? mod.plugin) as HashmarkPlugin
      const problems = pluginProblems(plugin)
      if (problems.length) throw new Error(problems.join(' '))
      registerPlugin(plugin)
      NAMES_LOADED.push(plugin.name)
      status.name = plugin.name
    } catch (e) {
      status.state = 'invalid'
      status.message = `Plugin „${status.spec}“ ungültig: ${(e as Error).message}`
      warnings.push(status.message)
    }
  }
  return found
}
