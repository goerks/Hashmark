// Verbindung Präsentation ↔ Presenter-View (zweites Fenster). Die Präsentation ist die Quelle der Wahrheit;
// die Presenter-View schickt Tasten und Sprünge.
//
// Zwei Transportwege:
// - http(s): BroadcastChannel – funktioniert zwischen beliebigen Fenstern desselben Servers, auch ohne
//   window.opener (Tauri-Fenster, Presenter in einem eigenen Tab, Neuladen beider Seiten).
// - file:// (Single-File-Export): postMessage an das Partnerfenster, weil der Origin dort undurchsichtig ist.
//
// Mehrere Präsentationen können gleichzeitig offen sein (Hauptfenster + Vollbild). Jede hat eine `session`;
// die Presenter-View koppelt sich an eine und adressiert Tasten per `target`.

import type { Position } from '../core/navigator.ts'

export type PresenterMessage =
  /** Presenter → Präsentation, regelmäßig: „ich bin da“ */
  | { type: 'hashmark:presenter-hello' }
  /** Presenter → Präsentation: Taste wie in der Präsentation gedrückt */
  | { type: 'hashmark:presenter-key'; key: string; shiftKey: boolean; target?: string }
  /** Presenter → Präsentation: zu einer Folie springen (Baum, Suche) */
  | { type: 'hashmark:presenter-goto'; id: string; slide: number; target?: string }
  /** Präsentation → Presenter: aktueller Stand */
  | { type: 'hashmark:presenter-state'; pos: Position; black: boolean; session: string }

/** Unter file:// ist der Origin undurchsichtig („null“), dort bleibt nur `*`; der Empfänger prüft die Quelle. */
export const targetOrigin = () => (/^https?:$/.test(location.protocol) ? location.origin : '*')

export function send(target: Window | null | undefined, msg: PresenterMessage) {
  try {
    target?.postMessage(msg, targetOrigin())
  } catch {
    // Fenster geschlossen
  }
}

const isPresenterMessage = (data: unknown): data is PresenterMessage =>
  typeof (data as { type?: unknown })?.type === 'string' && (data as { type: string }).type.startsWith('hashmark:presenter-')

/** Nachricht aus einem vertrauenswürdigen Fenster? Gleicher Origin oder das bekannte Partnerfenster. */
export function isTrusted(e: MessageEvent, partner: Window | null | undefined): boolean {
  if (!isPresenterMessage(e.data)) return false
  return (!!partner && e.source === partner) || (e.origin === location.origin && e.origin !== 'null')
}

/** BroadcastChannel nur unter http(s) – dort ist er auf denselben Origin begrenzt */
export const usesChannel = () => /^https?:$/.test(location.protocol) && typeof BroadcastChannel !== 'undefined'

export interface PresenterLink {
  send(msg: PresenterMessage): void
  close(): void
  /** true = BroadcastChannel, false = postMessage an das Partnerfenster */
  readonly channel: boolean
}

/**
 * Öffnet die Verbindung. `partner` liefert das Partnerfenster für file:// (opener bzw. geöffnetes Fenster);
 * `onMessage` bekommt bei postMessage die Quelle mit, damit sich die Präsentation das Fenster merken kann.
 */
export function openLink(partner: () => Window | null | undefined, onMessage: (msg: PresenterMessage, source: Window | null) => void): PresenterLink {
  if (usesChannel()) {
    // pro Deck-Pfad ein Kanal, damit sich zwei Decks auf demselben Server nicht stören
    const channel = new BroadcastChannel(`hashmark-presenter:${location.pathname}`)
    channel.onmessage = (e) => { if (isPresenterMessage(e.data)) onMessage(e.data, null) }
    return { send: (msg) => channel.postMessage(msg), close: () => channel.close(), channel: true }
  }
  const handler = (e: MessageEvent) => {
    if (isTrusted(e, partner())) onMessage(e.data as PresenterMessage, e.source as Window | null)
  }
  window.addEventListener('message', handler)
  return { send: (msg) => send(partner(), msg), close: () => window.removeEventListener('message', handler), channel: false }
}

/** Tasten, die die Presenter-View an die Präsentation weiterreicht */
export const FORWARDED_KEYS = new Set([
  'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', ' ', 'PageDown', 'PageUp', 'Enter', 'Escape', 'Home', 'b', 'B', '.',
])
