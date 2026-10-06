// Brücke zur Desktop-App (Go-Hülle). Der Server der App liefert die Seiten mit `window.__HASHMARK_DESKTOP__`
// aus (Vite-Plugin, Option `desktop`). Aktionen gehen per HTTP an den Server (nur localhost, mit Header),
// der sie an die App weiterreicht – die Seiten selbst haben keinen Zugriff auf die Hülle.

declare global {
  interface Window { __HASHMARK_DESKTOP__?: boolean }
}

export function isDesktop(): boolean {
  if (window.__HASHMARK_DESKTOP__) return true
  try {
    return !!window.top?.__HASHMARK_DESKTOP__ // Vorschau-Iframe im Editor
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
  return fetch('/__hashmark/app', {
    method: 'POST',
    headers: { 'X-Hashmark-Editor': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  }).then((r) => r.ok, () => false)
}

// ---------- Optionen fürs Präsentieren (Go-Hülle, nur im Hauptfenster der App) ----------

declare global {
  interface Window {
    hmPresentOptions?: () => Promise<string>
    hmSetPresentOptions?: (json: string) => Promise<string>
    /** Meldung ins Protokoll der App (hashmark.log) */
    hmLog?: (message: string) => Promise<void>
  }
}

/** Ein Bildschirm in Koordinaten des Systems; `index` ist seine Position in der Liste (so wählt ihn die Hülle) */
export interface Screen { index: number; x: number; y: number; w: number; h: number; primary: boolean }

export interface PresentOptions {
  /** Presenter-View beim Präsentieren: automatisch (mit zweitem Bildschirm), immer, nie */
  presenter: 'auto' | 'on' | 'off'
  /** gewählte Bildschirme; -1 = automatisch */
  presentation: number
  presenterScreen: number
  monitors: Screen[]
  /** was „automatisch“ gerade bedeutet */
  effective: { presenter: boolean; presentation: number; presenterScreen: number }
}

/** Gibt es die Optionen? Nur im Hauptfenster der Desktop-App (dort bindet die Hülle die Funktionen). */
export const hasPresentOptions = () => typeof window.hmPresentOptions === 'function'

/**
 * Fehler einer Hülle-Funktion: lesbarer Text für die Seite und eine Zeile im Protokoll der App (hashmark.log),
 * damit sich der Fehler später zurückverfolgen lässt.
 */
function failure(what: string, e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  try { void window.hmLog?.(`Fehler (${what}): ${message}`) } catch { /* ohne Protokoll weiter */ }
  return message
}

/** Die Hülle antwortet mit JSON; bei einem Fehler steht darin `{ "error": "…" }` */
async function callShell(what: string, fn: () => Promise<string>): Promise<{ data?: unknown; error?: string }> {
  try {
    const data = JSON.parse(await fn()) as { error?: unknown }
    if (data && typeof data === 'object' && typeof data.error === 'string') return { error: failure(what, data.error) }
    return { data }
  } catch (e) {
    return { error: failure(what, e) }
  }
}

export async function loadPresentOptions(): Promise<{ options?: PresentOptions; error?: string }> {
  const r = await callShell('Optionen lesen', () => window.hmPresentOptions!())
  return r.error ? { error: r.error } : { options: r.data as PresentOptions }
}

/** Speichert die Wahl; liefert den Fehlertext oder `null` */
export async function savePresentOptions(o: Pick<PresentOptions, 'presenter' | 'presentation' | 'presenterScreen'>): Promise<string | null> {
  const r = await callShell('Optionen speichern', () => window.hmSetPresentOptions!(JSON.stringify({ presenter: o.presenter, presentation: o.presentation, presenterScreen: o.presenterScreen })))
  return r.error ?? null
}
