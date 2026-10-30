// Räumliche Übergänge: horizontal = Slide, vertikal = Zoom.

import { cubicOut } from 'svelte/easing'
import type { Direction } from '../core/navigator.ts'

export interface TransitionParams {
  dir: Direction
  /** `transition=`-Attribut des Zielknotens: slide | zoom | fade | none */
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

function run(dir: Direction, kind: string | undefined, speed: string | undefined, phase: 'in' | 'out') {
  const plan = motionPlan(dir, kind, speed, prefersReducedMotion())
  const css = frame(dir, plan.kind, phase)
  return css ? { duration: plan.duration, easing: cubicOut, css } : { duration: 0 }
}

export function enter(_node: Element, { dir, kind, speed }: TransitionParams) {
  return run(dir, kind, speed, 'in')
}

export function leave(_node: Element, { dir, kind, speed }: TransitionParams) {
  return run(dir, kind, speed, 'out')
}
