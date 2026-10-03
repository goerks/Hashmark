// Theme v2: Basis-Theme (eingebaut, Datei oder Ordner) + Layout-CSS + Zusatz-CSS + Token-Overrides → ein CSS-Text.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTemplate, type Template } from './components.ts'
import { IMAGE_MIME } from './render.ts'
import type { ThemeConfig } from './types.ts'
import { CONTAINERS } from './vocab.ts'

/** Langer Pfad (ohne 8.3-Kurznamen wie MICHAE~1), sonst verweigert Vite das Theme als „außerhalb“ */
export const BUILTIN_THEMES_DIR = (() => {
  const dir = fileURLToPath(new URL('../runtime/themes/', import.meta.url))
  try { return fs.realpathSync.native(dir) + path.sep } catch { return dir }
})()

export interface ResolvedTheme {
  /** fertiges CSS: Basis, Layouts, Zusatz-CSS, zuletzt die Token-Overrides */
  css: string
  /** alle gelesenen Dateien und Ordner (für den File-Watcher) */
  files: string[]
  warnings: string[]
  /** Vorlagen eigener Container (`components/*.html`), nach Name */
  components: Record<string, Template>
}

/** Eingebaute Komponenten (timeline, person, process, kpis …): in jedem Deck verfügbar, Theme und Deck dürfen sie überschreiben */
export const BUILTIN_COMPONENTS_DIR = (() => {
  const dir = fileURLToPath(new URL('../runtime/components/', import.meta.url))
  try { return fs.realpathSync.native(dir) + path.sep } catch { return dir }
})()

const DEFAULT_THEME = 'minimal'
const ASSET_MIME: Record<string, string> = { ...IMAGE_MIME, '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' }

/** `minimal` → eingebaut, alles mit `/`, `\` oder `.` ist ein Pfad (Datei oder Ordner) */
const isPath = (ref: string) => /[\\/.]/.test(ref)

