// Komponenten: logikfreie HTML-Vorlagen für eigene Container (`::: timeline` → components/timeline.html).
// Die Vorlage kennt Platzhalter, `each` und `if`, aber keine Ausdrücke und kein JavaScript.
// Rumpf und Listenpunkte bleiben mdast und werden an die Platzhalter gesetzt, damit sie ganz normal gerendert werden
// (Bilder, Code, Mermaid, Schritte, Zeilennummern für den Editor-Sync).

import type { RootContent } from 'mdast'

type Part =
  | { t: 'text'; v: string }
  | { t: 'var'; name: string; raw: boolean; filter?: string }
  | { t: 'each'; name: string; body: Part[] }
  | { t: 'if'; name: string; yes: Part[]; no: Part[] }

export interface Template {
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

export const FILTERS = ['image'] as const

/** Vorlage lesen; wirft `TemplateError` mit Zeilennummer bei ungültiger Syntax. */
export function parseTemplate(source: string): Template {
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
      const open = body.slice(1).match(/^(each|if)\s+(\S+)$/)
      if (!open) { fail(index, `unbekannter Block {{${body}}} (erlaubt: #each name, #if name)`); continue }
      const [, kind, name] = open
      if (!NAME.test(name)) fail(index, `ungültiger Name „${name}“`)
      uses.add(name)
      const part: Part = kind === 'each' ? { t: 'each', name, body: [] } : { t: 'if', name, yes: [], no: [] }
      target.push(part)
      stack.push({ kind: kind as 'each' | 'if', part, target, line: lineAt(index) })
      target = part.t === 'each' ? part.body : (part as Extract<Part, { t: 'if' }>).yes
      continue
    }

    const [name, filter, ...extra] = body.split('|').map((s) => s.trim())
    if (!NAME.test(name)) { fail(index, `ungültiger Platzhalter „${body}“`); continue }
    if (extra.length || (filter !== undefined && !(FILTERS as readonly string[]).includes(filter))) {
      fail(index, `unbekannter Filter in „${body}“ (erlaubt: ${FILTERS.join(', ')})`)
    }
    uses.add(name)
    target.push({ t: 'var', name, raw: triple, ...(filter ? { filter } : {}) })
  }
  if (last < source.length) target.push({ t: 'text', v: source.slice(last) })
  if (stack.length) {
    const top = stack[stack.length - 1]
    throw new TemplateError(`Zeile ${top.line}: {{#${top.kind}}} wird nicht geschlossen`)
  }
  return { parts: root, uses }
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
}

function run(parts: Part[], scopes: Scope[], out: Piece[], env: Env) {
  for (const part of parts) {
    if (part.t === 'text') out.push(part.v)
    else if (part.t === 'var') {
      const v = lookup(scopes, part.name)
      if (isNodes(v)) {
        if (part.raw) out.push(structuredClone(v.nodes))
        else env.warn(`{{ ${part.name} }} ist Inhalt und braucht drei Klammern: {{{ ${part.name} }}}`)
      } else if (isList(v)) env.warn(`{{ ${part.name} }} ist eine Liste, benutze {{#each ${part.name}}}`)
      else if (v !== undefined && v !== false) {
        const text = v === true ? 'true' : v
        out.push(escape(part.filter === 'image' && text ? env.image(text) : text))
      }
    } else if (part.t === 'if') run(truthy(lookup(scopes, part.name)) ? part.yes : part.no, scopes, out, env)
    else {
      const v = lookup(scopes, part.name)
      if (v !== undefined && !isList(v)) env.warn(`{{#each ${part.name}}}: nur Listen (items) lassen sich durchlaufen`)
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

/**
 * Container-Inhalt durch die Vorlage ersetzen. Listenpunkte der obersten Ebene sind `items`
 * (nur wenn die Vorlage `items` liest, sonst gehören sie zum Rumpf `body`).
 * Ergibt mdast-Knoten: rohes HTML der Vorlage, dazwischen die Original-Knoten des Autors.
 */
export function expandComponent(template: Template, input: ComponentInput, env: Env): RootContent[] {
  // ein Attribut ohne Wert (`::: timeline vertical`) kommt als leerer Text an und gilt als gesetzt
  const attrs = Object.fromEntries(Object.entries(input.attrs).map(([k, v]) => [k, v === "" ? "true" : v]))
  const usesItems = template.uses.has('items')
  const body: Mdast[] = []
  const items: Mdast[] = []
  for (const child of input.children as Mdast[]) {
    if (usesItems && child.type === 'list') items.push(...(child.children ?? []))
    else body.push(child)
  }
  if (body.length && !template.uses.has('body')) env.warn(`::: ${input.name}: Inhalt wird von der Vorlage nicht verwendet (kein {{{ body }}})`)

  const steps = truthy(attrs.steps)
  const start = /^\d+$/.test(attrs.start ?? '') ? Number(attrs.start) : 1
  const scope: Scope = {
    ...attrs,
    body: { nodes: body },
    count: String(items.length),
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
