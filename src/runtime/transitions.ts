// Räumliche Übergänge: horizontal = Slide, vertikal = Zoom.

import { cubicOut } from 'svelte/easing'
import type { Direction } from '../core/navigator.ts'

export interface TransitionParams {
  dir: Direction
  /** `transition=`-Attribut des Zielknotens: slide | zoom | fade | none */
  kind?: string
}

const DURATION = 380

function frame(dir: Direction, kind: string | undefined, phase: 'in' | 'out') {
  const k = kind === 'none' || kind === 'fade' ? kind : kind === 'zoom' ? 'zoom' : dir === 'down' || dir === 'up' ? 'zoom' : dir === 'jump' ? 'fade' : 'slide'
  if (k === 'none') return null
  if (k === 'fade') return (t: number) => `opacity:${t}`
  if (k === 'slide') {
    const sign = (dir === 'left' ? -1 : 1) * (phase === 'in' ? 1 : -1)
    return (t: number) => `transform:translateX(${sign * (1 - t) * 100}%)`
  }
  // Zoom: beim Abtauchen kommt das Detail aus der Tiefe, der Elternknoten fliegt nach vorn weg
  const deeper = dir !== 'up'
  const from = phase === 'in' ? (deeper ? 0.6 : 1.5) : deeper ? 1.5 : 0.6
  return (t: number) => `transform:scale(${from + (1 - from) * t});opacity:${t}`
}

export function enter(_node: Element, { dir, kind }: TransitionParams) {
  const css = frame(dir, kind, 'in')
  return css ? { duration: DURATION, easing: cubicOut, css } : { duration: 0 }
}

export function leave(_node: Element, { dir, kind }: TransitionParams) {
  const css = frame(dir, kind, 'out')
  return css ? { duration: DURATION, easing: cubicOut, css } : { duration: 0 }
}