/** Relative `url(…)` in einer Theme-Datei als Data-URI einbetten (Logo, Schriften), damit Build und Export autark bleiben. */
function embedUrls(css: string, baseDir: string, warnings: string[]): string {
  // Kommentare mitlesen und unverändert lassen, sonst fände auch `url(…)` in einem Kommentar ein Ziel
  return css.replace(/\/\*[^]*?\*\/|url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (match, _q: string | undefined, ref: string | undefined) => {
    if (ref === undefined || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(ref)) return match
    const file = path.resolve(baseDir, decodeURI(ref.split(/[?#]/)[0]))
    const type = ASSET_MIME[path.extname(file).toLowerCase()]
    if (!type || !fs.existsSync(file)) {
      warnings.push(`Theme: Datei nicht gefunden oder nicht einbettbar: ${ref}`)
      return match
    }
    return `url("data:${type};base64,${fs.readFileSync(file).toString('base64')}")`
  })
}

function readCss(file: string, files: string[], warnings: string[]): string {
  files.push(file)
  try {
    return `/* ${path.basename(file)} */\n${embedUrls(fs.readFileSync(file, 'utf8'), path.dirname(file), warnings)}\n`
  } catch {
    warnings.push(`Theme: CSS-Datei nicht lesbar: ${file}`)
    return ''
  }
}

/** Alle `*.css` eines Ordners, alphabetisch. */
function readCssDir(dir: string, files: string[], warnings: string[]): string {
  files.push(dir)
  let names: string[]
  try { names = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.css')).sort() } catch {
    warnings.push(`Theme: Ordner nicht lesbar: ${dir}`)
    return ''
  }
  return names.map((n) => readCss(path.join(dir, n), files, warnings)).join('')
}

/** Basis: eingebautes Theme, CSS-Datei oder Theme-Ordner (`theme.css` + `layouts/*.css`). */
function readBase(deckDir: string, ref: string, files: string[], warnings: string[]): string {
  if (!isPath(ref)) {
    const file = path.join(BUILTIN_THEMES_DIR, `${ref}.css`)
    if (fs.existsSync(file)) return readCss(file, files, warnings)
    warnings.push(`Theme "${ref}" gibt es nicht – stattdessen "${DEFAULT_THEME}"`)
    return readCss(path.join(BUILTIN_THEMES_DIR, `${DEFAULT_THEME}.css`), files, warnings)
  }
  const abs = path.resolve(deckDir, ref)
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    files.push(abs)
    const main = path.join(abs, 'theme.css')
    let css = fs.existsSync(main) ? readCss(main, files, warnings) : (warnings.push(`Theme-Ordner ohne theme.css: ${ref}`), '')
    const layouts = path.join(abs, 'layouts')
    if (fs.existsSync(layouts)) css += readCssDir(layouts, files, warnings)
    return css
  }
  return readCss(abs, files, warnings)
}

/** `accent` und `--color-accent` meinen dasselbe; Werte dürfen die Regel nicht verlassen. */
function tokenRule(tokens: Record<string, unknown>, warnings: string[]): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(tokens)) {
    const name = key.startsWith('--') ? key : `--${key}`
    const v = String(value).trim()
    if (!/^--[\w-]+$/.test(name) || /[{};]/.test(v)) {
      warnings.push(`Theme: ungültiges Token "${key}: ${v}"`)
      continue
    }
    lines.push(`  ${name}: ${v};`)
  }
  return lines.length ? `/* tokens */\n:root {\n${lines.join('\n')}\n}\n` : ''
}

/** Ordner für `components/`: Theme-Ordner und Deck-Ordner, der Deck-Ordner gewinnt bei gleichem Namen */
const COMPONENTS_DIR = 'components'
const COMPONENT_NAME = /^[a-z][\w-]*$/i
/** Namen, die Hashmark selbst belegt (Container der Gestaltung und interne) */
const RESERVED = new Set([...CONTAINERS, 'note-step', 'card-body'])

/** `components/*.html` (Vorlagen) und `components/*.css` lesen. */
function readComponents(dir: string, templates: Record<string, Template>, files: string[], warnings: string[]): string {
  let names: string[]
  try { names = fs.readdirSync(dir).sort() } catch { return '' }
  files.push(dir)
  let css = ''
  for (const n of names) {
    const file = path.join(dir, n)
    const ext = path.extname(n).toLowerCase()
    if (ext === '.css') css += readCss(file, files, warnings)
    else if (ext === '.html') {
      const name = path.basename(n, path.extname(n))
      files.push(file)
      if (!COMPONENT_NAME.test(name)) { warnings.push(`Komponente: „${n}“ ist kein gültiger Name (Buchstaben, Ziffern, - und _)`); continue }
      if (RESERVED.has(name)) { warnings.push(`Komponente „${name}“ ist ein eingebauter Container und wird nicht überschrieben (${n})`); continue }
      try {
        templates[name] = parseTemplate(fs.readFileSync(file, 'utf8'))
      } catch (e) {
        warnings.push(`Komponente „${name}“ (${path.join(COMPONENTS_DIR, n)}): ${(e as Error).message}`)
        delete templates[name]
      }
    }
  }
  return css
}

export function resolveTheme(deckDir: string, theme: string | ThemeConfig | undefined): ResolvedTheme {
  const files: string[] = []
  const warnings: string[] = []
  const cfg: ThemeConfig = typeof theme === 'object' && theme !== null ? theme : { extends: theme }
  const base = cfg.extends ?? DEFAULT_THEME
  let css = readBase(deckDir, base, files, warnings)

  const dirs = cfg.layouts === undefined ? [] : [cfg.layouts].flat()
  for (const dir of dirs) css += readCssDir(path.resolve(deckDir, dir), files, warnings)

  const components: Record<string, Template> = {}
  const baseDir = isPath(base) ? path.resolve(deckDir, base) : undefined
  const componentDirs = [
    BUILTIN_COMPONENTS_DIR,
    ...(baseDir && fs.existsSync(baseDir) && fs.statSync(baseDir).isDirectory() ? [path.join(baseDir, COMPONENTS_DIR)] : []),
    path.join(deckDir, COMPONENTS_DIR),
  ]
  for (const dir of componentDirs) css += readComponents(dir, components, files, warnings)
  // Namen und Beschreibungen für den Editor (Linter, Vorschläge): als Eigenschaft lesbar, ohne dass die Seite sie anzeigt.
  // URL-kodiertes JSON, damit nichts maskiert werden muss.
  const info = Object.fromEntries(Object.entries(components).map(([name, t]) => [name, t.meta ?? {}]))
  if (Object.keys(info).length) css += `/* components */\n:root { --hm-components: "${encodeURIComponent(JSON.stringify(info))}"; }\n`

  const extra = cfg.css === undefined ? [] : [cfg.css].flat()
  for (const file of extra) css += readCss(path.resolve(deckDir, file), files, warnings)
  if (cfg.tokens) css += tokenRule(cfg.tokens, warnings)
  return { css, files, warnings, components }
}
