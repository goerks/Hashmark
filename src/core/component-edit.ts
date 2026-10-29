// Hilfen zum Schreiben eigener Komponenten im Editor: Vorlage prüfen, Platzhalter vorschlagen, Gerüst anlegen.
// Reine Funktionen ohne DOM, damit Editor und Datei-API sie gemeinsam nutzen und tests/core.test.ts sie prüft.

import { parseTemplate, readMetaHead, TemplateError } from './components.ts'
import { FUNCTIONS } from './functions.ts'
import type { Problem } from './lint.ts'
import { CONTAINERS } from './vocab.ts'

/** Pfade, die der Editor als Komponente öffnet: `components/<name>.html` bzw. `.css`, im Deck- oder Theme-Ordner */
export const COMPONENT_FILE = /(^|\/)components\/[^/]+\.(html|css)$/i

export function componentKind(path: string): 'template' | 'style' | null {
  if (!COMPONENT_FILE.test(path)) return null
  return /\.html$/i.test(path) ? 'template' : 'style'
}

// ---------- Prüfen ----------

/** Vorlage prüfen: Syntaxfehler und Fehler im Kopf werden zu Hinweisen mit Zeile (parseTemplate nennt sie in der Meldung). */
export function lintTemplate(text: string): Problem[] {
  try {
    parseTemplate(text)
    return []
  } catch (e) {
    if (!(e instanceof TemplateError)) throw e
    const m = e.message.match(/^Zeile (\d+): ([^]*)$/)
    const lines = text.split('\n')
    // ohne Zeilenangabe (Fehler im Kopf) zeigt der Hinweis auf den Kopf, sonst auf die erste Zeile
    const line = m ? Math.min(Number(m[1]), lines.length) : 1
    const from = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0)
    return [{ from, to: from + lines[line - 1].length, line, severity: 'error', message: m ? m[2] : e.message }]
  }
}

// ---------- Vorschläge ----------

export interface TemplateOption { label: string; detail?: string }
export interface TemplateCompletion { from: number; to: number; options: TemplateOption[] }

const BUILTIN: TemplateOption[] = [
  { label: 'body', detail: 'Inhalt als Markdown, mit drei Klammern' },
  { label: 'items', detail: 'Listenpunkte der obersten Ebene (mit #each)' },
  { label: 'children', detail: 'Kind-Container (mit #each)' },
  { label: 'count', detail: 'Zahl der Einträge' },
]
const LOOP: TemplateOption[] = [
  { label: 'number', detail: '1, 2, 3 …' },
  { label: 'index', detail: 'ab 0' },
  { label: 'first', detail: 'erster Eintrag' },
  { label: 'last', detail: 'letzter Eintrag' },
  { label: 'step', detail: 'Schrittnummer' },
  { label: 'text', detail: 'Listenpunkt als Text' },
  { label: 'html', detail: 'Listenpunkt als Markdown, mit drei Klammern' },
]
const BLOCKS: TemplateOption[] = [
  { label: '#if', detail: 'nur wenn gesetzt' },
  { label: '#each', detail: 'für jeden Eintrag' },
  { label: '/if', detail: 'Block schließen' },
  { label: '/each', detail: 'Block schließen' },
  { label: 'else', detail: 'sonst (in #if)' },
]

const FUNCTION_OPTIONS: TemplateOption[] = Object.entries(FUNCTIONS).map(([label, f]) => ({ label, detail: f.detail }))

