// Räumliche Übergänge: → ← schieben, ↓ ↑ zeigen Tiefe (der Elternknoten tritt zurück). Mit `transition=` lässt sich das ändern.
// Alles läuft über CSS (Svelte erzeugt daraus die Animation): Verschieben, Skalieren, Filter, `clip-path` und Masken.
// Mosaik, Jalousie und diagonaler Aufbau bestehen aus vielen Maskenebenen auf der neuen Folie, ohne Kopien des Inhalts.

import { cubicOut } from 'svelte/easing'
import type { Direction } from '../core/navigator.ts'

export interface TransitionParams {
  dir: Direction
  /** `transition=`-Attribut des Zielknotens (siehe `TRANSITIONS` in check.ts) */
  kind?: string
  /** `speed=` des Zielknotens bzw. deck.yaml `motion: speed:`: fast | normal | slow */
  speed?: string
}

/** Dauer je Tempo in ms; `normal` ist das ursprüngliche Verhalten */
const DURATIONS: Record<string, number> = { fast: 190, normal: 380, slow: 760 }
/** Bei reduzierter Bewegung bleibt nur ein kurzes Überblenden */
const REDUCED_DURATION = 120

export const motionDuration = (speed?: string) => DURATIONS[speed ?? 'normal'] ?? DURATIONS.normal

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Art und Dauer eines Wechsels; `reduced` ersetzt jede Bewegung durch Überblenden (außer `none`) */
export function motionPlan(dir: Direction, kind: string | undefined, speed: string | undefined, reduced: boolean): { kind: string | undefined; duration: number } {
  if (reduced) return { kind: kind === 'none' ? 'none' : 'fade', duration: kind === 'none' ? 0 : REDUCED_DURATION }
  return { kind, duration: kind === 'none' ? 0 : motionDuration(speed) }
}

/** Was ohne `transition=` gilt: seitlich schieben, ↓ ↑ Tiefe, Sprünge (Suche, Übersicht) überblenden */
export function kindFor(dir: Direction, kind: string | undefined): string {
  if (kind && kind !== 'auto') return kind
  return dir === 'down' || dir === 'up' ? 'depth' : dir === 'jump' ? 'fade' : 'slide'
}

type Css = (t: number, u: number) => string

/** Einheitsvektor der Taste; Sprünge zählen wie → */
const VECTORS: Record<Direction, [number, number]> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1], jump: [1, 0] } as Record<Direction, [number, number]>

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const num = (n: number) => Math.round(n * 1000) / 1000

/** Maske mit Kacheln: jede Kachel wächst aus ihrer Mitte, gestaffelt nach `delay` (0..1); `t` ist der Fortschritt */
export function tileMask(cols: number, rows: number, delay: (x: number, y: number) => number, t: number, axis: 'both' | 'x' | 'y' = 'both'): string {
  const images: string[] = []
  const sizes: string[] = []
  const positions: string[] = []
  const cw = 100 / cols
  const ch = 100 / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Kacheln beginnen bei t = delay · 0,45 und brauchen 0,55 der Zeit; leichte Überlappung gegen Nähte
      const s = clamp01((t - delay(x, y) * 0.45) / 0.55)
      const w = axis === 'y' ? cw + 0.4 : s * cw + (s > 0 ? 0.4 : 0)
      const h = axis === 'x' ? ch + 0.4 : s * ch + (s > 0 ? 0.4 : 0)
      const left = x * cw + (cw - w) / 2
      const top = y * ch + (ch - h) / 2
      // `mask-position` in Prozent bezieht sich auf (Fläche − Ebene)
      const px = w >= 100 ? 0 : (left / (100 - w)) * 100
      const py = h >= 100 ? 0 : (top / (100 - h)) * 100
      images.push('linear-gradient(#000,#000)')
      sizes.push(`${num(w)}% ${num(h)}%`)
      positions.push(`${num(px)}% ${num(py)}%`)
    }
  }
  const m = `mask-image:${images.join(',')};mask-size:${sizes.join(',')};mask-position:${positions.join(',')};mask-repeat:no-repeat`
  return `${m};-webkit-${m.replace(/;/g, ';-webkit-')}`
}

/** Diagonaler Aufbau: die Welle läuft von einer Ecke zur gegenüberliegenden, je nach Taste */
function diagonalDelay(dir: Direction, cols: number, rows: number): (x: number, y: number) => number {
  const w = (x: number, y: number) =>
    dir === 'left' ? cols - 1 - x + y : dir === 'down' ? y * 1.5 + x * 0.5 : dir === 'up' ? (rows - 1 - y) * 1.5 + x * 0.5 : x + y
  let max = 0
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) max = Math.max(max, w(x, y))
  return (x, y) => w(x, y) / (max || 1)
}

/** Mosaik: feste Zufallsfolge, damit der Übergang immer gleich aussieht */
function mosaicDelay(x: number, y: number): number {
  const n = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453
  return n - Math.floor(n)
}

/** Vorhang: Spalt in der Mitte der alten Folie; `gap` ist die halbe Breite in Prozent */
function curtainMask(vertical: boolean, gap: number): string {
  const axis = vertical ? 'to bottom' : 'to right'
  const a = num(50 - gap)
  const b = num(50 + gap)
  const m = `mask-image:linear-gradient(${axis},#000 ${a}%,transparent ${a}%,transparent ${b}%,#000 ${b}%)`
  return `${m};-webkit-${m}`
}

