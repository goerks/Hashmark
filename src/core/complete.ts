// Kontext für die Autovervollständigung im Editor: aus Text und Cursorposition die passenden Vorschläge.
// Rein und ohne DOM, damit es getestet werden kann. `§` im Einfügetext markiert die Cursorposition.

import type { ComponentMeta } from './components.ts'
import { SNIPPETS } from './snippets.ts'
import {
  ATTR_INFO, BUILTIN_LAYOUTS, CALLOUTS, CODE_LANGS, CONTAINER_INFO, LAYOUT_INFO, TRANSITIONS, fold,
} from './vocab.ts'

export interface Suggestion {
  label: string
  detail: string
  /** Gruppe, als Kennzeichen in der Liste */
  kind: string
  /** Text, der den Bereich `from`–`to` ersetzt; `§` = Cursor danach */
  insert: string
  /** danach sofort den nächsten Vorschlag öffnen (z. B. nach `layout=`) */
  chain?: boolean
  /** zusätzliche Suchwörter (gefaltet) */
  keywords?: string
}

export interface Completion {
  from: number
  to: number
  title: string
  options: Suggestion[]
}

export interface CompleteOptions {
  /** Strg+Leertaste: auch dort vorschlagen, wo es beim Tippen stören würde (z. B. direkt nach `:::`) */
  explicit?: boolean
  /** zusätzliche Layouts aus dem Theme des Decks */
  layouts?: string[]
  /** eigene Container (Komponenten) aus dem Theme bzw. Deck */
  components?: Record<string, ComponentMeta>
}

/** Beschreibung einer Komponente, auch eines ihrer Kind-Container */
function findMeta(components: Record<string, ComponentMeta> | undefined, name: string): ComponentMeta | undefined {
  if (!components) return undefined
  if (components[name]) return components[name]
  for (const meta of Object.values(components)) if (meta.children?.[name]) return meta.children[name]
  return undefined
}

function pick(from: number, to: number, title: string, all: Suggestion[], query: string): Completion | null {
  const q = fold(query)
  const hits = all.filter((s) => fold(`${s.label} ${s.detail}`).includes(q) || s.keywords?.includes(q))
  if (!hits.length) return null
  hits.sort((a, b) => Number(fold(b.label).startsWith(q)) - Number(fold(a.label).startsWith(q)))
  return { from, to, title, options: hits.slice(0, 24) }
}

const bausteine = (components?: Record<string, ComponentMeta>): Suggestion[] => [
  ...SNIPPETS.map((s) => ({ label: s.label, detail: s.title, kind: s.kind, insert: s.text.replace(/^\n/, ''), keywords: fold(s.keywords ?? '') })),
  // Komponenten (eingebaute, Theme, Deck) mit ihrem Beispiel; Suchwort ist der Name, z. B. /pipeline
  ...Object.entries(components ?? {}).map(([label, meta]): Suggestion => ({
    label: label.charAt(0).toUpperCase() + label.slice(1), detail: meta.description ?? `Komponente ${label}`, kind: 'Komponente',
    insert: meta.example ?? `::: ${label}\n§\n:::\n`, keywords: fold(label),
  })),
]

