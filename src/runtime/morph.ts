// Auto-Animate: Elemente, die auf zwei aufeinanderfolgenden Folien vorkommen, wandern von der alten an die neue Stelle.
// Zuordnung: `morph=name` (gleicher Name auf beiden Folien) oder der Folientitel (Rolle `title`, Standard, `morph=off` schaltet ab).
// Code-Blöcke mit gleichem Namen ordnen ihre Zeilen nach Inhalt zu: gleiche Zeilen rutschen, neue blenden ein.
// Der Kern (Zuordnung, Zeilenvergleich) ist rein und getestet; `playMorph` bindet ihn an die DOM-Elemente der beiden Folien.

export interface Box { left: number; top: number; width: number; height: number }

/** Ein Element, das wandern kann */
export interface MorphItem<T = unknown> {
  /** `morph=name`; leer bei der Rolle Titel */
  name?: string
  role?: 'title'
  kind: 'box' | 'text' | 'code'
  text: string
  box: Box
  el: T
}

export interface MorphPair<T = unknown> { from: MorphItem<T>; to: MorphItem<T> }

/** Ändert sich Lage oder Größe so, dass sich eine Bewegung lohnt? (Pixel und Verhältnis) */
export function moves(a: Box, b: Box): boolean {
  const size = (x: number, y: number) => Math.abs(x - y) / Math.max(x, y, 1)
  return Math.abs(a.left - b.left) > 4 || Math.abs(a.top - b.top) > 4 || size(a.width, b.width) > 0.03 || size(a.height, b.height) > 0.03
}

/**
 * Paare aus alter und neuer Folie: erst gleiche Namen, dann der Titel (nur wenn `auto`).
 * Jedes Element gehört zu höchstens einem Paar.
 */
export function pairItems<T>(from: MorphItem<T>[], to: MorphItem<T>[], auto: boolean): MorphPair<T>[] {
  const out: MorphPair<T>[] = []
  const used = new Set<MorphItem<T>>()
  for (const t of to) {
    if (!t.name) continue
    const f = from.find((x) => x.name === t.name && !used.has(x))
    if (f) { used.add(f); out.push({ from: f, to: t }) }
  }
  if (auto) {
    for (const t of to) {
      if (t.name || t.role !== 'title') continue
      const f = from.find((x) => !x.name && x.role === 'title' && !used.has(x))
      if (f) { used.add(f); out.push({ from: f, to: t }) }
    }
  }
  return out
}

/**
 * Zeilen von Code-Blöcken zuordnen: längste gemeinsame Teilfolge nach Inhalt (ohne Einrückung und Leerzeilen).
 * Ergebnis je neuer Zeile: Index der alten Zeile oder -1 (neu).
 */
