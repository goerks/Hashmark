// Aktualisierungen des Decks: unter `hashmark dev/edit` per Vite-HMR (Ereignis 'hashmark:deck'),
// in der Desktop-App (vorgebaute Runtime, window.__HASHMARK_LIVE__) per Server-Sent Events vom Live-Server.

import type { Deck } from '../core/types.ts'

export type Payload = { deck: Deck } | { error: string }

declare global {
  interface Window { __HASHMARK_LIVE__?: boolean }
}

/** Ruft `onDeck` bei jeder Änderung auf; `onReload` bei Änderungen, die ein Neuladen brauchen (Theme). */
export function onDeckUpdate(onDeck: (payload: Payload) => void): () => void {
  if (import.meta.hot) {
    import.meta.hot.on('hashmark:deck', onDeck)
    return () => import.meta.hot?.off('hashmark:deck', onDeck)
  }
  if (!window.__HASHMARK_LIVE__) return () => {}
  const events = new EventSource('/__hashmark/events')
  events.addEventListener('deck', (e) => onDeck(JSON.parse((e as MessageEvent).data)))
  events.addEventListener('reload', () => location.reload())
  return () => events.close()
}
