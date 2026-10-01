// Farbe für die Hashmark-Syntax im Markdown-Editor: Container `:::`, Attribute `{layout=…}`, Hinweiskästen.
// Dazu die Klassen für das Markdown-Highlighting (Farben stehen in editor.css als --ed-t-*).

import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, type Text } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const mark = (cls: string) => Decoration.mark({ class: cls })
const M = {
  fence: mark('st-fence'), name: mark('st-name'), key: mark('st-key'), val: mark('st-val'),
  flag: mark('st-flag'), cls: mark('st-cls'), br: mark('st-br'), callout: mark('st-callout'),
}

/** `{…}` ab `from` (Position der öffnenden Klammer in der Zeile) */
function attrs(b: RangeSetBuilder<Decoration>, line: string, base: number, from: number) {
  const close = line.lastIndexOf('}')
  if (line[from] !== '{' || close < from) return
  b.add(base + from, base + from + 1, M.br)
  const re = /([\w-]+=)("[^"]*"|[^\s}]+)|[.#][\w-]+|\b(?:steps|fit)\b/g
  const inner = line.slice(from + 1, close)
  for (const m of inner.matchAll(re)) {
    const s = base + from + 1 + (m.index ?? 0)
    if (m[1]) {
      b.add(s, s + m[1].length, M.key)
      b.add(s + m[1].length, s + m[0].length, M.val)
    } else b.add(s, s + m[0].length, /^[.#]/.test(m[0]) ? M.cls : M.flag)
  }
  b.add(base + close, base + close + 1, M.br)
}

function build(doc: Text): DecorationSet {
  const b = new RangeSetBuilder<Decoration>()
  let fence = false
  for (let n = 1; n <= doc.lines; n++) {
    const { text: s, from: base } = doc.line(n)
    const fm = s.match(/^(`{3,})([\w-]*)(.*)$/)
    if (fence) {
      if (fm && !fm[2] && !fm[3].trim()) fence = false
      continue
    }
    if (fm) {
      fence = true
      const brace = s.indexOf('{')
      if (brace >= 0) attrs(b, s, base, brace)
      continue
    }
    let m = s.match(/^(:{3,})(\s*)([\w-]+)?(.*)$/)
    if (m) {
      b.add(base, base + m[1].length, M.fence)
      if (m[3]) {
        const at = m[1].length + m[2].length
        b.add(base + at, base + at + m[3].length, M.name)
        const tail = at + m[3].length
        for (const kv of m[4].matchAll(/([\w-]+=)("[^"]*"|\S+)/g)) {
          const k = base + tail + (kv.index ?? 0)
          b.add(k, k + kv[1].length, M.key)
          b.add(k + kv[1].length, k + kv[0].length, M.val)
        }
      }
      continue
    }
    m = s.match(/^#{1,6}\s+.*?(\{[^{}]*\})\s*$/)
    if (m) { attrs(b, s, base, s.lastIndexOf(m[1])); continue }
    m = s.match(/^(>\s*)(\[!\w+\])/)
    if (m) b.add(base + m[1].length, base + m[1].length + m[2].length, M.callout)
  }
  return b.finish()
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view.state.doc) }
    update(u: ViewUpdate) { if (u.docChanged) this.decorations = build(u.state.doc) }
  },
  { decorations: (v) => v.decorations },
)

const highlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], class: 'tok-h' },
  { tag: t.strong, class: 'tok-strong' },
  { tag: t.emphasis, class: 'tok-em' },
  { tag: t.strikethrough, class: 'tok-strike' },
  { tag: [t.link, t.url], class: 'tok-link' },
  { tag: t.monospace, class: 'tok-code' },
  { tag: t.quote, class: 'tok-quote' },
  { tag: [t.processingInstruction, t.contentSeparator], class: 'tok-mark' },
  { tag: [t.comment, t.lineComment, t.blockComment], class: 'tok-cmt' },
  { tag: [t.string, t.special(t.string), t.regexp], class: 'tok-str' },
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], class: 'tok-kw' },
  { tag: [t.number, t.bool, t.null, t.atom], class: 'tok-num' },
  { tag: [t.propertyName, t.attributeName, t.labelName], class: 'tok-prop' },
  { tag: [t.typeName, t.className, t.tagName], class: 'tok-type' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tok-fn' },
  { tag: [t.punctuation, t.bracket, t.operator, t.meta], class: 'tok-punct' },
]))

export const hashmarkSyntax = [plugin, highlight]
