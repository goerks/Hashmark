// Linter für eine Markdown-Quelle im Editor: unbekannte Layouts/Attribute/Container, ungeschlossene Blöcke.
// Arbeitet nur auf dem Text (Zeilen und Zeichen-Offsets), damit der Editor die Stellen direkt markieren kann.

import { PLAN_STATES } from './plan.ts'
import { BUILTIN_LAYOUTS, CONTAINERS, KNOWN_ATTRS, TRANSITIONS, nearest } from './vocab.ts'

export interface Problem {
  from: number
  to: number
  /** 1-basiert */
  line: number
  severity: 'error' | 'warning'
  message: string
  /** Ersatztext für `from`–`to` (Schnellkorrektur) */
  fix?: string
}

export interface LintOptions {
  /** zusätzliche Layouts aus dem Theme des Decks */
  layouts?: string[]
  /** eigene Container (Komponenten) aus dem Theme bzw. Deck */
  components?: string[]
}

/** bare Flags ohne Wert */
const FLAGS = ['steps', 'fit', 'optional', 'appendix']
const meant = (fix?: string) => (fix ? ` Meinst du „${fix}“?` : '')

export function lintText(text: string, opts: LintOptions = {}): Problem[] {
  const layouts = [...BUILTIN_LAYOUTS, ...(opts.layouts ?? [])]
  const containers = [...CONTAINERS, ...(opts.components ?? [])]
  const problems: Problem[] = []
  const lines = text.split('\n')
  let offset = 0
  let fence: { len: number; line: number; from: number; to: number } | null = null
  const open: { name: string; line: number; from: number; to: number }[] = []

  lines.forEach((line, i) => {
    const start = offset
    offset += line.length + 1
    const at = (col: number, len: number) => ({ from: start + col, to: start + col + len, line: i + 1 })

    const fm = line.match(/^(`{3,})([\w-]*)(.*)$/)
    if (fence) {
      if (fm && fm[1].length >= fence.len && !fm[2] && !fm[3].trim()) fence = null
      return
    }
    if (fm) {
      fence = { len: fm[1].length, line: i + 1, from: start, to: start + line.length }
      return
    }

    let m = line.match(/^(#{1,6})(\s+)(.*?)(\s*)(\{([^{}]*)\})?\s*$/)
    if (m && m[5]) {
      const braceCol = line.lastIndexOf(m[5])
      const tokens = [...m[6].matchAll(/([\w-]+)=("[^"]*"|[^\s}]+)|\S+/g)]
      // wie der Parser: nur echte Attribute (key=…, .klasse, #id, steps, fit, optional, appendix) zählen, sonst ist es Titeltext
      const isAttrs = tokens.some((t) => t[1] || /^[.#]/.test(t[0])) || (tokens.length === 1 && FLAGS.includes(tokens[0][0]))
      if (isAttrs) {
        for (const t of tokens) {
          if (!t[1]) continue
          const col = braceCol + 1 + (t.index ?? 0)
          const key = t[1]
          const val = t[2].replace(/^"|"$/g, '')
          const valCol = col + key.length + 1 + (t[2].startsWith('"') ? 1 : 0)
          if (!KNOWN_ATTRS.includes(key)) {
            const fix = nearest(key, KNOWN_ATTRS)
            problems.push({ ...at(col, key.length), severity: 'warning', message: `Attribut „${key}“ ist unbekannt.${meant(fix)}`, fix })
          } else if (key === 'layout' && !layouts.includes(val)) {
            const fix = nearest(val, layouts)
            problems.push({ ...at(valCol, val.length), severity: 'error', message: `Layout „${val}“ ist unbekannt.${meant(fix)}`, fix })
          } else if (key === 'plan' && !(PLAN_STATES as readonly string[]).includes(val)) {
            const fix = nearest(val, PLAN_STATES)
            problems.push({ ...at(valCol, val.length), severity: 'error', message: `Plan „${val}“ ist unbekannt (${PLAN_STATES.join(', ')}).${meant(fix)}`, fix })
          } else if (key === 'transition' && !TRANSITIONS.includes(val)) {
            const fix = nearest(val, TRANSITIONS)
            problems.push({ ...at(valCol, val.length), severity: 'warning', message: `Übergang „${val}“ ist unbekannt (${TRANSITIONS.join(', ')}).${meant(fix)}`, fix })
          }
        }
      } else if (tokens.length === 1) {
        const fix = nearest(tokens[0][0], FLAGS)
        if (fix) problems.push({ ...at(braceCol + 1, tokens[0][0].length), severity: 'warning', message: `„{${tokens[0][0]}}“ wird als Titeltext behandelt.${meant(fix)}`, fix })
      }
      return
    }

    m = line.match(/^(:{3,})(\s*)([\w-]+)?(.*)$/)
    if (m) {
      const name = m[3]
      if (name) {
        if (!containers.includes(name)) {
          const fix = nearest(name, containers)
          problems.push({ ...at(m[1].length + m[2].length, name.length), severity: 'error', message: `Container „${name}“ ist unbekannt.${meant(fix)}`, fix })
        }
        open.push({ name, line: i + 1, from: start, to: start + line.length })
      } else if (!m[4].trim()) {
        if (open.length) open.pop()
        else problems.push({ ...at(0, line.length), severity: 'warning', message: 'Schließendes „:::“ ohne öffnenden Container.' })
      }
    }
  })

  for (const o of open) problems.push({ from: o.from, to: o.to, line: o.line, severity: 'warning', message: `Container „${o.name}“ wird nicht geschlossen (fehlendes „:::“).` })
  if (fence) problems.push({ from: fence.from, to: fence.to, line: fence.line, severity: 'warning', message: 'Codeblock wird nicht geschlossen.' })
  return problems.sort((a, b) => a.from - b.from)
}
