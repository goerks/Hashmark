// Zwischenmodell des PPTX-Exports: der Browser beschreibt jede Druckseite (1280 × 720 px) mit diesen Objekten,
// `build.ts` macht daraus Folien. Alle Maße in Bühnen-Pixeln (1 px = 1/96 Zoll), Schriftgrößen in pt.

export interface Run {
  text: string
  font: string
  /** Schriftgröße in pt */
  size: number
  /** RRGGBB, Transparenz bereits mit dem Hintergrund verrechnet */
  color: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** Link: `https://…`, `mailto:…` oder `#knoten-id` (Querverweis auf eine Folie) */
  href?: string
  /** Zeichenabstand in pt */
  spacing?: number
  /** Markierung hinter dem Text (Inline-Code) */
  highlight?: string
  baseline?: 'super' | 'sub'
}

export interface Bullet {
  type: 'bullet' | 'number'
  /** Zeichen für Aufzählungspunkte (Unicode-Code, vier Hexziffern) */
  code?: string
  start?: number
  /** Farbe des Aufzählungspunkts (RRGGBB) */
  color?: string
  /** Ebene, 0 = oberste */
  level: number
  /** Einzug des Textes in px */
  indent: number
}

export interface Para {
  runs: Run[]
  align: 'left' | 'center' | 'right' | 'justify'
  /** Zeilenhöhe in pt */
  lineHeight: number
  /** Abstand davor/danach in pt */
  before: number
  after: number
  bullet?: Bullet
  /** erscheint mit diesem Schritt (Klick), nur gesetzt, wenn später als das Element selbst */
  from?: number
}

export interface Box { x: number; y: number; w: number; h: number }

/** Animation: erscheint mit Klick `from`, verschwindet mit Klick `until` (fehlt = immer bzw. nie) */
export interface Timing { from?: number; until?: number }

export interface TextItem extends Box, Timing {
  kind: 'text'
  paras: Para[]
  /** false: einzeilig, PowerPoint soll nicht umbrechen */
  wrap: boolean
  /** Name für die Auswahlliste (z. B. „Titel“, „Code“) */
  name?: string
  /** Titel der Folie: wird der Titel-Platzhalter (Gliederungsansicht, Folienübersicht, Barrierefreiheit) */
  title?: boolean
}

export interface PictureItem extends Box, Timing {
  kind: 'picture'
  /** Schlüssel in `media` */
  media: string
  alt?: string
  link?: string
}

/** Bereich, der als Bild eingefügt wird (Diagramme, SVG, runde Bilder …); das PNG liefert der Orchestrator */
export interface RasterItem extends Box, Timing {
  kind: 'raster'
  id: number
  alt?: string
  name?: string
  /** Dekoration, die in der Seite über einem Bild liegt (Sprechblase, Rahmen): ohne Text, mit durchsichtigem Grund */
  overlay?: boolean
}

export interface TableCell {
  paras: Para[]
  fill?: string
  /** oben, rechts, unten, links: Breite in pt und Farbe, `null` = keine Linie */
  borders: ({ pt: number; color: string } | null)[]
  /** Innenabstand oben, rechts, unten, links in pt */
  margin: number[]
  valign: 'top' | 'middle' | 'bottom'
  colspan?: number
  rowspan?: number
}

export interface TableItem extends Box, Timing {
  kind: 'table'
  /** Spaltenbreiten und Zeilenhöhen in px */
  cols: number[]
  rows: { h: number; cells: TableCell[] }[]
}

export type Item = TextItem | PictureItem | RasterItem | TableItem

export interface PageData {
  /** ID des Knotens (Anker) */
  id: string
  sub: number
  step: number
  title: string
  /** Titel des obersten Kapitels, für Abschnitte in PowerPoint */
  section: string
  depth: number
  items: Item[]
  /** Übergang zu dieser Folie: slide | zoom | fade | none */
  transition?: string
  notes: string
  /** Hintergrund ohne Dekoration: eine Farbe reicht, sonst kommt ein Bild unter den Text */
  solidBg: boolean
  bgColor: string
}

export interface Extracted {
  pages: PageData[]
  /** Bilddaten (Data-URL) je Schlüssel */
  media: Record<string, string>
}
