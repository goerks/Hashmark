// Funktionsbausteine für Komponenten-Vorlagen: `{{ value | percent:max }}`, `{{ children | sum:value | number }}`.
// Fertige, reine Funktionen auf Text, ohne Skripte. Sie laufen beim Bauen des Decks und liefern Text,
// darum sehen PDF, PPTX und Handout genauso aus wie die Präsentation.

/** Argument eines Funktionsaufrufs: Text/Zahl in Anführungszeichen oder ein Name, der im Gültigkeitsbereich gesucht wird */
export type FnArg = { kind: 'literal'; value: string } | { kind: 'name'; name: string }

export interface FnCall {
  name: string
  args: FnArg[]
}

/** Eingabe einer Funktion: Text oder eine Liste (children, items) aus Einträgen mit Textwerten */
export type FnInput = string | { list: Record<string, unknown>[] }

export interface FnContext {
  /** Sprache für Zahlen und Datum, z. B. `de` oder `en` */
  locale: string
  image: (url: string) => string
  warn: (message: string) => void
}

type ArgKind = 'value' | 'field' | 'word'

export interface FnSpec {
  /** Kurzbeschreibung für den Editor */
  detail: string
  /**
   * Argumente: `value` wird aufgelöst (Name im Gültigkeitsbereich oder Literal), `field` ist ein Feldname einer Liste,
   * `word` ist ein festes Stichwort wie `long` (nur aus `choices`)
   */
  args: { kind: ArgKind; optional?: boolean; choices?: readonly string[] }[]
  /** nimmt eine Liste (children, items) statt Text */
  list?: boolean
  run: (input: FnInput, args: string[], ctx: FnContext) => string
}

export class FnError extends Error {}

const isList = (v: FnInput): v is { list: Record<string, unknown>[] } => typeof v === 'object'
const text = (v: FnInput): string => (isList(v) ? '' : v)

/**
 * Zahl lesen: „1234.5“, „1,5“, „72 %“, „1.234,5“, „1,234.5“.
 * Nur ein Komma gilt als Dezimalkomma. Kommen beide Zeichen vor, ist das letzte das Dezimalzeichen.
 */
export function parseNumber(s: string): number | null {
  let t = s.trim().replace(/\s|%/g, '').replace(/^\+/, '')
  if (!t || !/^-?[\d.,]+$/.test(t)) return null
  const comma = t.lastIndexOf(',')
  const dot = t.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) t = comma > dot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (comma >= 0) t = t.replace(/,/g, '.')
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Kaufmännisch runden, ohne dass 72,55 wegen der Gleitkomma-Darstellung zu 72,5 wird */
const roundTo = (n: number, places: number): number => Number(Math.round(Number(`${n}e${places}`)) + `e-${places}`)

/** Zahl als Text ohne Gleitkomma-Rauschen, mit Punkt als Dezimalzeichen */
const plain = (n: number): string => String(Number(n.toFixed(10)))

function number(s: string, fn: string, ctx: FnContext): number | null {
  const n = parseNumber(s)
  if (n === null && s.trim() !== '') ctx.warn(`${fn}: „${s}“ ist keine Zahl`)
  return n
}

function listNumbers(input: FnInput, field: string, fn: string, ctx: FnContext): number[] {
  if (!isList(input)) return []
  const out: number[] = []
  for (const entry of input.list) {
    const raw = entry[field]
    if (typeof raw !== 'string') continue
    const n = number(raw, `${fn}:${field}`, ctx)
    if (n !== null) out.push(n)
  }
  return out
}

function formatDate(s: string, style: string, locale: string, ctx: FnContext): string {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) { if (s.trim()) ctx.warn(`date: „${s}“ ist kein Datum (erwartet JJJJ-MM-TT)`); return s }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    ctx.warn(`date: „${s}“ ist kein gültiges Datum`)
    return s
  }
  if (style === 'iso') return s.trim()
  const options: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    month: { month: 'long', year: 'numeric' },
  }
  return new Intl.DateTimeFormat(locale, { ...options[style], timeZone: 'UTC' }).format(d)
}

const decimals = (s: string | undefined, fn: string): number => {
  if (s === undefined || s === '') return 0
  const n = Number(s)
  if (!Number.isInteger(n) || n < 0 || n > 10) throw new FnError(`${fn}: Nachkommastellen müssen eine ganze Zahl von 0 bis 10 sein, nicht „${s}“`)
  return n
}

export const DATE_STYLES = ['short', 'medium', 'long', 'month', 'iso'] as const

