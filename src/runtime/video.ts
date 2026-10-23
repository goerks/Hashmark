// Video in der Präsentation: Es startet mit dem Schritt `play`, K hält an und setzt fort, → am laufenden Video springt ans Ende
// (nächstes → geht weiter). Nur die laufende Präsentation spielt (`live`); Übersicht, Lesemodus, Druck und Presenter-Vorschau zeigen
// ein Standbild, damit nicht mehrere Videos gleichzeitig laden oder laufen.

import type { VideoInfo } from '../core/media.ts'

export type MediaMode = 'live' | 'still' | 'off'

const videos = (root: ParentNode) => [...root.querySelectorAll<HTMLVideoElement>('video.hm-video')]
const seconds = (value: string | undefined): number | undefined => (value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined)
const startOf = (v: HTMLVideoElement) => seconds(v.dataset.start) ?? 0
const endOf = (v: HTMLVideoElement) => seconds(v.dataset.end)

type State = VideoInfo['state']

let liveRoot: HTMLElement | null = null
let listener: (() => void) | null = null
const notify = () => listener?.()

function setState(v: HTMLVideoElement, state: State) {
  if (v.dataset.state === state) return
  v.dataset.state = state
  notify()
}

/** Die Folie, in der die Präsentation gerade läuft (nur sie darf Tasten für das Video annehmen) */
export function setLiveRoot(el: HTMLElement | null) {
  if (liveRoot === el) return
  liveRoot = el
  notify()
}
/** Abmelden, aber nur, wenn die Folie noch die aktuelle ist (beim Übergang steht die neue schon da) */
export function clearLiveRoot(el: HTMLElement) {
  if (liveRoot === el) setLiveRoot(null)
}

/** Wird bei jeder Änderung des Zustands aufgerufen (auch beim Laufen etwa viermal pro Sekunde) */
export function onVideoChange(fn: (() => void) | null) {
  listener = fn
}

const current = (): HTMLVideoElement | undefined => {
  if (!liveRoot) return undefined
  const list = videos(liveRoot)
  return list.find((v) => v.dataset.play !== undefined) ?? list[0]
}

export function videoInfo(): VideoInfo | null {
  const v = current()
  if (!v) return null
  const start = startOf(v)
  const stop = endOf(v) ?? (Number.isFinite(v.duration) ? v.duration : start)
  return { state: (v.dataset.state as State | undefined) ?? 'idle', time: Math.max(0, v.currentTime - start), duration: Math.max(0, stop - start) }
}

function finish(v: HTMLVideoElement) {
  const stop = endOf(v) ?? (Number.isFinite(v.duration) ? v.duration : undefined)
  setState(v, 'ended')
  v.pause()
  if (stop !== undefined) v.currentTime = stop
}

function reset(v: HTMLVideoElement) {
  if ((v.dataset.state ?? 'idle') === 'idle' && v.currentTime <= startOf(v) + 0.01) return
  setState(v, 'idle')
  v.pause()
  v.currentTime = startOf(v)
}

/** Browser verlangen manchmal eine Eingabe im Fenster; dann zeigt das Video seine eigene Leiste, und ein Klick startet es. */
function start(v: HTMLVideoElement) {
  v.currentTime = startOf(v)
  const run = v.play()
  if (run) run.catch(() => { v.controls = true; setState(v, 'idle') })
}

/** Zustand verfolgen, Ende des Ausschnitts und Schleife behandeln (einmal je Element) */
function bind(v: HTMLVideoElement) {
  if (v.dataset.bound) return
  v.dataset.bound = '1'
  v.dataset.state = 'idle'
  v.addEventListener('playing', () => setState(v, 'playing'))
  v.addEventListener('pause', () => { if (v.dataset.state === 'playing') setState(v, 'paused') })
  v.addEventListener('ended', () => setState(v, 'ended'))
  v.addEventListener('timeupdate', () => {
    const stop = endOf(v)
    if (stop !== undefined && v.dataset.state === 'playing' && v.currentTime >= stop - 0.05) {
      if (v.loop) v.currentTime = startOf(v)
      else finish(v)
    }
    notify()
  })
}

/** Elemente nach dem Rendern vorbereiten: nur die laufende Präsentation lädt und spielt */
export function prepareVideos(root: HTMLElement, mode: MediaMode) {
  for (const v of videos(root)) {
    if (mode === 'live') bind(v)
    else {
      v.controls = false
      v.preload = mode === 'still' ? 'metadata' : 'none'
    }
  }
}

/**
 * Videos der Folie dem Schritt anpassen: ab Schritt `play` läuft das Video, davor steht das Standbild.
 * `previous` = Schritt vor dieser Änderung, `null` beim ersten Anzeigen der Folie (dann startet nur `play=0`).
 * Wer rückwärts auf eine Folie zurückkehrt, sieht das Standbild und nicht noch einmal den Ablauf.
 */
export function syncVideos(root: HTMLElement, step: number, previous: number | null) {
  for (const v of videos(root)) {
    if (v.dataset.play === undefined) continue // mit Abspielleiste: Sache des Vortragenden
    const at = Number(v.dataset.play)
    if (step >= at && (previous === null ? at === 0 : previous < at)) start(v)
    else if (step < at) reset(v)
  }
}

/** K: starten, anhalten, fortsetzen oder nach dem Ende von vorn. false = die Folie hat kein Video. */
export function toggleVideo(): boolean {
  const v = current()
  if (!v) return false
  const state = (v.dataset.state as State | undefined) ?? 'idle'
  if (state === 'playing') v.pause()
  else if (state === 'paused') {
    const run = v.play()
    if (run) run.catch(() => { v.controls = true })
  } else start(v)
  return true
}

/** → bei laufendem Video: ans Ende springen (das letzte Bild bleibt), erst das nächste → geht weiter. true = behandelt. */
export function skipVideo(): boolean {
  const v = current()
  if (!v || v.dataset.state !== 'playing') return false
  finish(v)
  return true
}