export function matchLines(oldLines: string[], newLines: string[]): number[] {
  const key = (s: string) => s.trim()
  const n = oldLines.length
  const m = newLines.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = key(oldLines[i]) !== '' && key(oldLines[i]) === key(newLines[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out = new Array<number>(m).fill(-1)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (key(oldLines[i]) !== '' && key(oldLines[i]) === key(newLines[j])) { out[j] = i; i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return out
}

/** Transform, der ein Element von der alten Lage an seine neue Stelle führt (Ursprung oben links); `uniform` skaliert gleichmäßig (Text) */
export function flipFrom(a: Box, b: Box, scale: number, uniform: boolean): string {
  const dx = (a.left - b.left) / scale
  const dy = (a.top - b.top) / scale
  const sx = b.width > 0 ? a.width / b.width : 1
  const sy = b.height > 0 ? a.height / b.height : 1
  const s = uniform ? sy : undefined
  return `translate(${round(dx)}px, ${round(dy)}px) scale(${round(s ?? sx)}, ${round(s ?? sy)})`
}

const round = (n: number) => Math.round(n * 1000) / 1000

// ---------- DOM ----------

const NAME = /^[\w-]+$/

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

function visible(el: Element): boolean {
  if (el.closest('.step-hidden')) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

/** Alles auf einer Folie (`.stage-slide`), was wandern kann */
export function collect(root: Element): MorphItem<HTMLElement>[] {
  const out: MorphItem<HTMLElement>[] = []
  for (const el of root.querySelectorAll<HTMLElement>('[data-morph]')) {
    const name = el.dataset.morph ?? ''
    if (!NAME.test(name) || name === 'off' || !visible(el)) continue
    const kind = el.matches('figure.code-block') ? 'code' : el.classList.contains('slide-title') ? 'text' : 'box'
    out.push({ name, kind, text: (el.textContent ?? '').trim(), box: boxOf(el), el })
  }
  const slide = root.querySelector('.slide')
  if (slide && !slide.hasAttribute('data-morph-off')) {
    for (const el of root.querySelectorAll<HTMLElement>('.slide-title')) {
      if (el.dataset.morph && NAME.test(el.dataset.morph)) continue
      if (visible(el)) out.push({ role: 'title', kind: 'text', text: (el.textContent ?? '').trim(), box: boxOf(el), el })
    }
  }
  return out
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Lässt zusammengehörige Elemente von der alten zur neuen Folie wandern. Gibt false zurück, wenn sich nichts bewegt
 * (dann gilt der normale Übergang). Die neue Folie blendet dabei schnell ein (siehe transitions.ts), die Bewegung dauert `ms`.
 */
export function playMorph(oldSlide: HTMLElement, newSlide: HTMLElement, ms: number): boolean {
  const stage = newSlide.closest<HTMLElement>('.stage')
  const scale = stage && stage.offsetWidth ? stage.getBoundingClientRect().width / stage.offsetWidth : 1
  const pairs = pairItems(collect(oldSlide), collect(newSlide), true)
  // Code wandert nur, wenn sich im Block etwas ändert; alles andere nur, wenn sich Lage oder Größe ändert
  const real = pairs.filter((p) => (p.from.kind === 'code' ? p.from.text !== p.to.text : moves(p.from.box, p.to.box)))
  if (!real.length) return false
  const opts: KeyframeAnimationOptions = { duration: ms, easing: EASE, fill: 'backwards' }
  for (const p of real) {
    if (p.from.kind === 'code') { morphCode(p.from.el, p.to.el, scale, ms); continue }
    const uniform = p.to.kind === 'text'
    p.to.el.animate([{ transform: flipFrom(p.from.box, p.to.box, scale, uniform), transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], opts)
    // Gleicher Inhalt: das alte Element ist nach den ersten Bildern weg, sonst läge es doppelt da. Anderer Text: es blendet mit der Folie aus.
    if (p.from.text === p.to.text) p.from.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: ms * 0.15, fill: 'forwards' })
  }
  return true
}

/** Code-Block: gleiche Zeilen rutschen an ihren neuen Platz, neue blenden ein */
function morphCode(oldBlock: HTMLElement, newBlock: HTMLElement, scale: number, ms: number) {
  const oldLines = [...oldBlock.querySelectorAll<HTMLElement>('.line')]
  const newLines = [...newBlock.querySelectorAll<HTMLElement>('.line')]
  const map = matchLines(oldLines.map((l) => l.textContent ?? ''), newLines.map((l) => l.textContent ?? ''))
  newLines.forEach((line, i) => {
    const o = map[i] >= 0 ? oldLines[map[i]] : null
    if (!o) {
      line.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms * 0.5, delay: ms * 0.45, easing: 'ease', fill: 'backwards' })
      return
    }
    const a = boxOf(o)
    const b = boxOf(line)
    if (moves(a, b)) line.animate([{ transform: flipFrom(a, { ...b, width: a.width, height: a.height }, scale, false), transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: ms, easing: EASE, fill: 'backwards' })
    o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: ms * 0.15, fill: 'forwards' })
  })
}