/** Vorschläge nach `{{` bzw. `{{{`: Attribute aus dem Kopf, eingebaute Namen und Blöcke; nach `|` die Funktionen. Sonst null. */
export function completeTemplate(text: string, pos: number): TemplateCompletion | null {
  const before = text.slice(0, pos)
  // nach `|` im selben Platzhalter (Anführungszeichen dürfen ein `|` enthalten): Funktionsname
  const fn = before.match(/\{\{[ \t]*[\w.-]+(?:[ \t]*\|(?:[^|{}"']|"[^"]*"|'[^']*')*)*[ \t]*\|[ \t]*(\w*)$/)
  if (fn) {
    const word = fn[1]
    const options = FUNCTION_OPTIONS.filter((o) => o.label.startsWith(word.toLowerCase()))
    return options.length ? { from: pos - word.length, to: pos, options } : null
  }
  const m = before.match(/\{\{\{?[ \t]*([#/]?[\w.-]*)$/)
  if (!m) return null
  const word = m[1]
  const from = pos - word.length
  const meta = readMetaHead(text)
  const names: TemplateOption[] = [
    ...Object.entries(meta?.attrs ?? {}).map(([label, detail]) => ({ label, detail })),
    ...Object.entries(meta?.flags ?? {}).map(([label, detail]) => ({ label, detail })),
    ...Object.entries(meta?.children ?? {}).flatMap(([, c]) => Object.entries(c.attrs ?? {}).map(([label, detail]) => ({ label, detail }))),
  ]
  const seen = new Set<string>()
  const options = [...names, ...BUILTIN, ...LOOP, ...BLOCKS].filter((o) => !seen.has(o.label) && seen.add(o.label))
    .filter((o) => o.label.toLowerCase().startsWith(word.toLowerCase()))
  return options.length ? { from, to: pos, options } : null
}

// ---------- Gerüst ----------

/** Fehlermeldung, wenn der Name nicht als Komponente taugt; sonst null. */
export function componentNameProblem(name: string): string | null {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) return 'Der Name beginnt mit einem Kleinbuchstaben und enthält nur Kleinbuchstaben, Ziffern und Bindestriche.'
  if (CONTAINERS.includes(name)) return `„${name}“ ist ein eingebauter Container, bitte einen anderen Namen wählen.`
  return null
}

export interface ScaffoldInput {
  name: string
  description?: string
  /** Attribute mit Wert; das erste ist Pflicht */
  attrs?: string[]
  /** mit Kind-Containern (`::: name` mit `::: kind`) statt einfachem Kasten */
  children?: boolean
}

const yamlText = (s: string) => JSON.stringify(s)

/** Vorlage und Gestaltung für eine neue Komponente. Die Vorlage ist gültig und der Kopf enthält ein Beispiel. */
export function scaffoldComponent(input: ScaffoldInput): { html: string; css: string } {
  const problem = componentNameProblem(input.name)
  if (problem) throw new Error(problem)
  const name = input.name
  const attrs = (input.attrs ?? []).map((a) => a.trim()).filter(Boolean)
  if (attrs.some((a) => !/^[a-z][\w-]*$/.test(a))) throw new Error('Attribute heißen wie title oder label: Buchstaben, Ziffern, Bindestriche.')
  const description = (input.description ?? '').trim() || `Eigene Komponente ${name}`
  const kind = `${name}-eintrag`
  const attrList = attrs.length ? attrs : ['title']
  const attrLines = attrList.map((a) => `  ${a}: ${yamlText(a === 'title' ? 'Überschrift' : `Wert „${a}“`)}`).join('\n')
  const attrsText = attrList.map((a) => `${a}="${a === 'title' ? 'Titel' : 'Wert'}"`).join(' ')
  const head = [
    '{{!meta',
    `description: ${yamlText(description)}`,
    'attrs:',
    attrLines,
    `required: ${attrList[0]}`,
  ]
  let body: string[]
  if (input.children) {
    head.push(
      'children:',
      `  ${kind}:`,
      '    description: Ein Eintrag',
      '    attrs:',
      '      label: Beschriftung',
      '    required: label',
      'example: |',
      `  ::: ${name} ${attrsText}`,
      `  ::: ${kind} label="Erster"`,
      '  :::',
      `  ::: ${kind} label="Zweiter"`,
      '  Mit Text.',
      '  :::',
      '  :::',
    )
    body = [
      `<div class="${name}">`,
      `  {{#if ${attrList[0]}}}<div class="${name}-title">{{ ${attrList[0]} }}</div>{{/if}}`,
      '  {{#each children}}',
      `  <div class="${name}-item"{{#if step}} data-step="{{ step }}"{{/if}}>`,
      '    <strong>{{ label }}</strong>',
      '    {{{ body }}}',
      '  </div>',
      '  {{/each}}',
      '</div>',
    ]
  } else {
    head.push(
      'example: |',
      `  ::: ${name} ${attrsText}`,
      '  Ein kurzer Text.',
      '  :::',
    )
    body = [
      `<aside class="${name}">`,
      `  <div class="${name}-title">{{ ${attrList[0]} }}</div>`,
      `  <div class="${name}-text">{{{ body }}}</div>`,
      '</aside>',
    ]
  }
  head.push('}}')
  const css = [
    `/* Gestaltung der Komponente „${name}“; Hashmark setzt um sie die Klasse .d-${name} */`,
    `.d-${name} .${name} { border-left: 6px solid var(--color-accent); padding: 0.8rem 1.2rem; }`,
    `.d-${name} .${name}-title { font-family: var(--font-heading); font-weight: 700; color: var(--color-accent); }`,
    '',
  ].join('\n')
  return { html: [...head, ...body, ''].join('\n'), css }
}
