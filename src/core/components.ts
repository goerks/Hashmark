// Komponenten: HTML-Vorlagen für eigene Container (`::: timeline` → components/timeline.html).
// Die Vorlage kennt Platzhalter, `each`, `if` und fertige Funktionen (`{{ value | percent:max }}`, functions.ts),
// aber keine freien Ausdrücke und kein JavaScript.
// Rumpf und Listenpunkte bleiben mdast und werden an die Platzhalter gesetzt, damit sie ganz normal gerendert werden
// (Bilder, Code, Mermaid, Schritte, Zeilennummern für den Editor-Sync).

import YAML from 'yaml'
import type { RootContent } from 'mdast'
import { nearest } from './vocab.ts'
import { FnError, FUNCTIONS, parseCall, parseNumber, runCalls, splitOutside, type FnCall, type FnInput } from './functions.ts'

/** Vergleich in `{{#if trend is up}}`: rechts steht immer ein Literal (Text oder Zahl) */
export type Compare = { op: 'is' | 'is not' | '>' | '>=' | '<' | '<='; value: string }

type Part =
  | { t: 'text'; v: string }
  | { t: 'var'; name: string; raw: boolean; calls: FnCall[] }
  | { t: 'each'; name: string; body: Part[] }
  | { t: 'if'; name: string; compare?: Compare; yes: Part[]; no: Part[] }

/** Beschreibung einer Komponente (Kopf `{{!meta … }}` in der Vorlage, YAML): für Editor-Vorschläge und Hinweise */
export interface ComponentMeta {
  description?: string
  /** Attribute mit Wert: Name → Beschreibung */
  attrs?: Record<string, string>
  /** Flags ohne Wert: Name → Beschreibung */
  flags?: Record<string, string>
  required?: string[]
  /** Standardwerte für Attribute, die der Autor weglässt: Name → Wert */
  defaults?: Record<string, string>
  /** Beispiel, das der Editor einfügt */
  example?: string
  /** erlaubte Kind-Container (`{{#each children}}`) mit eigener Beschreibung */
  children?: Record<string, ComponentMeta>
}

export interface Template {
  meta?: ComponentMeta
  parts: Part[]
  /** alle Namen, die die Vorlage liest (für Hinweise wie „Inhalt wird nicht verwendet“) */
  uses: Set<string>
}

/** Fehler in einer Vorlage, mit Zeile */
export class TemplateError extends Error {}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TAG = /\{\{\{\s*([^{}]*?)\s*\}\}\}|\{\{\s*([^{}]*?)\s*\}\}/g
const NAME = /^[\w.-]+$/

const META = /^\s*\{\{!meta[ \t]*\r?\n([^]*?)\}\}[ \t]*\r?\n?/

function textMap(v: unknown, where: string): Record<string, string> | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'object' || Array.isArray(v)) throw new TemplateError(`Metadaten: ${where} muss eine Liste „name: Beschreibung“ sein`)
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, d]) => [k, String(d ?? '')]))
}

function metaFrom(raw: unknown): ComponentMeta {
  if (raw === null || raw === undefined) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new TemplateError('Metadaten müssen ein YAML-Objekt sein')
  const m = raw as Record<string, unknown>
  const meta: ComponentMeta = {}
  if (m.description !== undefined) meta.description = String(m.description).trim()
  if (m.example !== undefined) meta.example = String(m.example).replace(/\s+$/, '') + '\n'
  const attrs = textMap(m.attrs, 'attrs')
  if (attrs) meta.attrs = attrs
  const flags = textMap(m.flags, 'flags')
  if (flags) meta.flags = flags
  if (m.required !== undefined) meta.required = [m.required].flat().map(String)
  const defaults = textMap(m.defaults, 'defaults')
  if (defaults) meta.defaults = defaults
  if (m.children !== undefined) {
    if (typeof m.children !== 'object' || m.children === null || Array.isArray(m.children)) throw new TemplateError('Metadaten: children muss „name: { … }“ enthalten')
    meta.children = Object.fromEntries(Object.entries(m.children as Record<string, unknown>).map(([k, v]) => [k, metaFrom(v)]))
  }
  return meta
}

/** Nur den Kopf `{{!meta … }}` lesen, ohne Fehler zu werfen (für Vorschläge im Editor, auch bei halbfertiger Vorlage). */
export function readMetaHead(full: string): ComponentMeta | undefined {
  const head = full.match(META)
  if (!head) return undefined
  try { return metaFrom(YAML.parse(head[1])) } catch { return undefined }
}

