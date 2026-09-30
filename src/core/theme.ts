// Theme v2: Basis-Theme (eingebaut, Datei oder Ordner) + Layout-CSS + Zusatz-CSS + Token-Overrides → ein CSS-Text.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IMAGE_MIME } from './render.ts'
import type { ThemeConfig } from './types.ts'

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
}

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

export function resolveTheme(deckDir: string, theme: string | ThemeConfig | undefined): ResolvedTheme {
  const files: string[] = []
  const warnings: string[] = []
  const cfg: ThemeConfig = typeof theme === 'object' && theme !== null ? theme : { extends: theme }
  let css = readBase(deckDir, cfg.extends ?? DEFAULT_THEME, files, warnings)

  const dirs = cfg.layouts === undefined ? [] : [cfg.layouts].flat()
  for (const dir of dirs) css += readCssDir(path.resolve(deckDir, dir), files, warnings)
  const extra = cfg.css === undefined ? [] : [cfg.css].flat()
  for (const file of extra) css += readCss(path.resolve(deckDir, file), files, warnings)
  if (cfg.tokens) css += tokenRule(cfg.tokens, warnings)
  return { css, files, warnings }
}
