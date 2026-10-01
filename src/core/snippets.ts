// Bausteine für Slash-Menü, Kommandopalette und Tastaturleiste. `§` markiert die Cursorposition nach dem Einfügen.

export interface Snippet {
  label: string
  /** Kurzbeschreibung (Tooltip, Vorschlagsliste) */
  title: string
  text: string
  /** Gruppe in der Vorschlagsliste */
  kind: 'Struktur' | 'Layout' | 'Inhalt' | 'Sprecher'
  /** zusätzliche Suchwörter */
  keywords?: string
}

export const SNIPPETS: Snippet[] = [
  { label: 'Kapitel', kind: 'Struktur', keywords: 'h1 überschrift ebene', title: 'Neues Kapitel (Ebene 1, Hauptpfad)', text: '\n# §Kapitel\n\n' },
  { label: 'Detail', kind: 'Struktur', keywords: 'h2 unterfolie ebene', title: 'Detail-Folie (Ebene 2, per ↓ erreichbar)', text: '\n## §Detail\n\n' },
  { label: 'Neue Folie', kind: 'Struktur', keywords: 'trenner slide sub ---', title: 'Sub-Slide: neue Folie im selben Knoten', text: '\n---\n\n§' },
  {
    label: 'Zwei Spalten', kind: 'Layout', keywords: 'two-col col',
    title: 'Layout two-col mit zwei Spalten',
    text: '\n## §Titel {layout=two-col}\n\n::: col\n- Punkt\n:::\n\n::: col\nRechte Spalte\n:::\n\n',
  },
  { label: 'Statement', kind: 'Layout', keywords: 'kernaussage', title: 'Kernaussage groß und mittig', text: '\n## §Kernaussage {layout=statement}\n\n' },
  {
    label: 'Bild rechts', kind: 'Layout', keywords: 'image-right image-left bild',
    title: 'Layout image-right: erstes Bild rechts, Text links (image-left umgekehrt)',
    text: '\n## §Titel {layout=image-right}\n\n![Bild](bilder/bild.png)\n\n- Punkt\n\n',
  },
  { label: 'Agenda', kind: 'Layout', title: 'Agenda aus den Kapiteln des Hauptpfads, aktuelles hervorgehoben', text: '\n# §Agenda {layout=agenda}\n\n' },
  {
    label: 'Drei Spalten', kind: 'Layout', keywords: 'columns cols',
    title: 'Spalten mit fester Anzahl oder Verhältnis, z. B. cols="2:1"',
    text: '::: columns cols=3\n::: col\n§Eins\n:::\n::: col\nZwei\n:::\n::: col\nDrei\n:::\n:::\n',
  },
  { label: 'Schritte', kind: 'Inhalt', keywords: 'steps liste', title: 'Liste, die Punkt für Punkt erscheint', text: '::: steps\n- §Erstens\n- Zweitens\n- Drittens\n:::\n' },
  {
    label: 'Code', kind: 'Inhalt',
    title: 'Codeblock; steps="1|2" lässt Zeilen schrittweise erscheinen',
    text: '```ts {title="datei.ts" steps="1|2"}\n§const a = 1\nconst b = 2\n```\n',
  },
  {
    label: 'Mermaid', kind: 'Inhalt', keywords: 'diagramm',
    title: 'Mermaid-Diagramm, wächst mit %% step',
    text: '```mermaid\nflowchart LR\n  A[§Start]\n%% step\n  A --> B[Ziel]\n```\n',
  },
  { label: 'Hinweis', kind: 'Inhalt', keywords: 'note tip warning callout', title: 'Hinweiskasten: [!NOTE] [!TIP] [!IMPORTANT] [!WARNING] [!CAUTION]', text: '> [!NOTE]\n> §Text\n' },
  { label: 'Kacheln', kind: 'Inhalt', keywords: 'children', title: 'Kinder des Knotens als klickbare Kacheln', text: '::: children\n:::\n§' },
  { label: 'Notizen', kind: 'Sprecher', keywords: 'notes sprecher', title: 'Sprechernotizen (erscheinen nicht auf der Folie); ::: notes step=2 gilt ab Schritt 2', text: '::: notes\n§\n:::\n' },
]

/**
 * Text ohne Marker, Cursor-Offset und Länge des Platzhalterworts direkt hinter `§` (wird markiert,
 * damit das Tippen es ersetzt; `§Titel {…}` markiert „Titel“, `§` allein nichts).
 */
export function expand(text: string): { text: string; cursor: number; select: number } {
  const cursor = text.indexOf('§')
  if (cursor < 0) return { text, cursor: text.length, select: 0 }
  const rest = text.slice(cursor + 1)
  const select = rest.match(/^[\p{L}\p{N}-]+/u)?.[0].length ?? 0
  return { text: text.replace('§', ''), cursor, select }
}