/** Vorlage lesen; wirft `TemplateError` mit Zeilennummer bei ungültiger Syntax. */
export function parseTemplate(full: string): Template {
  let meta: ComponentMeta | undefined
  let source = full
  const head = full.match(META)
  if (head) {
    try { meta = metaFrom(YAML.parse(head[1])) } catch (e) {
      if (e instanceof TemplateError) throw e
      throw new TemplateError(`Metadaten sind kein gültiges YAML: ${(e as Error).message.split('\n')[0]}`)
    }
    // Zeilen des Kopfs behalten, damit Fehlermeldungen die Zeile der Datei nennen
    source = '\n'.repeat(head[0].split('\n').length - 1) + full.slice(head[0].length)
  }
  const uses = new Set<string>()
  const root: Part[] = []
  // Stapel offener Blöcke: wohin neue Teile geschrieben werden
  const stack: { kind: 'each' | 'if'; part: Part; target: Part[]; line: number }[] = []
  let target = root
  let last = 0
  const lineAt = (index: number) => source.slice(0, index).split('\n').length
  const fail = (index: number, message: string): never => { throw new TemplateError(`Zeile ${lineAt(index)}: ${message}`) }

  for (const m of source.matchAll(TAG)) {
    const index = m.index ?? 0
    if (index > last) target.push({ t: 'text', v: source.slice(last, index) })
    last = index + m[0].length
    const triple = m[1] !== undefined
    const body = (triple ? m[1] : m[2]).trim()

    if (body.startsWith('!')) continue
    if (!triple && (body.startsWith('#') || body.startsWith('/') || body === 'else')) {
      if (body === 'else') {
        const top = stack[stack.length - 1]
        if (!top || top.kind !== 'if') fail(index, '{{else}} gehört in einen {{#if}}-Block')
        target = (top.part as Extract<Part, { t: 'if' }>).no
        continue
      }
      if (body.startsWith('/')) {
        const kind = body.slice(1).trim()
        const top = stack.pop()
        if (!top) fail(index, `{{${body}}} ohne öffnendes {{#${kind}}}`)
        else if (top.kind !== kind) fail(index, `{{${body}}} passt nicht zu {{#${top.kind}}} aus Zeile ${top.line}`)
        target = top!.target
        continue
      }
      const open = body.slice(1).match(/^(each|if)\s+(\S+)(?:\s+(is not|is|>=|<=|>|<)\s+([^]+))?$/)
      if (!open) { fail(index, `unbekannter Block {{${body}}} (erlaubt: #each name, #if name, #if name is wert)`); continue }
      const [, kind, name, op, rhs] = open
      if (!NAME.test(name)) fail(index, `ungültiger Name „${name}“`)
      if (op && kind === 'each') fail(index, '{{#each}} kennt keinen Vergleich')
      let compare: Compare | undefined
      if (op) {
        const value = /^(["'])([^]*)\1$/.test(rhs) ? rhs.slice(1, -1) : rhs.trim()
        if (op.length <= 2 && op !== 'is' && parseNumber(value) === null) fail(index, `{{#if ${name} ${op} …}} vergleicht Zahlen, „${value}“ ist keine`)
        compare = { op: op as Compare['op'], value }
      }
      uses.add(name)
      const part: Part = kind === 'each' ? { t: 'each', name, body: [] } : { t: 'if', name, ...(compare ? { compare } : {}), yes: [], no: [] }
      target.push(part)
      stack.push({ kind: kind as 'each' | 'if', part, target, line: lineAt(index) })
      target = part.t === 'each' ? part.body : (part as Extract<Part, { t: 'if' }>).yes
      continue
    }

    const [name, ...calls] = splitOutside(body, '|')
    if (!NAME.test(name)) { fail(index, `ungültiger Platzhalter „${body}“`); continue }
    if (triple && calls.length) { fail(index, `Inhalt mit drei Klammern nimmt keine Funktionen: {{{ ${name} }}}`); continue }
    const parsed: FnCall[] = []
    for (const call of calls) {
      try { parsed.push(parseCall(call)) } catch (e) {
        if (!(e instanceof FnError)) throw e
        fail(index, `${e.message} in „${body}“`)
      }
    }
    for (const call of parsed) call.args.forEach((a, i) => {
      if (a.kind !== 'name') return
      if (!NAME.test(a.name)) fail(index, `ungültiges Argument „${a.name}“ in „${body}“ (Text gehört in Anführungszeichen)`)
      // Feldnamen (sum:value) gehören der Liste, nur Werte werden im Gültigkeitsbereich gesucht
      if (FUNCTIONS[call.name].args[i].kind === 'value') uses.add(a.name)
    })
    uses.add(name)
    target.push({ t: 'var', name, raw: triple, calls: parsed })
  }
  if (last < source.length) target.push({ t: 'text', v: source.slice(last) })
  if (stack.length) {
    const top = stack[stack.length - 1]
    throw new TemplateError(`Zeile ${top.line}: {{#${top.kind}}} wird nicht geschlossen`)
  }
  return { ...(meta ? { meta } : {}), parts: root, uses }
}

// ---------- Ausführen ----------

type Value = string | boolean | { nodes: RootContent[] } | { list: Scope[] }
type Scope = Record<string, Value>
type Piece = string | RootContent[]

const isNodes = (v: Value | undefined): v is { nodes: RootContent[] } => typeof v === 'object' && v !== null && 'nodes' in v
const isList = (v: Value | undefined): v is { list: Scope[] } => typeof v === 'object' && v !== null && 'list' in v

function truthy(v: Value | undefined): boolean {
  if (v === undefined) return false
  if (typeof v === 'string') return !['', 'false', 'off', 'no', '0'].includes(v.toLowerCase())
  if (typeof v === 'boolean') return v
  return isNodes(v) ? v.nodes.length > 0 : v.list.length > 0
}

const lookup = (scopes: Scope[], name: string): Value | undefined => {
  for (let i = scopes.length - 1; i >= 0; i--) if (name in scopes[i]) return scopes[i][name]
  return undefined
}

interface Env {
  image: (url: string) => string
  warn: (message: string) => void
  /** Sprache für Zahlen und Datum (`number`, `date`), Standard `de` */
  locale?: string
}

/** Vergleich in `{{#if name is wert}}`: Zahlen werden als Zahlen verglichen, `is` sonst als Text ohne Beachtung der Schreibweise */
function compares(v: Value | undefined, c: Compare): boolean {
  const left = typeof v === 'string' ? v.trim() : v === true ? 'true' : ''
  if (c.op === 'is' || c.op === 'is not') {
    const a = parseNumber(left), b = parseNumber(c.value)
    const same = a !== null && b !== null ? a === b : left.toLowerCase() === c.value.trim().toLowerCase()
    return c.op === 'is' ? same : !same
  }
  const a = parseNumber(left), b = parseNumber(c.value)
  if (a === null || b === null) return false
  return c.op === '>' ? a > b : c.op === '>=' ? a >= b : c.op === '<' ? a < b : a <= b
}

function run(parts: Part[], scopes: Scope[], out: Piece[], env: Env) {
  const ctx = { locale: env.locale ?? 'de', image: env.image, warn: env.warn }
  for (const part of parts) {
    if (part.t === 'text') out.push(part.v)
    else if (part.t === 'var') {
      const v = lookup(scopes, part.name)
      if (part.calls.length) {
        // Funktionen: Liste (children, items) nur für sum/max/min, sonst Text; fehlender Wert zählt als leer
        let input: FnInput
        if (isList(v)) input = { list: v.list }
        else if (isNodes(v)) { env.warn(`{{ ${part.name} | … }}: Inhalt (body) nimmt keine Funktionen`); continue }
        else input = v === undefined || v === false ? '' : v === true ? 'true' : v
        const resolve = (name: string) => { const r = lookup(scopes, name); return typeof r === 'string' ? r : r === true ? 'true' : undefined }
        try { out.push(escape(runCalls(input, part.calls, resolve, ctx))) } catch (e) {
          if (!(e instanceof FnError)) throw e
          env.warn(`{{ ${part.name} | … }}: ${e.message}`)
        }
      } else if (isNodes(v)) {
        if (part.raw) out.push(structuredClone(v.nodes))
        else env.warn(`{{ ${part.name} }} ist Inhalt und braucht drei Klammern: {{{ ${part.name} }}}`)
      } else if (isList(v)) env.warn(`{{ ${part.name} }} ist eine Liste, benutze {{#each ${part.name}}}`)
      else if (v !== undefined && v !== false) out.push(escape(v === true ? 'true' : v))
    } else if (part.t === 'if') {
      const v = lookup(scopes, part.name)
      run((part.compare ? compares(v, part.compare) : truthy(v)) ? part.yes : part.no, scopes, out, env)
    } else {
      const v = lookup(scopes, part.name)
      if (v !== undefined && !isList(v)) env.warn(`{{#each ${part.name}}}: nur Listen (items, children) lassen sich durchlaufen`)
      if (isList(v)) for (const item of v.list) run(part.body, [...scopes, item], out, env)
    }
  }
}

type Mdast = RootContent & { children?: Mdast[]; value?: string }

function plainText(node: Mdast): string {
  if (typeof node.value === 'string') return node.value
  return (node.children ?? []).map(plainText).join(node.type === 'paragraph' || node.type === 'listItem' ? '' : ' ')
}

export interface ComponentInput {
  name: string
  attrs: Record<string, string>
  children: RootContent[]
}

/** Attribute ohne Wert (`::: timeline vertical`) kommen als leerer Text an und gelten als gesetzt */
const withFlags = (attrs: Record<string, string>) => Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, v === '' ? 'true' : v]))

