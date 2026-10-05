// Formeln mit KaTeX: `$…$` (im Satz), `$$…$$` (eigener Block) und ```math.
//
// Zweistufig, weil Markdown LaTeX zerstört (`\,` `\{` `\\` sind dort Escape-Folgen):
// 1. `protectMath` ersetzt die Formeln VOR dem Parsen durch einen Platzhalter (`<span class="hm-math" data-tex="…">`),
//    die Zeilenzahl bleibt gleich (Editor-Sync).
// 2. `renderMath` setzt die Platzhalter im fertigen HTML mit KaTeX (Node, nicht im Browser).
// Läuft im Kern ohne DOM. CSS und Schriften liegen in src/runtime/katex.css (scripts/katex-assets.ts).

import katex from 'katex'

const FENCE = /^\s{0,3}(`{3,}|~{3,})/
const HEADING = /^\s{0,3}#{1,6}(\s|$)/

/** Platzhalter für eine Formel; `extraLines` hält die Zeilenzahl des Quelltextes stabil */
function placeholder(tex: string, display: boolean, extraLines: number): string {
  return `<span class="hm-math" data-tex="${encodeURIComponent(tex)}"${display ? ' data-display' : ''}${'\ndata-n'.repeat(extraLines)}></span>`
}

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c)
const isDigit = (c: string | undefined) => c !== undefined && /\d/.test(c)

/**
 * Formeln im Markdown durch Platzhalter ersetzen. Codeblöcke, Inline-Code, Überschriften und `\$` bleiben unberührt.
 * Regeln wie bei Pandoc: das öffnende `$` hat rechts, das schließende links kein Leerzeichen, nach dem schließenden folgt keine Ziffer
 * („kostet $5 und $6“ ist also keine Formel).
 */
export function protectMath(markdown: string): string {
  if (!markdown.includes('$')) return markdown
  const lines = markdown.split(/\r?\n/)
  const out: string[] = []
  let fence: string | null = null

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const f = line.match(FENCE)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null
      out.push(line)
      continue
    }
    if (f) { fence = f[1]; out.push(line); continue }
    if (!line.includes('$') || HEADING.test(line)) { out.push(line); continue }

    let result = ''
    let i = 0
    while (i < line.length) {
      const c = line[i]
      if (c === '\\') { result += line.slice(i, i + 2); i += 2; continue }
      if (c === '`') {
        // Inline-Code überspringen (gleich lange Backtick-Folge schließt)
        const run = line.slice(i).match(/^`+/)![0]
        const end = line.indexOf(run, i + run.length)
        if (end === -1) { result += run; i += run.length; continue }
        result += line.slice(i, end + run.length)
        i = end + run.length
        continue
      }
      if (c !== '$') { result += c; i++; continue }

      // $$ … $$ (auch über mehrere Zeilen)
      if (line[i + 1] === '$') {
        const sameLine = line.indexOf('$$', i + 2)
        if (sameLine !== -1) {
          result += placeholder(line.slice(i + 2, sameLine), true, 0)
          i = sameLine + 2
          continue
        }
        // Block über mehrere Zeilen: Schluss in einer der folgenden Zeilen (nicht über Leerzeile/Codeblock hinweg)
        let body = line.slice(i + 2)
        let end = -1
        let endCol = 0
        for (let j = li + 1; j < lines.length && j <= li + 60; j++) {
          if (FENCE.test(lines[j])) break
          const k = lines[j].indexOf('$$')
          if (k !== -1) { end = j; endCol = k; body += '\n' + lines[j].slice(0, k); break }
          body += '\n' + lines[j]
        }
        if (end === -1) { result += '$$'; i += 2; continue }
        result += placeholder(body, true, end - li) + lines[end].slice(endCol + 2)
        li = end
        i = line.length
        continue
      }

      // $ … $ im Satz
      if (isSpace(line[i + 1])) { result += c; i++; continue }
      let close = -1
      for (let j = i + 1; j < line.length; j++) {
        if (line[j] === '\\') { j++; continue }
        if (line[j] === '$' && !isSpace(line[j - 1]) && !isDigit(line[j + 1])) { close = j; break }
      }
      if (close === -1) { result += c; i++; continue }
      result += placeholder(line.slice(i + 1, close), false, 0)
      i = close + 1
    }
    out.push(result)
  }
  return out.join('\n')
}

export interface MathOptions {
  /** Meldung für `hashmark check` (Formel mit Fehler) */
  warn?: (message: string) => void
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Eine Formel setzen. HTML plus MathML (Screenreader), `\htmlData{step=2}{…}` blendet Teile schrittweise ein.
 * Bei Fehlern bleibt der LaTeX-Text rot sichtbar stehen und `warn` meldet die Ursache.
 */
export function renderTex(tex: string, display: boolean, options: MathOptions = {}): string {
  const source = tex.trim()
  if (!source) {
    options.warn?.('leere Formel')
    return '<span class="math-error">(leere Formel)</span>'
  }
  try {
    return katex.renderToString(source, {
      displayMode: display,
      throwOnError: true,
      output: 'htmlAndMathml',
      strict: 'ignore',
      // nur Klassen/Daten an Teilformeln (für Schritte), keine Links oder Bilder
      trust: (c: { command: string }) => c.command === '\\htmlData' || c.command === '\\htmlClass',
      macros: {},
    })
  } catch (e) {
    const message = (e as Error).message.replace(/^KaTeX parse error: /, '')
    options.warn?.(`Formel „${source.length > 40 ? source.slice(0, 40) + '…' : source}“: ${message}`)
    return `<span class="math-error" title="${esc(message)}">${esc(source)}</span>`
  }
}

const PLACEHOLDER = /<span class="hm-math" data-tex="([^"]*)"((?:\s+data-[a-z]+)*)\s*><\/span>/g

/** Platzhalter im fertigen HTML durch gesetzte Formeln ersetzen */
export function renderMath(html: string, options: MathOptions = {}): string {
  if (!html.includes('hm-math')) return html
  return html.replace(PLACEHOLDER, (_m, enc: string, flags: string) => {
    let tex = ''
    try { tex = decodeURIComponent(enc) } catch { tex = enc }
    return renderTex(tex, /data-display/.test(flags), options)
  })
}
