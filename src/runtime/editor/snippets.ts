// Bausteine für die Werkzeugleiste. `§` markiert die Cursorposition nach dem Einfügen.

export interface Snippet { label: string; title: string; text: string }

export const SNIPPETS: Snippet[] = [
  { label: '# Kapitel', title: 'Neues Kapitel (Ebene 1, Hauptpfad)', text: '\n# §Kapitel\n\n' },
  { label: '## Detail', title: 'Detail-Folie (Ebene 2, per ↓ erreichbar)', text: '\n## §Detail\n\n' },
  { label: '---', title: 'Sub-Slide: neue Folie im selben Knoten', text: '\n---\n\n§' },
  {
    label: 'Zwei Spalten',
    title: 'Layout two-col mit zwei Spalten',
    text: '\n## §Titel {layout=two-col}\n\n::: col\n- Punkt\n:::\n\n::: col\nRechte Spalte\n:::\n\n',
  },
  { label: 'Schritte', title: 'Liste, die Punkt für Punkt erscheint', text: '::: steps\n- §Erstens\n- Zweitens\n- Drittens\n:::\n' },
  {
    label: 'Code',
    title: 'Codeblock; steps="1|2" lässt Zeilen schrittweise erscheinen',
    text: '```ts {title="datei.ts" steps="1|2"}\n§const a = 1\nconst b = 2\n```\n',
  },
  {
    label: 'Mermaid',
    title: 'Mermaid-Diagramm, wächst mit %% step',
    text: '```mermaid\nflowchart LR\n  A[§Start]\n%% step\n  A --> B[Ziel]\n```\n',
  },
  { label: 'Notizen', title: 'Sprechernotizen (erscheinen nicht auf der Folie); ::: notes step=2 gilt ab Schritt 2', text: '::: notes\n§\n:::\n' },
  { label: 'Hinweis', title: 'Hinweiskasten: [!NOTE] [!TIP] [!IMPORTANT] [!WARNING] [!CAUTION]', text: '> [!NOTE]\n> §Text\n' },
  { label: 'Statement', title: 'Kernaussage groß und mittig', text: '\n## §Kernaussage {layout=statement}\n\n' },
  {
    label: 'Bild rechts',
    title: 'Layout image-right: erstes Bild rechts, Text links (image-left umgekehrt)',
    text: '\n## §Titel {layout=image-right}\n\n![Bild](bilder/bild.png)\n\n- Punkt\n\n',
  },
  { label: 'Agenda', title: 'Agenda aus den Kapiteln des Hauptpfads, aktuelles hervorgehoben', text: '\n# §Agenda {layout=agenda}\n\n' },
  {
    label: 'Drei Spalten',
    title: 'Spalten mit fester Anzahl oder Verhältnis, z. B. cols="2:1"',
    text: '::: columns cols=3\n::: col\n§Eins\n:::\n::: col\nZwei\n:::\n::: col\nDrei\n:::\n:::\n',
  },
  { label: 'Kacheln', title: 'Kinder des Knotens als klickbare Kacheln', text: '::: children\n:::\n§' },
]

/** Text ohne Marker und Cursor-Offset */
export function expand(snippet: Snippet): { text: string; cursor: number } {
  const cursor = snippet.text.indexOf('§')
  return { text: snippet.text.replace('§', ''), cursor: cursor < 0 ? snippet.text.length : cursor }
}