/** Immer erlaubt, auch wenn die Vorlage sie nicht nennt: gelten für jeden Container */
const COMMON_ATTRS = ['class', 'id', 'step', 'until']

/** Attribute gegen den Kopf der Vorlage prüfen (nur wenn dort `attrs`/`flags` stehen) */
function checkAttrs(label: string, attrs: Record<string, string>, meta: ComponentMeta | undefined, warn: (m: string) => void) {
  if (!meta) return
  const known = [...Object.keys(meta.attrs ?? {}), ...Object.keys(meta.flags ?? {})]
  if (known.length) {
    for (const key of Object.keys(attrs)) {
      if (known.includes(key) || COMMON_ATTRS.includes(key)) continue
      const fix = nearest(key, known)
      warn(`${label}: Attribut „${key}“ ist unbekannt${fix ? ` (meintest du „${fix}“?)` : ` (bekannt: ${known.join(', ')})`}`)
    }
  }
  for (const key of meta.required ?? []) if (!attrs[key] && !meta.defaults?.[key]) warn(`${label}: Attribut „${key}“ fehlt`)
}

/**
 * Container-Inhalt durch die Vorlage ersetzen. Listenpunkte der obersten Ebene sind `items` und Kind-Container
 * sind `children`, jeweils nur wenn die Vorlage sie liest (sonst gehören sie zum Rumpf `body`).
 * Ergibt mdast-Knoten: rohes HTML der Vorlage, dazwischen die Original-Knoten des Autors.
 */