/** CSS einer Phase; null = kein Übergang */
export function transitionCss(dir: Direction, kindIn: string | undefined, phase: 'in' | 'out'): Css | null {
  const kind = kindFor(dir, kindIn)
  const inP = phase === 'in'
  const [vx, vy] = VECTORS[dir] ?? VECTORS.right
  const vertical = dir === 'down' || dir === 'up'
  const move = (k: number) => `translate(${num(vx * k)}%,${num(vy * k)}%)`
  const shadow = 'box-shadow:0 0 60px rgba(0,0,0,0.55)'
  switch (kind) {
    case 'none':
      return null
    case 'fade':
      return (t) => `opacity:${t}`
    case 'slide': {
      const sign = (dir === 'left' ? -1 : 1) * (inP ? 1 : -1)
      return (t) => `transform:translateX(${sign * (1 - t) * 100}%)`
    }
    case 'zoom': {
      // beim Abtauchen kommt das Detail aus der Tiefe, der Elternknoten fliegt nach vorn weg
      const deeper = dir !== 'up'
      const from = inP ? (deeper ? 0.6 : 1.5) : deeper ? 1.5 : 0.6
      return (t) => `transform:scale(${from + (1 - from) * t});opacity:${t}`
    }
    case 'push':
      return (_t, u) => `transform:translate(${num((inP ? vx : -vx) * u * 100)}%,${num((inP ? vy : -vy) * u * 100)}%)`
    case 'cover':
      return inP
        ? (_t, u) => `z-index:2;transform:${move(u * 100)};${shadow}`
        : (_t, u) => `z-index:1;transform:translate(${num(-vx * 12 * u)}%,${num(-vy * 12 * u)}%) scale(${num(1 - 0.03 * u)});filter:brightness(${num(1 - 0.5 * u)})`
    case 'reveal':
      return inP
        ? (_t, u) => `z-index:1;transform:scale(${num(1 - 0.06 * u)});filter:brightness(${num(1 - 0.45 * u)})`
        : (_t, u) => `z-index:2;transform:translate(${num(-vx * u * 100)}%,${num(-vy * u * 100)}%)`
    case 'blur':
      return inP
        ? (t, u) => `opacity:${t};filter:blur(${num(u * 14)}px);transform:scale(${num(1 - 0.03 * u)})`
        : (t, u) => `opacity:${t};filter:blur(${num(u * 14)}px);transform:scale(${num(1 + 0.04 * u)})`
    case 'iris': {
      const at = dir === 'right' ? '100% 50%' : dir === 'left' ? '0% 50%' : dir === 'down' ? '50% 100%' : dir === 'up' ? '50% 0%' : '50% 50%'
      return inP
        ? (t) => `z-index:2;clip-path:circle(${num(t * 150)}% at ${at})`
        : (_t, u) => `z-index:1;transform:scale(${num(1 - 0.05 * u)});filter:brightness(${num(1 - 0.4 * u)})`
    }
    case 'curtain':
      return inP
        ? (_t, u) => `z-index:1;transform:scale(${num(1 - 0.06 * u)});filter:brightness(${num(1 - 0.45 * u)})`
        : (_t, u) => `z-index:2;${curtainMask(!vertical, u * 50)}`
    case 'diagonal':
      return inP ? (t) => `z-index:2;${tileMask(8, 5, diagonalDelay(dir, 8, 5), t)}` : () => 'z-index:1'
    case 'mosaic':
      return inP ? (t) => `z-index:2;${tileMask(8, 5, mosaicDelay, t)}` : () => 'z-index:1'
    case 'blinds': {
      const strips = vertical ? [1, 8] : [10, 1]
      const index = (x: number, y: number) => (vertical ? (dir === 'down' ? y : strips[1] - 1 - y) / (strips[1] - 1) : (dir === 'left' ? strips[0] - 1 - x : x) / (strips[0] - 1))
      return inP ? (t) => `z-index:2;${tileMask(strips[0], strips[1], index, t, vertical ? 'y' : 'x')}` : () => 'z-index:1'
    }
    case 'depth':
      // Tiefe: beim Abtauchen tritt der Elternknoten zurück und dunkelt ab, das Detail kommt von unten darüber; ↑ kehrt es um
      if (!vertical) return transitionCss(dir, 'slide', phase)
      {
        const back = (u: number) => `transform:scale(${num(1 - 0.08 * u)}) translateY(${num(-3 * u)}%);filter:brightness(${num(1 - 0.5 * u)})`
        const over = (u: number) => `transform:translateY(${num(u * 100)}%);box-shadow:0 -10px 40px rgba(0,0,0,0.6)`
        if (dir === 'down') return inP ? (_t, u) => `z-index:2;${over(u)}` : (_t, u) => `z-index:1;${back(u)}`
        return inP ? (_t, u) => `z-index:1;${back(u)}` : (_t, u) => `z-index:2;${over(u)}`
      }
    default:
      // unbekannter Wert: wie ohne Angabe
      return transitionCss(dir, undefined, phase)
  }
}

function run(dir: Direction, kind: string | undefined, speed: string | undefined, phase: 'in' | 'out') {
  const plan = motionPlan(dir, kind, speed, prefersReducedMotion())
  const css = transitionCss(dir, plan.kind, phase)
  return css ? { duration: plan.duration, easing: cubicOut, css } : { duration: 0 }
}

export function enter(_node: Element, { dir, kind, speed }: TransitionParams) {
  return run(dir, kind, speed, 'in')
}

export function leave(_node: Element, { dir, kind, speed }: TransitionParams) {
  return run(dir, kind, speed, 'out')
}
