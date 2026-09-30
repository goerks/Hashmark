// Syntax-Erweiterungen, die vor bzw. neben remark laufen.

const FENCE = /^\s{0,3}(`{3,}|~{3,})/
const OPEN = /^(\s{0,3}):{3,}\s*([A-Za-z][\w-]*)\s*(.*)$/
const CLOSE = /^\s{0,3}:{3,}\s*$/

/**
 * Normalisiert Container im Pandoc-Stil (`::: columns` … `:::`, beliebig verschachtelt
 * mit gleicher Doppelpunkt-Anzahl) in die Syntax von remark-directive:
 * `:::name{attrs}`, wobei äußere Container mehr Doppelpunkte bekommen als innere.
 * Codeblöcke bleiben unangetastet.
 */
export function normalizeContainers(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  interface Pair { open: number; close: number; height: number; name: string; rest: string; indent: string }
  const pairs: Pair[] = []
  const stack: { pair: Pair; childHeight: number }[] = []
  let fence: string | null = null

  lines.forEach((line, i) => {
    const f = line.match(FENCE)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null
      return
    }
    if (f) { fence = f[1]; return }

    const open = line.match(OPEN)
    if (open) {
      const pair: Pair = { open: i, close: -1, height: 0, name: open[2], rest: open[3].trim(), indent: open[1] }
      pairs.push(pair)
      stack.push({ pair, childHeight: -1 })
      return
    }
    if (CLOSE.test(line) && stack.length) {
      const { pair, childHeight } = stack.pop()!
      pair.close = i
      pair.height = childHeight + 1
      const parent = stack[stack.length - 1]
      if (parent) parent.childHeight = Math.max(parent.childHeight, pair.height)
    }
  })
  // nicht geschlossene Container: Höhe aus den bisher gesehenen Kindern
  for (const { pair, childHeight } of stack) pair.height = childHeight + 1

  for (const p of pairs) {
    const colons = ':'.repeat(3 + p.height)
    let rest = p.rest
    if (rest && !rest.startsWith('{') && !rest.startsWith('[')) rest = `{${rest}}`
    lines[p.open] = `${p.indent}${colons}${p.name}${rest}`
    if (p.close >= 0) lines[p.close] = `${p.indent}${colons}`
  }
  return lines.join('\n')
}

const HEADING_ATTRS = /\s*\{([^{}]*)\}\s*$/

/** Trennt `Titel {layout=two-col id=x}` in Titel und Attribut-String. */
export function splitHeadingAttrs(text: string): { text: string; attrs: string | null } {
  const m = text.match(HEADING_ATTRS)
  // `{steps}` ist als einziges Flag ohne `=`/`.`/`#` erlaubt (sonst bliebe z. B. `Set {a}` im Titel)
  if (!m || !/[=.#]|(^|\s)steps(\s|$)/.test(m[1])) return { text, attrs: null }
  return { text: text.slice(0, m.index), attrs: m[1] }
}

/** Parst `key=value key="a b" .klasse #id flag` in ein Objekt. */
export function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([.#]?)([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  for (const m of input.matchAll(re)) {
    const [, prefix, key, dq, sq, bare] = m
    if (prefix === '.') attrs.class = attrs.class ? `${attrs.class} ${key}` : key
    else if (prefix === '#') attrs.id = key
    else attrs[key] = dq ?? sq ?? bare ?? 'true'
  }
  return attrs
}