export function expandComponent(template: Template, input: ComponentInput, env: Env): RootContent[] {
  const authored = withFlags(input.attrs)
  checkAttrs(`::: ${input.name}`, authored, template.meta, env.warn)
  // Standardwerte aus dem Kopf gelten nur für Attribute, die der Autor weglässt
  const attrs = { ...template.meta?.defaults, ...authored }
  const usesItems = template.uses.has('items')
  const usesChildren = template.uses.has('children')
  const body: Mdast[] = []
  const items: Mdast[] = []
  const kids: (Mdast & { name?: string; attributes?: Record<string, string> })[] = []
  for (const child of input.children as Mdast[]) {
    if (usesItems && child.type === 'list') items.push(...(child.children ?? []))
    else if (usesChildren && child.type === 'containerDirective') kids.push(child)
    else body.push(child)
  }
  if (body.length && !template.uses.has('body')) env.warn(`::: ${input.name}: Inhalt wird von der Vorlage nicht verwendet (kein {{{ body }}})`)

  const steps = truthy(attrs.steps)
  const start = /^\d+$/.test(attrs.start ?? '') ? Number(attrs.start) : 1
  const known = Object.keys(template.meta?.children ?? {})
  const scope: Scope = {
    ...attrs,
    body: { nodes: body },
    count: String(usesChildren ? kids.length : items.length),
    items: {
      list: items.map((item, i): Scope => ({
        html: { nodes: item.children ?? [] },
        text: plainText(item).trim(),
        index: String(i),
        number: String(i + 1),
        first: i === 0,
        last: i === items.length - 1,
        step: steps ? String(start + i) : '',
      })),
    },
    children: {
      list: kids.map((kid, i): Scope => {
        const authoredKid = withFlags(kid.attributes ?? {})
        const name = kid.name ?? ''
        const own = { ...template.meta?.children?.[name]?.defaults, ...authoredKid }
        if (known.length && !known.includes(name)) env.warn(`::: ${input.name}: „${name}“ ist hier unbekannt (erlaubt: ${known.join(', ')})`)
        else checkAttrs(`::: ${input.name} › ${name}`, authoredKid, template.meta?.children?.[name], env.warn)
        return {
          ...own,
          kind: name,
          body: { nodes: (kid.children ?? []) as RootContent[] },
          index: String(i),
          number: String(i + 1),
          first: i === 0,
          last: i === kids.length - 1,
          // ein eigenes `step=` am Kind gewinnt, sonst zählt `steps` am Container
          step: /^\d+$/.test(own.step ?? '') ? own.step : steps ? String(start + i) : '',
        }
      }),
    },
  }
  const pieces: Piece[] = []
  run(template.parts, [scope], pieces, env)

  const out: RootContent[] = []
  let text = ''
  const flush = () => { if (text) { out.push({ type: 'html', value: text } as RootContent); text = '' } }
  for (const piece of pieces) {
    if (typeof piece === 'string') text += piece
    else { flush(); out.push(...piece) }
  }
  flush()
  return out
}
