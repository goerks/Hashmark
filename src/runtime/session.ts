// Online-Sitzung (Webdienst unter /s/<id>/): Basisadresse der Schnittstellen und Bearbeiten-Token.
// Der Server setzt `window.__HASHMARK_SESSION__` in die Seite. Das Token steht im Link nach `#k=` (Fragment: geht nie
// an den Server, nicht in Protokolle und nicht in den Referer), wird einmal in sessionStorage gemerkt und aus der Adresse entfernt.

declare global {
  interface Window { __HASHMARK_SESSION__?: { id: string; base: string } }
}

export const sessionInfo = () => (typeof window === 'undefined' ? undefined : window.__HASHMARK_SESSION__)

/** Basisadresse der Schnittstellen: leer für das lokale Deck, `/s/<id>` online */
export const apiBase = () => sessionInfo()?.base ?? ''

const KEY = (id: string) => `hashmark:token:${id}`

function readToken(): string | null {
  const s = sessionInfo()
  if (!s) return null
  const m = /(?:^#|&)k=([A-Za-z0-9_-]+)/.exec(location.hash)
  try {
    if (m) {
      sessionStorage.setItem(KEY(s.id), m[1])
      history.replaceState(null, '', location.pathname + location.search)
      return m[1]
    }
    return sessionStorage.getItem(KEY(s.id))
  } catch {
    return m ? m[1] : null
  }
}

const token = readToken()

/** Darf man hier bearbeiten? Lokal immer, online nur mit Bearbeiten-Token. */
export const canEdit = () => !sessionInfo() || !!token

/** Header mit dem Bearbeiten-Token (leer lokal und ohne Token) */
export const authHeaders = (): Record<string, string> => (token ? { 'X-Hashmark-Token': token } : {})
