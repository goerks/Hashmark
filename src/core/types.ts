// Kern-Datenmodell: framework-unabhängiger Deck-Baum als JSON.

export interface Slide {
  html: string
  /** Animations-Steps (Phase 3). Im MVP immer leer, aber schon Teil des Modells. */
  steps: Step[]
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
  notes?: string
  children: DeckNode[]
  /** für Editor-Sync */
  source: { file: string; line: number }
}

export interface Deck {
  title: string
  maxDepth: number
  /** Default-Layout, wenn der Knoten keins setzt */
  layout: string
  nodes: DeckNode[]
  /** alle eingelesenen Dateien (für den File-Watcher) */
  files: string[]
}

export interface Manifest {
  title?: string
  theme?: string
  maxDepth?: number
  layout?: string
  mount?: MountEntry[]
}

export interface MountEntry {
  file: string
  /** Pfad zu einem bestehenden Knoten, z. B. "Architektur > Backend" */
  under?: string
}
