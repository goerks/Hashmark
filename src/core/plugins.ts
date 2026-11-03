// Plugin-Schnittstelle, Version 1 (Ticket #56): Erweiterungen melden sich hier an, der Kern fragt nur diese Liste.
// Ein Plugin läuft beim Laden des Decks in Node (nie im Browser des Publikums) und liefert fertiges HTML/SVG.
// Mitgelieferte Plugins (Mermaid, QR, Formeln, Code) sind die ersten Nutzer derselben Schnittstelle.

import type { CodeBlockPlugin } from './render.ts'

/** Version des Plugin-Vertrags. Ein Plugin nennt die Version, für die es gebaut ist; fremde Versionen werden abgelehnt. */
export const PLUGIN_API = 1

export interface HashmarkPlugin {
  /** eindeutiger Name, klein, mit Bindestrichen (`markmap`) */
  name: string
  /** Version des Plugin-Vertrags (`PLUGIN_API`) */
  api: number
  /** Zuständigkeit für Codeblöcke: Info-String-Sprachen, Rendern zu HTML mit Schritten */
  codeBlocks?: CodeBlockPlugin[]
}

export interface RegisterOptions {
  /** mitgeliefert: darf als einziges den Platzhalter `*` (alle übrigen Sprachen) belegen */
  builtin?: boolean
}

interface Entry { plugin: HashmarkPlugin; builtin: boolean }

const registry: Entry[] = []

const NAME = /^[a-z][a-z0-9-]*$/

/** Probleme eines Plugins als Sätze (leer = gültig). Prüft Form und Vertragsversion, führt nichts aus. */
export function pluginProblems(plugin: unknown): string[] {
  if (typeof plugin !== 'object' || plugin === null) return ['Das Plugin ist kein Objekt.']
  const p = plugin as Partial<HashmarkPlugin>
  const problems: string[] = []
  if (typeof p.name !== 'string' || !NAME.test(p.name)) problems.push('Der Name fehlt oder ist ungültig (klein, mit Bindestrichen, z. B. „markmap“).')
  if (p.api !== PLUGIN_API) problems.push(`Das Plugin ist für Version ${String(p.api)} gebaut, Hashmark kennt Version ${PLUGIN_API}.`)
  if (p.codeBlocks !== undefined) {
    if (!Array.isArray(p.codeBlocks)) problems.push('„codeBlocks“ muss eine Liste sein.')
    else p.codeBlocks.forEach((b, i) => {
      if (!b || !Array.isArray(b.langs) || b.langs.length === 0 || b.langs.some((l) => typeof l !== 'string' || !l)) problems.push(`codeBlocks[${i}]: „langs“ braucht mindestens eine Sprache.`)
      if (!b || typeof b.render !== 'function') problems.push(`codeBlocks[${i}]: „render“ fehlt.`)
    })
  }
  return problems
}

/** Plugin anmelden. Wirft einen Fehler mit verständlichem Text, wenn es ungültig ist oder eine Sprache schon belegt ist. */
export function registerPlugin(plugin: HashmarkPlugin, options: RegisterOptions = {}): void {
  const problems = pluginProblems(plugin)
  if (problems.length) throw new Error(`Plugin ungültig: ${problems.join(' ')}`)
  if (registry.some((e) => e.plugin.name === plugin.name)) throw new Error(`Plugin „${plugin.name}“ ist schon angemeldet.`)
  for (const block of plugin.codeBlocks ?? []) {
    for (const lang of block.langs) {
      if (lang === '*' && !options.builtin) throw new Error(`Plugin „${plugin.name}“ darf nicht alle Sprachen („*“) belegen, das ist den mitgelieferten Plugins vorbehalten.`)
      const owner = registry.find((e) => e.plugin.codeBlocks?.some((b) => b.langs.includes(lang)))
      if (owner) throw new Error(`Plugin „${plugin.name}“: Die Sprache „${lang}“ gehört schon dem Plugin „${owner.plugin.name}“.`)
    }
  }
  registry.push({ plugin, builtin: !!options.builtin })
}

/** Plugin abmelden (für Tests und das Neuladen eines Decks). Mitgelieferte lassen sich nicht abmelden. */
export function unregisterPlugin(name: string): boolean {
  const i = registry.findIndex((e) => e.plugin.name === name && !e.builtin)
  if (i < 0) return false
  registry.splice(i, 1)
  return true
}

export function listPlugins(): { name: string; builtin: boolean; langs: string[] }[] {
  return registry.map((e) => ({ name: e.plugin.name, builtin: e.builtin, langs: (e.plugin.codeBlocks ?? []).flatMap((b) => b.langs) }))
}

/** Zuständiges Codeblock-Plugin: erst die genannte Sprache, sonst der Platzhalter `*` */
export function findCodeBlockPlugin(lang: string | null | undefined): CodeBlockPlugin | undefined {
  const blocks = registry.flatMap((e) => e.plugin.codeBlocks ?? [])
  return blocks.find((b) => b.langs.includes(lang ?? '')) ?? blocks.find((b) => b.langs.includes('*'))
}
