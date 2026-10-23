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

/**
 * Rolle eines Knotens im Vortrag: `path` läuft Space ab, `optional` erreicht man per ↓ (bei Zeit oder Fragen),
 * `appendix` nur über Suche oder Übersicht (kommt im Handout als eigener Teil).
 */
export type PlanState = 'path' | 'optional' | 'appendix'

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
  /** Nummer der ersten Folie dieses Knotens (Baumreihenfolge, 1-basiert); Sub-Slide k trägt slideNo + k */
  slideNo?: number
  /** Fußzeile dieses Knotens (aus deck.yaml `footer`/`slideNumber`); `{n}` setzt die Runtime ein, `{total}` ist schon ersetzt */
  footer?: { text?: string; number?: string }
  /** wirksames Layout (Attribut, sonst `layouts` je Ebene, sonst Deck-Default) – setzt `loadDeck` */
  layout?: string
  /** geplante Redezeit in Sekunden (`{duration=5m}`) */
  duration?: number
  /** Standard des Autors (`{optional}`, `{appendix}`, `{plan=path}`); die Wahl des Vortragenden überschreibt ihn */
  plan?: PlanState
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
  /** Videos im Einzel-HTML-Export einbetten (bis 25 MB je Datei); sonst liegen sie in einem Ordner neben der Datei */
  embedMedia?: boolean
  /** alle Bilder lassen sich in der Präsentation mit Z vergrößern (einzeln abwählen mit `{zoom=off}`) */
  zoom?: boolean
  layout?: string
  /** Default-Layout je Ebene, z. B. `{ 1: section, 2: default }` */
  layouts?: Record<string, string>
  /** geplante Gesamtdauer, z. B. `30m` */
  duration?: string | number
  /** Fußzeile auf jeder Folie (außer mit `{footer=off}`), z. B. `Acme Academy` */
  footer?: string
  /** Folienzahl: `true` = nur die Zahl, sonst Vorlage wie `Seite {n} / {total}` */
  slideNumber?: boolean | string
  mount?: MountEntry[]
}

export interface MountEntry {
  file: string
  /** Pfad zu einem bestehenden Knoten, z. B. "Architektur > Backend" */
  under?: string
}
