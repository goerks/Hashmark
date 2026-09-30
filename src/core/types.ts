// Kern-Datenmodell: framework-unabhängiger Deck-Baum als JSON.

export interface Slide {
  html: string
  /** Animations-Steps (Phase 3). Im MVP immer leer, aber schon Teil des Modells. */
  steps: Step[]
  /** Sprechernotizen dieser Sub-Slide (HTML); `::: notes step=2` steckt in `[data-note-step]` */
  notes?: string
}

export interface Step {
  selector: string
  state: Record<string, string>
}

export interface DeckNode {
  /** Slug-Pfad, z. B. "architektur/backend" */
  id: string
  title: string
  /** Tiefe im Baum, Ebene 1 = Hauptpfad */
  depth: number
  /** layout, transition, id … aus `{…}` an der Überschrift */
  attrs: Record<string, string>
  /** Sub-Slides (durch `---` getrennt), mindestens eine */
  slides: Slide[]
  /** alle Notizen des Knotens zusammen (Handout); pro Sub-Slide siehe `Slide.notes` */
  notes?: string
  /** wirksames Layout (Attribut, sonst `layouts` je Ebene, sonst Deck-Default) – setzt `loadDeck` */
  layout?: string
  /** geplante Redezeit in Sekunden (`{duration=5m}`) */
  duration?: number
  children: DeckNode[]
  /** für Editor-Sync */
  source: { file: string; line: number }
}

export interface Deck {
  title: string
  maxDepth: number
  /** Default-Layout, wenn der Knoten keins setzt */
  layout: string
  /** geplante Gesamtdauer in Sekunden (deck.yaml: `duration: 30m`) */
  duration?: number
  nodes: DeckNode[]
  /** alle eingelesenen Dateien (für den File-Watcher) */
  files: string[]
}

/** `theme:` als Objekt (Theme v2) */
export interface ThemeConfig {
  /** Basis: `minimal` | `dark-tech` | Pfad zu einer CSS-Datei oder einem Theme-Ordner */
  extends?: string
  /** Design-Tokens, überschreiben die Basis (`accent` = `--accent`; mit `--` wie in CSS) */
  tokens?: Record<string, string | number>
  /** Ordner mit Layout-CSS (`.layout-<name>`), alle `*.css` werden geladen */
  layouts?: string | string[]
  /** weitere CSS-Dateien (Logo, Fußzeile, Schriften …) */
  css?: string | string[]
}

export interface Manifest {
  title?: string
  theme?: string | ThemeConfig
  maxDepth?: number
  /** alle lokalen Bilder als Base64 in den Deck-Baum einbetten */
  embedImages?: boolean
  layout?: string
  /** Default-Layout je Ebene, z. B. `{ 1: section, 2: default }` */
  layouts?: Record<string, string>
  /** geplante Gesamtdauer, z. B. `30m` */
  duration?: string | number
  mount?: MountEntry[]
}

export interface MountEntry {
  file: string
  /** Pfad zu einem bestehenden Knoten, z. B. "Architektur > Backend" */
  under?: string
}
