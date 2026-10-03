// Wortschatz der Hashmark-Syntax für Editor-Vorschläge und Linter. Die Listen der Laufzeit (check.ts) bleiben die Quelle.

import { BUILTIN_LAYOUTS, KNOWN_ATTRS, TRANSITIONS } from './check.ts'

export { BUILTIN_LAYOUTS, KNOWN_ATTRS, TRANSITIONS }

export const LAYOUT_INFO: Record<string, string> = {
  title: 'Titelfolie, groß und mittig',
  section: 'Kapitelfolie mit Kacheln der Kinder',
  default: 'Überschrift und Inhalt',
  'two-col': 'Zwei Spalten',
  'three-col': 'Drei Spalten',
  statement: 'Kernaussage, groß und mittig',
  quote: 'Zitat',
  'image-left': 'Bild links, Text rechts',
  'image-right': 'Bild rechts, Text links',
  agenda: 'Agenda aus den Kapiteln',
  comparison: 'Gegenüberstellung',
  'code-focus': 'Code im Mittelpunkt',
  banner: 'Bildband oben (banner=…), Titel und Inhalt darunter',
}

export const CONTAINER_INFO: Record<string, { detail: string; text: string }> = {
  col: { detail: 'Eine Spalte', text: '::: col\n§Text\n:::\n' },
  columns: { detail: 'Spalten nebeneinander', text: '::: columns cols=2\n::: col\n§Links\n:::\n::: col\nRechts\n:::\n:::\n' },
  grid: { detail: 'Raster mit cols= und gap=', text: '::: grid cols=3 gap=1rem\n§\n:::\n' },
  steps: { detail: 'Liste Punkt für Punkt einblenden', text: '::: steps\n- §Erstens\n- Zweitens\n:::\n' },
  notes: { detail: 'Sprechernotizen', text: '::: notes\n§\n:::\n' },
  children: { detail: 'Kacheln der Kinder', text: '::: children\n:::\n§' },
  reveal: { detail: 'Beliebigen Block ab Schritt n einblenden', text: '::: reveal step=1\n§Text\n:::\n' },
  figure: { detail: 'Bild mit frei platzierten Beschriftungen', text: '::: figure\n![§Bild](bilder/bild.png)\n\n::: bubble at="60,20" tail=left\nBeschriftung\n:::\n:::\n' },
  bubble: { detail: 'Sprechblase in einer Figur (at, w, tail, step)', text: '::: bubble at="50,20" w=30 tail=down\n§Text\n:::\n' },
  frame: { detail: 'Hervorhebungsrahmen in einer Figur (at, size, label)', text: '::: frame at="10,10" size="30,20" label="§Titel"\n:::\n' },
  pin: { detail: 'Nummerierte Markierung in einer Figur', text: '::: pin at="50,50"\n§1\n:::\n' },
  cards: { detail: 'Karten im Raster (cols, steps)', text: '::: cards cols=3\n::: card icon=star title="§Titel"\nText\n:::\n:::\n' },
  card: { detail: 'Karte mit Icon und Titel', text: '::: card icon=star title="§Titel"\nText\n:::\n' },
  table: { detail: 'Tabelle mit Spaltenbreiten, Schritten und Hervorhebung', text: '::: table widths="2:1:1" steps=rows\n| A | B | C |\n| --- | --- | --- |\n| §1 | 2 | 3 |\n:::\n' },
}
export const CONTAINERS = Object.keys(CONTAINER_INFO)

export const ATTR_INFO: { label: string; detail: string; insert: string; chain?: boolean }[] = [
  { label: 'layout=', detail: 'Layout dieser Folie wählen', insert: 'layout=', chain: true },
  { label: 'steps', detail: 'Liste automatisch schrittweise einblenden', insert: 'steps' },
  { label: 'fit', detail: 'Inhalt automatisch einpassen', insert: 'fit' },
  { label: 'optional', detail: 'Nur bei Zeit oder Fragen (Space überspringt, ↓ taucht ab)', insert: 'optional' },
  { label: 'appendix', detail: 'Anhang: nur über Suche oder Übersicht erreichbar', insert: 'appendix' },
  { label: 'plan=', detail: 'Rolle im Vortrag: path, optional oder appendix', insert: 'plan=', chain: true },
  { label: 'id=', detail: 'Eigene Sprungmarke', insert: 'id=' },
  { label: 'banner=', detail: 'Bildband am oberen Rand (mit layout=banner)', insert: 'banner=' },
  { label: 'bannerh=', detail: 'Höhe des Bildbands in px, z. B. 240', insert: 'bannerh=240' },
  { label: 'bannerpos=', detail: 'Ausschnitt des Bildbands, z. B. "50% 30%"', insert: 'bannerpos=' },
  { label: 'footer=off', detail: 'Fußzeile auf dieser Folie ausblenden', insert: 'footer=off' },
  { label: 'bg=', detail: 'Hintergrund: Farbe, Verlauf oder Bild', insert: 'bg=' },
  { label: 'bgdim=', detail: 'Bild abdunkeln, z. B. 0.5', insert: 'bgdim=0.5' },
  { label: 'duration=', detail: 'Zeitplan, z. B. 5m', insert: 'duration=5m' },
  { label: 'transition=', detail: 'Übergang zu dieser Folie', insert: 'transition=', chain: true },
  { label: '.klasse', detail: 'CSS-Klasse anhängen', insert: '.klasse' },
]

export const CALLOUTS: [string, string][] = [
  ['NOTE', 'Information'], ['TIP', 'Tipp'], ['IMPORTANT', 'Wichtig'], ['WARNING', 'Warnung'], ['CAUTION', 'Vorsicht'],
]

export const CODE_LANGS: [string, string][] = [
  ['ts', 'TypeScript'], ['js', 'JavaScript'], ['mermaid', 'Diagramm'], ['qr', 'QR-Code'], ['bash', 'Shell'], ['yaml', 'deck.yaml'],
  ['json', 'JSON'], ['css', 'Theme-CSS'], ['html', 'HTML'], ['python', 'Python'], ['md', 'Markdown'],
]

/** Kleinschreibung ohne Akzente/Umlaute, für die Suche */
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = t
    }
  }
  return d[b.length]
}

/** Ähnlichstes Wort (Abstand ≤ 2), sonst undefined – für „Meintest du …?“ */
export function nearest(word: string, list: readonly string[]): string | undefined {
  let best: string | undefined
  let bestD = 3
  for (const x of list) {
    const d = distance(word.toLowerCase(), x)
    if (d < bestD) { bestD = d; best = x }
  }
  return best
}
