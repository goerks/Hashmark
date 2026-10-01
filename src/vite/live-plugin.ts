// Vite-Plugin für die vorgebaute Runtime der Desktop-App („live“): dieselben Seiten wie bei `hashmark dev`,
// aber ohne eingebautes Deck. Das Deck kommt zur Laufzeit als JSON vom Live-Server (src/desktop/live-server.ts),
// das Theme als Stylesheet, Änderungen per Server-Sent Events. So muss die App nie Abhängigkeiten
// vorbündeln (Vite-Dev-Server) – das war unter Windows langsam und scheiterte an gesperrten Dateien.

import type { Plugin } from 'vite'
import { DECK_ID, THEME_ID } from './plugin.ts'

const LIVE_DECK = '\0hashmark-live-deck'
const LIVE_THEME = '\0hashmark-live-theme'

export function hashmarkLive(): Plugin {
  return {
    name: 'hashmark-live',
    enforce: 'pre',
    resolveId(id) {
      if (id === DECK_ID) return LIVE_DECK
      if (id === THEME_ID) return LIVE_THEME
    },
    load(id) {
      // Top-Level-await: die Seiten starten erst, wenn das Deck da ist – wie beim eingebauten Modul
      if (id === LIVE_DECK) {
        return `const res = await fetch('/__hashmark/deck.json', { cache: 'no-store' })\nexport default await res.json()\n`
      }
      // Theme kommt als <link> (siehe unten), damit ein Deck-Wechsel keinen neuen Build braucht
      if (id === LIVE_THEME) return 'export {}\n'
    },
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [
          { tag: 'script', children: 'window.__HASHMARK_DESKTOP__ = true; window.__HASHMARK_LIVE__ = true', injectTo: 'head-prepend' },
          // nach den gebündelten Stylesheets: Theme-Regeln überschreiben base.css wie bei `hashmark dev`
          { tag: 'link', attrs: { rel: 'stylesheet', href: '/__hashmark/theme.css' }, injectTo: 'head' },
        ]
      },
    },
  }
}