/** Der Werkzeugkasten. Namen englisch, Reihenfolge wie im Editor und im Handbuch. */
export const FUNCTIONS: Record<string, FnSpec> = {
  default: {
    detail: 'Ersatzwert, wenn leer: default:"–"',
    args: [{ kind: 'value' }],
    run: (v, [fallback]) => (text(v).trim() === '' ? fallback : text(v)),
  },
  upper: { detail: 'GROSSBUCHSTABEN', args: [], run: (v, _a, c) => text(v).toLocaleUpperCase(c.locale) },
  lower: { detail: 'kleinbuchstaben', args: [], run: (v, _a, c) => text(v).toLocaleLowerCase(c.locale) },
  truncate: {
    detail: 'auf n Zeichen kürzen: truncate:40',
    args: [{ kind: 'value' }],
    run: (v, [n]) => {
      const max = Number(n)
      if (!Number.isInteger(max) || max < 1) throw new FnError(`truncate: Länge muss eine ganze Zahl ab 1 sein, nicht „${n}“`)
      const chars = [...text(v)]
      return chars.length <= max ? text(v) : chars.slice(0, Math.max(1, max - 1)).join('').trimEnd() + '…'
    },
  },
  number: {
    detail: 'Zahl formatieren: number:1 (Nachkommastellen), number:1:"en" (Sprache)',
    args: [{ kind: 'value', optional: true }, { kind: 'value', optional: true }],
    run: (v, [places, locale], c) => {
      const n = number(text(v), 'number', c)
      if (n === null) return text(v)
      const d = decimals(places, 'number')
      return new Intl.NumberFormat(locale || c.locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)
    },
  },
  percent: {
    detail: 'Anteil in %: percent:max rechnet Wert ÷ max, percent:100:1 mit einer Nachkommastelle',
    args: [{ kind: 'value', optional: true }, { kind: 'value', optional: true }],
    run: (v, [total, places], c) => {
      const n = number(text(v), 'percent', c)
      if (n === null) return text(v)
      let share = n
      if (total !== undefined && total !== '') {
        const t = number(total, 'percent', c)
        if (t === null) return text(v)
        if (t === 0) { c.warn('percent: Gesamtwert ist 0'); return '0%' }
        share = (n / t) * 100
      }
      // mit Punkt als Dezimalzeichen, damit das Ergebnis auch in `width:` und `--var` taugt
      return plain(roundTo(share, decimals(places, 'percent'))) + '%'
    },
  },
  date: {
    detail: `Datum (JJJJ-MM-TT) formatieren: date:long, date:short:"en" (${DATE_STYLES.join(', ')})`,
    args: [{ kind: 'word', optional: true, choices: DATE_STYLES }, { kind: 'value', optional: true }],
    run: (v, [style, locale], c) => formatDate(text(v), style || 'long', locale || c.locale, c),
  },
  sum: {
    detail: 'Summe über children oder items: children | sum:value',
    args: [{ kind: 'field' }],
    list: true,
    run: (v, [field], c) => plain(listNumbers(v, field, 'sum', c).reduce((a, b) => a + b, 0)),
  },
  max: {
    detail: 'größter Wert: children | max:value',
    args: [{ kind: 'field' }],
    list: true,
    run: (v, [field], c) => { const n = listNumbers(v, field, 'max', c); return n.length ? plain(Math.max(...n)) : '' },
  },
  min: {
    detail: 'kleinster Wert: children | min:value',
    args: [{ kind: 'field' }],
    list: true,
    run: (v, [field], c) => { const n = listNumbers(v, field, 'min', c); return n.length ? plain(Math.min(...n)) : '' },
  },
  image: {
    detail: 'Bildpfad im Deck auflösen',
    args: [],
    run: (v, _a, c) => (text(v) ? c.image(text(v)) : ''),
  },
}

export const FUNCTION_NAMES = Object.keys(FUNCTIONS)

// ---------- Schreibweise lesen ----------

/** An `sep` trennen, aber nicht innerhalb von Anführungszeichen */
export function splitOutside(s: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote = ''
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = '' }
    else if (ch === '"' || ch === "'") { cur += ch; quote = ch }
    else if (ch === sep) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map((p) => p.trim())
}

/** `"text"`, `'text'` oder eine Zahl sind Literale, alles andere ein Name */
export function parseArg(raw: string): FnArg {
  const q = raw.match(/^(["'])([^]*)\1$/)
  if (q) return { kind: 'literal', value: q[2] }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { kind: 'literal', value: raw }
  return { kind: 'name', name: raw }
}

/** `percent:max:1` → Aufruf mit Prüfung von Name und Argumentzahl (wirft FnError ohne Zeile) */
export function parseCall(source: string): FnCall {
  const [name, ...rest] = splitOutside(source, ':')
  const spec = Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : undefined
  if (!spec) throw new FnError(`unbekannte Funktion „${name}“ (erlaubt: ${FUNCTION_NAMES.join(', ')})`)
  const required = spec.args.filter((a) => !a.optional).length
  if (rest.length < required || rest.length > spec.args.length) {
    const count = required === spec.args.length ? String(required) : `${required} bis ${spec.args.length}`
    throw new FnError(`„${name}“ braucht ${count} Argument${spec.args.length === 1 && required === 1 ? '' : 'e'}, nicht ${rest.length}`)
  }
  const args = rest.map((raw, i) => {
    if (raw === '') throw new FnError(`„${name}“: leeres Argument`)
    const arg = parseArg(raw)
    const want = spec.args[i]
    if (want.kind === 'field' && arg.kind !== 'name') throw new FnError(`„${name}“: Argument ${i + 1} ist der Name eines Feldes, z. B. ${name}:value`)
    if (want.kind === 'word') {
      const word = arg.kind === 'name' ? arg.name : arg.value
      if (want.choices && !want.choices.includes(word)) throw new FnError(`„${name}“: „${word}“ ist unbekannt (erlaubt: ${want.choices.join(', ')})`)
      return { kind: 'literal', value: word } as FnArg
    }
    return arg
  })
  return { name, args }
}

/** Funktionskette auf einen Wert anwenden. Fehler in Argumenten kommen als FnError. */
export function runCalls(start: FnInput, calls: FnCall[], resolve: (name: string) => string | undefined, ctx: FnContext): string {
  let value: FnInput = start
  for (const call of calls) {
    const spec = FUNCTIONS[call.name]
    if (Boolean(spec.list) !== isList(value)) {
      if (spec.list) throw new FnError(`„${call.name}“ rechnet über eine Liste (children oder items), nicht über einen einzelnen Wert`)
      throw new FnError(`„${call.name}“ braucht einen einzelnen Wert; eine Liste lässt sich mit sum, max oder min zusammenfassen`)
    }
    const args = call.args.map((a, i) => {
      if (a.kind === 'literal') return a.value
      if (spec.args[i].kind === 'field') return a.name
      return resolve(a.name) ?? ''
    })
    value = spec.run(value, args, ctx)
  }
  return text(value)
}
