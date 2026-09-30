// Brücke zur Desktop-App (Tauri). Der Server der App liefert die Seiten mit `window.__STRATA_DESKTOP__`
// aus (Vite-Plugin, Option `desktop`). Aktionen gehen per HTTP an den Server (nur localhost, mit Header),
// der sie an die App weiterreicht – die Seiten selbst haben keinen Zugriff auf Tauri.

declare global {
  interface Window { __STRATA_DESKTOP__?: boolean }
}

export function isDesktop(): boolean {
  if (window.__STRATA_DESKTOP__) return true
  try {
    return !!window.top?.__STRATA_DESKTOP__ // Vorschau-Iframe im Editor
  } catch {
    return false
  }
}

/** Aktionen der App: Präsentation starten, Presenter öffnen, PDF speichern, Position melden */
export type DesktopAction =
  | { action: 'present'; hash: string }
  | { action: 'presenter'; hash: string }
  | { action: 'pdf'; query: string }
  | { action: 'position'; hash: string }
  | { action: 'close' }

export function desktopAction(a: DesktopAction): Promise<boolean> {
  return fetch('/__strata/app', {
    method: 'POST',
    headers: { 'X-Strata-Editor': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  }).then((r) => r.ok, () => false)
}
