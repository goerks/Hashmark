// Verbindung Präsentation ↔ Presenter-View (zweites Fenster, per `window.open`).
// Nur postMessage: funktioniert auch im Single-File-Export unter file://, wo BroadcastChannel unsicher ist.
// Die Präsentation ist die Quelle der Wahrheit; die Presenter-View schickt Tasten und Sprünge.

import type { Position } from '../core/navigator.ts'

export type PresenterMessage =
  /** Presenter → Präsentation, regelmäßig: „ich bin da“ (übersteht auch ein Neuladen beider Fenster) */
  | { type: 'strata:presenter-hello' }
  /** Presenter → Präsentation: Taste wie in der Präsentation gedrückt */
  | { type: 'strata:presenter-key'; key: string; shiftKey: boolean }
  /** Presenter → Präsentation: zu einer Folie springen (Baum, Suche) */
  | { type: 'strata:presenter-goto'; id: string; slide: number }
  /** Präsentation → Presenter: aktueller Stand */
  | { type: 'strata:presenter-state'; pos: Position; black: boolean }

/** Unter file:// ist der Origin undurchsichtig („null“), dort bleibt nur `*`; der Empfänger prüft die Quelle. */
export const targetOrigin = () => (/^https?:$/.test(location.protocol) ? location.origin : '*')

export function send(target: Window | null | undefined, msg: PresenterMessage) {
  try {
    target?.postMessage(msg, targetOrigin())
  } catch {
    // Fenster geschlossen
  }
}

/** Nachricht aus einem vertrauenswürdigen Fenster? Gleicher Origin oder das bekannte Partnerfenster. */
export function isTrusted(e: MessageEvent, partner: Window | null | undefined): boolean {
  if (typeof e.data?.type !== 'string' || !e.data.type.startsWith('strata:presenter-')) return false
  return (!!partner && e.source === partner) || (e.origin === location.origin && e.origin !== 'null')
}

/** Tasten, die die Presenter-View an die Präsentation weiterreicht */
export const FORWARDED_KEYS = new Set([
  'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', ' ', 'PageDown', 'PageUp', 'Enter', 'Escape', 'Home', 'b', 'B', '.',
])
