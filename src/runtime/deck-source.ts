// Aktualisierungen des Decks: unter `strata dev/edit` per Vite-HMR (Ereignis 'strata:deck'),
// in der Desktop-App (vorgebaute Runtime, window.__STRATA_LIVE__) per Server-Sent Events vom Live-Server.

import type { Deck } from '../core/types.ts'

export type Payload = { deck: Deck } | { error: string }

declare global {
  interface Window { __STRATA_LIVE__?: boolean }
}

/** Ruft `onDeck` bei jeder Änderung auf; `onReload` bei Änderungen, die ein Neuladen brauchen (Theme). */
export function onDeckUpdate(onDeck: (payload: Payload) => void): () => void {
  if (import.meta.hot) {
    import.meta.hot.on('strata:deck', onDeck)
    return () => import.meta.hot?.off('strata:deck', onDeck)
  }
  if (!window.__STRATA_LIVE__) return () => {}
  const events = new EventSource('/__strata/events')
  events.addEventListener('deck', (e) => onDeck(JSON.parse((e as MessageEvent).data)))
  events.addEventListener('reload', () => location.reload())
  return () => events.close()
}