export function completionAt(text: string, pos: number, opts: CompleteOptions = {}): Completion | null {
  const ls = text.lastIndexOf('\n', pos - 1) + 1
  const before = text.slice(ls, pos)
  const fences = (text.slice(0, ls).match(/^`{3,}/gm) ?? []).length
  let m: RegExpMatchArray | null

  // die Sprache eines Codeblocks darf sich dabei nicht ändern: im Block gibt es keine Vorschläge
  if (fences % 2 === 1) return null

  // /baustein am Zeilenanfang
  if ((m = before.match(/^\/([\wäöüß-]*)$/))) return pick(ls, pos, 'Bausteine', bausteine(opts.components), m[1])

  // ::: + Leertaste → Container (ein bloßes ::: schließt meist einen Block)
  if ((m = before.match(/^:{3}(\s+([\w-]*))?$/)) && (m[1] || opts.explicit)) {
    const all = Object.entries(CONTAINER_INFO).map(([label, i]): Suggestion => ({ label, detail: i.detail, kind: 'Container', insert: i.text }))
    for (const [label, meta] of Object.entries(opts.components ?? {})) {
      if (label in CONTAINER_INFO) continue
      all.push({ label, detail: meta.description ?? 'Komponente', kind: 'Komponente', insert: meta.example ?? `::: ${label}
§
:::
` })
      for (const [child, m] of Object.entries(meta.children ?? {})) {
        if (!(child in CONTAINER_INFO) && !all.some((s) => s.label === child)) all.push({ label: child, detail: m.description ?? `Teil von ${label}`, kind: 'Komponente', insert: `::: ${child}
§
:::
` })
      }
    }
    return pick(ls, pos, 'Container', all, m[2] ?? '')
  }

  // Werte eines Attributs, das die Komponente im Kopf aufzählt (`values:`): ::: stage state=ru§
  if ((m = before.match(/^:{3,}\s*([\w-]+)\s+(?:.*?\s)?([\w-]+)=([\w-]*)$/)) && (before.match(/"/g) ?? []).length % 2 === 0) {
    const allowed = findMeta(opts.components, m[1])?.values?.[m[2]]
    if (allowed) {
      const all = allowed.map((label): Suggestion => ({ label, detail: `Wert für ${m![2]}`, kind: 'Wert', insert: label }))
      return pick(pos - m[3].length, pos, `Werte für ${m[2]}`, all, m[3])
    }
  }

  // Attribute eines Containers, dessen Komponente sie im Kopf beschreibt: ::: person na§
  if ((m = before.match(/^:{3,}\s*([\w-]+)\s+(.*?)([\w-]*)$/)) && (before.match(/"/g) ?? []).length % 2 === 0) {
    const meta = findMeta(opts.components, m[1])
    const given = new Set([...m[2].matchAll(/([\w-]+)(?:=|\s|$)/g)].map((x) => x[1]))
    const all: Suggestion[] = [
      ...Object.entries(meta?.attrs ?? {}).map(([label, detail]): Suggestion => ({ label, detail, kind: 'Attribut', insert: `${label}=` })),
      ...Object.entries(meta?.flags ?? {}).map(([label, detail]): Suggestion => ({ label, detail, kind: 'Attribut', insert: label })),
    ].filter((s) => !given.has(s.label))
    if (all.length) return pick(ls + before.length - m[3].length, pos, 'Attribute', all, m[3])
  }

  // ```sprache beim Öffnen eines Blocks
  if ((m = before.match(/^`{3}([\w-]*)$/)) && (m[1] || opts.explicit)) {
    const all = CODE_LANGS.map(([label, detail]): Suggestion => ({ label, detail, kind: 'Sprache', insert: '```' + label + '\n§\n```\n' }))
    all.splice(1, 0, { label: 'ts {steps}', detail: 'TypeScript, Zeilen schrittweise', kind: 'Sprache', insert: '```ts {steps="1|2"}\n§const a = 1\nconst b = 2\n```\n' })
    return pick(ls, pos, 'Code-Sprache', all, m[1])
  }

  // > [!NOTE]
  if ((m = before.match(/^>\s*\[!?(\w*)$/))) {
    const all = CALLOUTS.map(([label, detail]): Suggestion => ({ label, detail, kind: 'Hinweis', insert: `> [!${label}]\n> §` }))
    return pick(ls, pos, 'Hinweiskasten', all, m[1])
  }

  // {…} an einer Überschrift oder am Codeblock
  if (/\{[^}]*$/.test(before) && /^(#{1,6}\s|`{3})/.test(before)) {
    if ((m = before.match(/layout=([\w-]*)$/))) {
      const names = [...BUILTIN_LAYOUTS, ...(opts.layouts ?? []).filter((l) => !BUILTIN_LAYOUTS.includes(l))]
      const all = names.map((label): Suggestion => ({ label, detail: LAYOUT_INFO[label] ?? 'Layout aus dem Theme', kind: 'Layout', insert: label }))
      return pick(pos - m[1].length, pos, 'Layout', all, m[1])
    }
    if ((m = before.match(/transition=([\w-]*)$/))) {
      const all = TRANSITIONS.map((label): Suggestion => ({ label, detail: 'Übergang', kind: 'Übergang', insert: label }))
      return pick(pos - m[1].length, pos, 'Übergang', all, m[1])
    }
    if ((m = before.match(/\{[^}]*?([\w.#-]*)$/))) {
      const all = ATTR_INFO.map((a): Suggestion => ({ label: a.label, detail: a.detail, kind: 'Attribut', insert: a.insert, chain: a.chain }))
      return pick(pos - m[1].length, pos, 'Attribute', all, m[1])
    }
  }
  return null
}
