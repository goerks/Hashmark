// Schreibhilfen im Editor: Vorschläge (Slash, :::, {…}), Linter und die schwebende Formatleiste.

import { acceptCompletion, autocompletion, startCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { forceLinting, linter, type Diagnostic } from '@codemirror/lint'
import { EditorSelection, type Extension } from '@codemirror/state'
import { EditorView, keymap, showTooltip, type Tooltip } from '@codemirror/view'
import { completionAt } from '../../core/complete.ts'
import type { ComponentMeta } from '../../core/components.ts'
import { lintText, type Problem } from '../../core/lint.ts'
import { expand } from '../../core/snippets.ts'

// ---------- Vorschläge ----------

export function completion(getLayouts: () => string[], getComponents: () => Record<string, ComponentMeta>): Extension {
  const source = (ctx: CompletionContext): CompletionResult | null => {
    const r = completionAt(ctx.state.doc.toString(), ctx.pos, { explicit: ctx.explicit, layouts: getLayouts(), components: getComponents() })
    if (!r) return null
    return {
      from: r.from,
      to: r.to,
      filter: false,
      options: r.options.map((o) => ({
        label: o.label,
        detail: o.detail,
        type: o.kind,
        apply: (view, _c, from, to) => {
          const { text, cursor, select } = expand(o.insert)
          view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + cursor, head: from + cursor + select }, userEvent: 'input.complete', scrollIntoView: true })
          if (o.chain) setTimeout(() => startCompletion(view), 0)
        },
      })),
    }
  }
  return [
    autocompletion({
      override: [source],
      icons: false,
      maxRenderedOptions: 16,
      tooltipClass: () => 'st-complete',
      addToOptions: [{
        position: 10,
        render: (c) => {
          const el = document.createElement('span')
          el.className = 'st-kind'
          el.textContent = c.type ?? ''
          return el
        },
      }],
    }),
    // Tab übernimmt den Vorschlag, sonst rückt es ein
    keymap.of([{ key: 'Tab', run: acceptCompletion }]),
  ]
}

// ---------- Linter ----------

export type { Problem }

export function lint(getLayouts: () => string[], getComponents: () => Record<string, ComponentMeta>, onProblems: (list: Problem[]) => void): Extension {
  return linter((view): Diagnostic[] => {
    const problems = lintText(view.state.doc.toString(), { layouts: getLayouts(), components: getComponents() })
    onProblems(problems)
    return problems.map((p) => ({
      from: p.from,
      to: Math.max(p.to, p.from + 1),
      severity: p.severity,
      message: p.message,
      actions: p.fix
        ? [{ name: 'Korrigieren', apply: (v: EditorView, from: number, to: number) => v.dispatch({ changes: { from, to, insert: p.fix! } }) }]
        : [],
    }))
  }, { delay: 350 })
}

export const relint = (view: EditorView) => forceLinting(view)

// ---------- Formatieren ----------

/** Auswahl mit Zeichen umschließen bzw. wieder lösen; ohne Auswahl Paar einfügen, Cursor dazwischen */
export function wrap(view: EditorView, open: string, close = open): boolean {
  const { state } = view
  view.dispatch(state.update(state.changeByRange((r) => {
    const before = state.sliceDoc(Math.max(0, r.from - open.length), r.from)
    const after = state.sliceDoc(r.to, r.to + close.length)
    if (!r.empty && before === open && after === close) {
      return {
        changes: [{ from: r.from - open.length, to: r.from }, { from: r.to, to: r.to + close.length }],
        range: EditorSelection.range(r.from - open.length, r.to - open.length),
      }
    }
    if (r.empty) return { changes: { from: r.from, insert: open + close }, range: EditorSelection.cursor(r.from + open.length) }
    return {
      changes: [{ from: r.from, insert: open }, { from: r.to, insert: close }],
      range: EditorSelection.range(r.from + open.length, r.to + open.length),
    }
  }), { userEvent: 'input', scrollIntoView: true }))
  view.focus()
  return true
}

export function link(view: EditorView): boolean {
  const r = view.state.selection.main
  const text = view.state.sliceDoc(r.from, r.to)
  const insert = `[${text}](url)`
  const url = r.from + text.length + 3
  view.dispatch({ changes: { from: r.from, to: r.to, insert }, selection: EditorSelection.range(url, url + 3), userEvent: 'input', scrollIntoView: true })
  view.focus()
  return true
}

/** Zeile: Text → `## ` → `### ` → Text */
export function toggleHeading(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const m = line.text.match(/^(#{1,6})\s+/)
  const change = !m
    ? { from: line.from, insert: '## ' }
    : m[1].length < 3
      ? { from: line.from, insert: '#' }
      : { from: line.from, to: line.from + m[0].length, insert: '' }
  view.dispatch({ changes: change, userEvent: 'input' })
  view.focus()
  return true
}

export const formatKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => wrap(v, '**') },
  { key: 'Mod-i', run: (v) => wrap(v, '*') },
  { key: 'Mod-e', run: (v) => wrap(v, '`') },
])

function bubbleDom(view: EditorView): HTMLElement {
  const dom = document.createElement('div')
  dom.className = 'st-bubble'
  const items: [string, string, (v: EditorView) => void][] = [
    ['<b>B</b>', 'Fett (Strg+B)', (v) => wrap(v, '**')],
    ['<i>I</i>', 'Kursiv (Strg+I)', (v) => wrap(v, '*')],
    ['&lt;/&gt;', 'Code (Strg+E)', (v) => wrap(v, '`')],
    ['Link', 'Link einfügen', link],
    ['H', 'Überschrift', toggleHeading],
  ]
  for (const [html, title, run] of items) {
    const b = document.createElement('button')
    b.type = 'button'
    b.title = title
    b.setAttribute('aria-label', title)
    b.innerHTML = html
    // pointerdown statt click: die Auswahl im Editor soll erhalten bleiben
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); run(view) })
    dom.append(b)
  }
  return dom
}

/** Schwebende Leiste über markiertem Text (eine Zeile) */
export const formatBubble: Extension = showTooltip.compute(['selection'], (state): Tooltip | null => {
  const r = state.selection.main
  if (r.empty || state.doc.lineAt(r.from).number !== state.doc.lineAt(r.to).number) return null
  return { pos: r.from, above: true, strictSide: true, arrow: false, create: (view) => ({ dom: bubbleDom(view) }) }
})
