// Funktionsseiten der Webseite (statische Seiten): acht Rubriken, je eine Seite `funktionen/<id>/` mit Höhepunkten,
// Bildern aus der App, einer echten Folie und Links ins Handbuch. Die Rubriken heißen wie die Themen-Kapitel des
// Handbuchs (docs/themen/). Die Liste SHOTS sagt scripts/make-screenshots.ts, welche Bilder es aufnimmt; fehlt ein Bild
// (lokal ohne Aufnahme), zeigt die Seite stattdessen die echte Folie.

import { cardScript, esc, siteFooter, siteHead, siteNav } from './docs-site.ts'

/** Eine Folie zum Einbetten: Deck (relativ zur Seite der Doku) und Knoten-ID, wie `?card#id` */
export interface CardRef {
  /** `handbuch` oder `beispiele/<deck>` */
  deck: string
  id: string
  /** Sub-Slide, ab 0 */
  slide?: number
  /** fester Schritt; ohne = Endzustand */
  step?: number
}

export interface Highlight {
  title: string
  text: string
  /** kurzer Markdown-Schnipsel */
  md?: string
  /** Bild aus SHOTS */
  shot?: string
  alt?: string
  /** echte Folie, wenn das Bild fehlt (oder statt eines Bildes) */
  card?: CardRef
  /** Knoten im Handbuch für „Mehr dazu“ */
  doc: string
}

export interface Feature {
  id: string
  title: string
  /** eine Zeile für die Karte auf der Startseite */
  short: string
  /** Einleitung der Funktionsseite */
  lead: string
  /** Bild der Karte auf der Startseite */
  thumb: string
  /** echte Folie im Kopf der Seite (mit Schritt-Knopf, wenn sie Schritte hat) */
  card: CardRef
  /** Kapitel im Handbuch */
  doc: string
  highlights: Highlight[]
}

/** Aufnahme für scripts/make-screenshots.ts. `url` ist relativ zur Startseite der Doku. */
export interface Shot {
  name: string
  url: string
  width?: number
  height?: number
  /** JS-Ausdruck, der wahr wird, sobald die Seite fertig ist */
  ready?: string
  /** besondere Aufnahmen: Presenter-View neben der Präsentation, Übersicht per Taste O, Editor über `hashmark edit` */
  kind?: 'page' | 'presenter' | 'overview' | 'editor'
}

const hb = (id: string, step?: number, slide?: number): CardRef => ({ deck: 'handbuch', id, step, slide })
const demo = (id: string, step?: number): CardRef => ({ deck: 'beispiele/hashmark-demo', id, step })
const cardUrl = (c: CardRef) => `${c.deck}/?card${c.step === undefined ? '' : `&step=${c.step}`}#${encodeURI(c.id)}${c.slide ? `:${c.slide + 1}` : ''}`

const MERMAID = 'document.querySelector(".mermaid svg, .mermaid-state svg")'
const CARD = 'document.querySelector(".card-root")?.children.length > 0'
const shotOf = (name: string, card: CardRef, ready = CARD): Shot => ({ name, url: cardUrl(card), ready })

/** Alle Bilder der Webseite. presenter, lesemodus, baum und karten liegen zusätzlich in assets/screenshots (README). */
export const SHOTS: Shot[] = [
  { name: 'presenter.jpg', url: 'handbuch/#lernen/idee/baum', width: 1440, height: 900, kind: 'presenter' },
  { name: 'lesemodus.jpg', url: 'handbuch/?reader', width: 1440, height: 900, ready: 'document.querySelectorAll("section").length > 3' },
  shotOf('baum.jpg', hb('lernen/idee/baum'), MERMAID),
  shotOf('karten.jpg', hb('themen/gestaltung', 9)),
  { name: 'uebersicht.jpg', url: 'beispiele/hashmark-demo/', kind: 'overview' },
  shotOf('code-schritte.jpg', hb('themen/schritte/code-schritte', 2)),
  shotOf('diagramm-schritte.jpg', demo('schritt-für-schritt/diagramm-aufbauen', 2), MERMAID),
  shotOf('drawio.jpg', demo('bilder/drawio-mit-ebenen', 9)),
  shotOf('story-map.jpg', demo('story-map', 3)),
  shotOf('figur.jpg', demo('gestaltung/figur-mit-beschriftungen', 9)),
  shotOf('bildband.jpg', demo('gestaltung/bildband')),
  shotOf('statement.jpg', demo('präsentieren/einfach-gesagt')),
  shotOf('vergleich.jpg', demo('präsentieren/vergleich', 9)),
  shotOf('hinweise.jpg', hb('themen/gestaltung/hinweise')),
  { name: 'theme-titel.jpg', url: 'beispiele/theme-demo/?card', ready: CARD },
  shotOf('theme-tokens.jpg', { deck: 'beispiele/theme-demo', id: 'tokens/die-wichtigsten-tokens' }),
  shotOf('komponenten.jpg', { deck: 'beispiele/komponenten-demo', id: 'so-funktioniert-es/zeitstrahl', step: 9 }),
  shotOf('formeln.jpg', { deck: 'beispiele/formeln-demo', id: 'mathematik/quadratische-gleichung', step: 9 }),
  shotOf('mermaid.jpg', demo('gestaltung/mermaid-theme-klassen-und-skizzenstil'), MERMAID),
  shotOf('qr.jpg', demo('gestaltung/qr-code')),
  { name: 'handout.jpg', url: 'handbuch/?print&notes=1', width: 1280, height: 900, ready: 'document.documentElement.dataset.printReady === "1"' },
  { name: 'editor.jpg', url: 'editor.html', width: 1440, height: 900, kind: 'editor' },
]

export const FEATURES: Feature[] = [
  {
    id: 'navigation', title: 'Baum und Navigation', thumb: 'baum.jpg',
    short: 'Hauptpfad erzählen, bei Fragen abtauchen, mit einer Taste zurück.',
    lead: 'Eine Hashmark-Präsentation ist ein Baum aus Überschriften. Du erzählst den Hauptpfad und entscheidest im Vortrag, wo du ins Detail gehst. Backup-Folien am Ende braucht es nicht mehr.',
    card: hb('lernen/idee/baum'), doc: 'themen/navigation',
    highlights: [
      { title: 'Ein Baum statt einer Folienliste', text: 'Jede Überschrift ist ein Knoten. → geht auf der Ebene weiter, ↓ ins Detail, ↑ zurück an die Stelle, von der du kamst.', md: '# Architektur\n## Parser\n## Runtime', shot: 'baum.jpg', alt: 'Folie mit dem Baum einer Präsentation als Diagramm', card: hb('lernen/idee/baum'), doc: 'themen/navigation/hauptpfad' },
      { title: 'Ausflug mit Rückweg', text: 'Optionale Details überspringt die Leertaste. Wer abtaucht, macht einen Ausflug: Am Ende führt Space von selbst zur Abzweigung zurück.', md: '## Mehr dazu {optional}', card: hb('themen/navigation/ausflug', 3), doc: 'themen/navigation/ausflug' },
      { title: 'Übersicht und Suche', text: 'O zeigt den ganzen Baum als Miniaturen, Strg+K findet jede Folie nach Titel und Text. Ein Klick springt hin.', shot: 'uebersicht.jpg', alt: 'Übersicht aller Folien des Beispiel-Decks', card: hb('themen/navigation/suche'), doc: 'themen/navigation/suche' },
      { title: 'Links auf jede Folie', text: 'Jeder Knoten hat eine Adresse. Damit verlinkst du eine Folie aus dem Text, aus einer Mail oder aus dem Lesemodus.', md: 'Siehe [die Architektur](#architektur).', shot: 'lesemodus.jpg', alt: 'Lesemodus: der Baum als Inhaltsverzeichnis, daneben Text und Folien', card: hb('themen/navigation/deep-links'), doc: 'themen/navigation/deep-links' },
    ],
  },
  {
    id: 'schritte', title: 'Schritte und Animationen', thumb: 'code-schritte.jpg',
    short: 'Listen, Code, Diagramme und Zeichnungen bauen sich Schritt für Schritt auf.',
    lead: 'Inhalte erscheinen nacheinander, genau wenn du sie erklärst. Das geht mit Listen, Codezeilen, Diagrammen, Formelteilen, Bildern, Tabellen und den Ebenen deiner Zeichnungen. Beim Export nach PowerPoint werden daraus echte Animationen.',
    card: hb('themen/schritte'), doc: 'themen/schritte',
    highlights: [
      { title: 'Listen Punkt für Punkt', text: 'Ein Container oder ein Wort an der Überschrift genügt. Jeder Punkt wird ein Schritt, → zeigt den nächsten.', md: '::: steps\n- Erst das Problem\n- Dann die Idee\n:::', card: hb('themen/schritte', 2), doc: 'themen/schritte/listen-schritte' },
      { title: 'Code Zeile für Zeile', text: 'Abschnitte im Code erscheinen nacheinander oder werden hervorgehoben, der Rest bleibt als Gerüst stehen.', md: '```ts {steps="1|2|3"}', shot: 'code-schritte.jpg', alt: 'Codeblock, der sich Zeile für Zeile aufbaut', card: hb('themen/schritte/code-schritte', 2), doc: 'themen/schritte/code-schritte' },
      { title: 'Diagramme wachsen', text: 'Eine Zeile %% step im Mermaid-Code, und das Diagramm entsteht im Vortrag. Gleiche Nummer heißt gleichzeitig, auch über Liste und Code hinweg.', md: '%% step', shot: 'diagramm-schritte.jpg', alt: 'Diagramm, das sich neben einer Liste aufbaut', doc: 'themen/schritte/diagramm-schritte' },
      { title: 'Zeichnungen mit Ebenen', text: 'draw.io-Ebenen, Excalidraw-Gruppen und SVG-Elemente werden zu Schritten. Du zerlegst nichts von Hand.', md: '![](architektur.drawio.svg){steps=layers}', shot: 'story-map.jpg', alt: 'User Story Map aus Excalidraw, Gruppe für Gruppe eingeblendet', doc: 'themen/schritte/svg-schritte' },
      { title: 'Übergänge und Kamerafahrt', text: 'Die Übergänge folgen dem Baum: seitlich weiter, in die Tiefe hinab. Z fährt die Kamera auf ein Bild, einen Codeblock oder ein Diagramm.', md: '## Demo {transition=zoom}', card: hb('themen/schritte/bild-zoom'), doc: 'themen/schritte/uebergaenge' },
    ],
  },
  {
    id: 'gestaltung', title: 'Layouts und Gestaltung', thumb: 'figur.jpg',
    short: '17 Layouts, Karten, Figuren, fertige Bausteine wie Pipeline und Zeitplan, Hinweiskästen.',
    lead: 'Ein Wort an der Überschrift ordnet die Folie. Karten, Figuren, Tabellen und Hinweiskästen schreibst du als Markdown, ohne zu zeichnen. Alles lässt sich schrittweise einblenden.',
    card: hb('themen/gestaltung', 0), doc: 'themen/gestaltung',
    highlights: [
      { title: 'Layouts mit einem Wort', text: 'Titel, Kapitel, Aussage, Zitat, Spalten, Vergleich, Bild links oder rechts, Bildband, Code im Fokus: 17 Layouts sind eingebaut.', md: '## Kernaussage {layout=statement}', shot: 'statement.jpg', alt: 'Folie im Layout statement mit großer Aussage', doc: 'themen/gestaltung/layouts' },
      { title: 'Karten mit Icons', text: 'Kacheln mit Icon und Titel, im Raster, auf Wunsch nacheinander.', md: '::: cards cols=2\n::: card icon=target title="Ziele"', shot: 'karten.jpg', alt: 'Folie mit vier Karten mit Icons', card: hb('themen/gestaltung', 9), doc: 'themen/gestaltung/karten' },
      { title: 'Figuren mit Beschriftungen', text: 'Sprechblasen, Rahmen und nummerierte Marker auf ein Bild setzen, in Prozent positioniert, schrittweise.', md: '::: bubble at="40,5" tail=down step=2', shot: 'figur.jpg', alt: 'Bild mit Rahmen, Sprechblase und Marker', doc: 'themen/gestaltung/figuren' },
      { title: 'Vergleich und Bildband', text: 'Zwei Seiten gegenüberstellen oder ein Foto als Band über die Folie legen.', md: '## Vorher und nachher {layout=comparison}', shot: 'vergleich.jpg', alt: 'Folie im Layout comparison', doc: 'themen/gestaltung/bilder' },
      { title: 'Fertige Bausteine', text: 'Pipeline, Statusautomat, Zeitplan, Checkliste, Kennzahlen und mehr: wenige Angaben im Markdown, die Grafik entsteht von selbst, auch Prozent und Anteile.', md: '::: pipeline title="Release" summary\n::: stage label="Bauen" state=done', card: hb('themen/gestaltung/bausteine'), doc: 'themen/gestaltung/bausteine' },
      { title: 'Hinweiskästen und Auto-Fit', text: 'Tipp, Wichtig und Achtung in der Schreibweise von GitHub. Eine volle Folie passt sich mit {fit} an.', md: '> [!TIP]\n> Kurz und klar.', shot: 'hinweise.jpg', alt: 'Folie mit zwei Hinweiskästen', card: hb('themen/gestaltung/hinweise'), doc: 'themen/gestaltung/hinweise' },
    ],
  },
  {
    id: 'themes', title: 'Themes und Firmen-Look', thumb: 'theme-titel.jpg',
    short: 'Farben und Schriften als Tokens, eigene Layouts und Komponenten für die Firma.',
    lead: 'Aussehen und Inhalt sind getrennt. Ein Theme legt Farben, Schriften und Layouts fest, die Folien bleiben unverändert. Zwei Themes sind eingebaut, ein Firmen-Look entsteht in wenigen Zeilen.',
    card: { deck: 'beispiele/theme-demo', id: 'tokens/die-wichtigsten-tokens' }, doc: 'themen/themes',
    highlights: [
      { title: 'Hell oder dunkel, eingebaut', text: 'minimal und dark-tech. Diagramme, Code-Farben und Hinweiskästen übernehmen das Theme von selbst.', shot: 'theme-titel.jpg', alt: 'Titelfolie im Firmen-Theme des Beispiels', doc: 'themen/themes' },
      { title: 'Firmen-Look in wenigen Zeilen', text: 'Ein eingebautes Theme erweitern und einzelne Tokens überschreiben: Akzentfarbe, Schrift, Rundung.', md: 'theme:\n  extends: minimal\n  tokens:\n    color-accent: "#e30613"', shot: 'theme-tokens.jpg', alt: 'Folie über Design-Tokens im Firmen-Theme', doc: 'themen/themes/tokens' },
      { title: 'Eigene Layouts', text: 'Ein Layout ist eine CSS-Datei mit .layout-<name>. Auf der Folie setzt du nur noch {layout=kpi}.', md: '.layout-kpi .content ul { display: grid; }', doc: 'themen/themes/eigene-layouts', card: { deck: 'beispiele/theme-demo', id: 'eigene-layouts' } },
      { title: 'Komponenten', text: 'Zeitstrahl, Prozess, Kennzahlen, Profilkarte und eigene Bausteine aus HTML-Vorlagen. Fertige Funktionen rechnen und formatieren (Prozent, Summen, Datum), ohne JavaScript und damit sicher.', md: '{{ value | percent:scale }}', shot: 'komponenten.jpg', alt: 'Zeitstrahl aus der Komponente timeline', doc: 'themen/themes/komponenten' },
    ],
  },
  {
    id: 'medien', title: 'Diagramme, Formeln, Medien', thumb: 'formeln.jpg',
    short: 'Mermaid, KaTeX, draw.io, Excalidraw, Code, Video und QR-Codes. Alles offline.',
    lead: 'Was eine technische Präsentation braucht, ist eingebaut: Formeln, Diagramme, Code-Hervorhebung, Videos und QR-Codes. Nichts wird von einem fremden Dienst geladen.',
    card: hb('themen/medien/formeln'), doc: 'themen/medien',
    highlights: [
      { title: 'Formeln', text: 'LaTeX im Satz oder als Block, gesetzt mit KaTeX. Teile einer Formel erscheinen als Schritte.', md: '$$ E = mc^2 $$', shot: 'formeln.jpg', alt: 'Folie mit der Lösungsformel der quadratischen Gleichung', card: hb('themen/medien/formeln', 2), doc: 'themen/medien/formeln' },
      { title: 'Mermaid in den Farben des Themes', text: 'Flussdiagramme, Sequenzen, Zustände und mehr. Klassen wie ok, warn und bad färben Knoten, look=hand zeichnet skizzenhaft.', md: '```mermaid {look=hand}', shot: 'mermaid.jpg', alt: 'Zwei Mermaid-Diagramme, eines im Skizzenstil', doc: 'themen/medien/mermaid' },
      { title: 'draw.io und Excalidraw', text: 'Exportierte Zeichnungen bindest du wie ein Bild ein. Ebenen und Gruppen werden zu Schritten.', md: '![](architektur.drawio.svg){steps=layers}', shot: 'drawio.jpg', alt: 'draw.io-Diagramm mit drei Ebenen', doc: 'themen/medien/zeichnungen' },
      { title: 'Video und QR-Code', text: 'Ein Video schreibst du wie ein Bild, → startet es. Ein QR-Code entsteht aus einer Adresse, ohne externen Dienst.', md: '![Demo](demo.mp4){play=1 start=5s}', shot: 'qr.jpg', alt: 'Folie mit QR-Code', doc: 'themen/medien/video' },
    ],
  },
  {
    id: 'vortrag', title: 'Vortrag und Presenter', thumb: 'presenter.jpg',
    short: 'Notizen, Timer, Zeitplan und Baum auf dem zweiten Bildschirm. Ein Zeitbudget kürzt von selbst.',
    lead: 'Im Vortrag siehst du mehr als dein Publikum: die nächste Folie, deine Notizen, die Zeit und den Baum. Der Vortragsplan legt fest, was die Leertaste zeigt und was nur auf Nachfrage kommt.',
    card: hb('themen/vortrag/plan'), doc: 'themen/vortrag',
    highlights: [
      { title: 'Presenter-View', text: 'Aktuelle und nächste Folie, Notizen in großer Schrift, Uhr, Timer und „voraus“ oder „zurück“ gegen den Plan. Auf dem zweiten Bildschirm, gekoppelt mit der Präsentation.', shot: 'presenter.jpg', alt: 'Presenter-View mit Baum, aktueller und nächster Folie, Notizen und Timer', card: hb('themen/vortrag/presenter'), doc: 'themen/vortrag/presenter' },
      { title: 'Vortragsplan statt Backup-Folien', text: 'Jeder Knoten ist Pfad, Optional oder Anhang. Die Leertaste läuft den Pfad, Optionales kommt nur, wenn du abtauchst.', md: '## Details {optional}\n## Quellen {appendix}', card: hb('themen/vortrag/plan'), doc: 'themen/vortrag/plan' },
      { title: 'Zeitbudget und Fahrpläne', text: 'Ist die Zeit knapp, fällt das Unwichtigste aus dem Pfad. Ein Kurs in mehreren Längen aus einer Quelle: Kurz, Voll, Workshop.', md: '## Architektur {duration=5m}', card: hb('themen/vortrag/fahrplaene'), doc: 'themen/vortrag/zeitbudget' },
      { title: 'Notizen je Schritt', text: 'Notizen schreibst du direkt unter die Folie, auf Wunsch je Schritt. Im Handout stehen sie neben der Folie.', md: '::: notes step=2\nDas sage ich ab Schritt 2.\n:::', card: hb('themen/vortrag/notizen'), doc: 'themen/vortrag/notizen' },
    ],
  },
  {
    id: 'editor', title: 'Editor und App', thumb: 'editor.jpg',
    short: 'Schreiben mit Live-Vorschau und Vorschlägen. App ohne Installer, Webdienst fürs Team.',
    lead: 'Du schreibst wie in einem Texteditor und siehst jede Folie sofort. Die Desktop-App läuft ohne Installer und ohne Konto, der Webdienst bringt Präsentation und Editor ins Netz.',
    card: hb('themen/editor-app/editor-details'), doc: 'themen/editor-app',
    highlights: [
      { title: 'Live-Vorschau', text: 'Links Markdown, rechts die Folie an der Stelle des Cursors. Gespeichert wird von selbst, Bilder ziehst du einfach hinein.', shot: 'editor.jpg', alt: 'Editor: links Markdown, rechts die Vorschau der Folie', card: hb('themen/editor-app/editor-details'), doc: 'themen/editor-app/editor-details' },
      { title: 'Vorschläge und Prüfen', text: '/ öffnet die Bausteine, { die Attribute. Tippfehler sind unterstrichen, „Prüfen“ findet auch Folien, die überlaufen.', md: 'make check DECK=decks/vortrag', card: hb('themen/editor-app/pruefen'), doc: 'themen/editor-app/pruefen' },
      { title: 'Desktop-App ohne Installer', text: 'Ein Ordner je Plattform, entpacken und starten. Editor, Präsentation, Presenter-View und alle Exporte im Menü.', card: hb('themen/editor-app/app'), doc: 'themen/editor-app/app' },
      { title: 'Webdienst fürs Team', text: 'Ein Docker-Image: Präsentation und Editor ohne Anmeldung, beide auf demselben Deck.', md: 'make serve', card: hb('themen/editor-app/webdienst'), doc: 'themen/editor-app/webdienst' },
    ],
  },
  {
    id: 'export', title: 'Export und Weitergabe', thumb: 'handout.jpg',
    short: 'PDF, Handout mit Notizen, bearbeitbares PowerPoint mit Animationen, eine HTML-Datei.',
    lead: 'Aus derselben Quelle entstehen alle Ausgaben, die du brauchst. Für Kollegen, die mit PowerPoint weiterarbeiten, für das Handout zum Mitnehmen und für den Rechner ohne Internet.',
    card: hb('themen/export/powerpoint'), doc: 'themen/export',
    highlights: [
      { title: 'PowerPoint, bearbeitbar', text: 'Text bleibt Text, Code bleibt farbiger Text, Tabellen bleiben Tabellen. Schritte werden Animationen, Übergänge und Notizen kommen mit.', card: hb('themen/export/powerpoint'), doc: 'themen/export/powerpoint' },
      { title: 'PDF und Handout', text: 'Eine Folie je Seite mit Lesezeichen und klickbaren Querverweisen, nur der Hauptpfad oder jeder Schritt. Das Handout setzt die Notizen neben die Folien.', shot: 'handout.jpg', alt: 'Handout: Folien mit Notizen daneben', card: hb('themen/export/pdf'), doc: 'themen/export/pdf' },
      { title: 'Eine HTML-Datei', text: 'Die ganze Präsentation samt Presenter-View in einer Datei. Läuft per Doppelklick, offline, auf jedem Rechner.', card: hb('themen/export/html'), doc: 'themen/export/html' },
      { title: 'Weitergeben, wie es passt', text: 'Per Mail, im Netz der Firma, als statische Seite oder dauerhaft als Webdienst mit Editor.', card: hb('themen/export/weitergeben'), doc: 'themen/export/weitergeben' },
    ],
  },
]

export interface FeatureSiteOptions {
  /** Bilder, die vorhanden sind (Dateinamen in screenshots/) */
  shots: Set<string>
  /** Schritte einer Folie (für den Schritt-Knopf), nach Kartenadresse */
  stepsOf: (c: CardRef) => number
  projectUrl: string
  liveUrl?: string
}

const BASE = '../../'

/** Adresse der echten Folie für ein Bild, das (noch) fehlt: die Karte der Aufnahme selbst, sonst `card` */
export function fallbackUrl(h: { shot?: string; card?: CardRef }): string | undefined {
  const shot = SHOTS.find((s) => s.name === h.shot)
  if (shot && (shot.kind ?? 'page') === 'page' && shot.url.includes('?card')) return shot.url
  return h.card ? cardUrl(h.card) : undefined
}

function visual(h: { shot?: string; alt?: string; card?: CardRef }, o: FeatureSiteOptions, base: string): string {
  if (h.shot && o.shots.has(h.shot)) return `<img class="shot-img" src="${base}screenshots/${esc(h.shot)}" alt="${esc(h.alt ?? '')}" loading="lazy">`
  const url = fallbackUrl(h)
  return url ? `<div class="frame"><iframe title="${esc(h.alt ?? 'Folie')}" loading="lazy" src="${esc(base + url)}"></iframe></div>` : ''
}

/** Karte einer Rubrik (Startseite, Übersicht der Funktionen): Bild oder echte Folie, Titel, eine Zeile */
export function featureCard(f: Feature, o: FeatureSiteOptions, base: string): string {
  const img = o.shots.has(f.thumb)
    ? `<img src="${base}screenshots/${esc(f.thumb)}" alt="" loading="lazy">`
    : `<iframe title="" tabindex="-1" loading="lazy" src="${esc(base + (fallbackUrl({ shot: f.thumb }) ?? cardUrl(f.card)))}"></iframe>`
  return `<a class="fcard" href="${base}funktionen/${f.id}/"><span class="fcard-v">${img}</span><span class="fcard-t"><b>${esc(f.title)}</b><span>${esc(f.short)}</span><u>Ansehen →</u></span></a>`
}

const doc = (base: string, id: string) => `${base}handbuch/?reader#${encodeURI(id)}`

export function featurePage(f: Feature, o: FeatureSiteOptions): string {
  const i = FEATURES.indexOf(f)
  const prev = FEATURES[(i + FEATURES.length - 1) % FEATURES.length]
  const next = FEATURES[(i + 1) % FEATURES.length]
  const steps = o.stepsOf(f.card)
  const card = { ...f.card, step: f.card.step ?? (steps ? 0 : undefined) }
  const rows = f.highlights.map((h) => `
    <div class="hl-row">
      <div class="hl-text">
        <h2>${esc(h.title)}</h2>
        <p>${esc(h.text)}</p>
        ${h.md ? `<pre class="snip">${esc(h.md)}</pre>` : ''}
        <a class="more-link" href="${doc(BASE, h.doc)}">Mehr dazu im Handbuch →</a>
      </div>
      <div class="hl-vis">${visual(h, o, BASE)}</div>
    </div>`).join('')
  return `${siteHead(`${f.title} – Hashmark`, f.short)}
<body>
${siteNav(BASE, 'funktionen', o.liveUrl)}
<nav class="crumbs" aria-label="Pfad"><a href="${BASE}">Start</a> › <a href="${BASE}funktionen/">Funktionen</a> › ${esc(f.title)}</nav>
<header class="fhead">
  <div class="fhead-text">
    <div class="eyebrow">Funktion ${i + 1} von ${FEATURES.length}</div>
    <h1>${esc(f.title)}</h1>
    <p class="lead">${esc(f.lead)}</p>
    <div class="cta"><a class="btn" href="${doc(BASE, f.doc)}">Im Handbuch nachlesen</a><a class="btn ghost" href="${BASE}#download">Hashmark laden</a></div>
  </div>
  <figure class="live">
    <div class="frame"><iframe id="card" title="Echte Folie aus dem Handbuch" src="${esc(BASE + cardUrl(card))}"></iframe></div>
    <figcaption><span>Echte Folie, live gerendert</span>${steps ? `<button type="button" id="stepbtn" data-steps="${steps}">Schritt ▸ 0/${steps}</button>` : ''}</figcaption>
  </figure>
</header>
<section class="hl">${rows}
</section>
<section class="block">
  <div class="morebox">
    <div><b>Alles zu „${esc(f.title)}“</b><p>Vollständige Schreibweise, alle Optionen und Beispiele stehen im Handbuch: im Teil „Themen“ und in den Tabellen unter „Nachschlagen“.</p></div>
    <div class="cta"><a class="btn" href="${doc(BASE, f.doc)}">Kapitel öffnen</a><a class="btn ghost" href="${doc(BASE, 'nachschlagen')}">Nachschlagen</a></div>
  </div>
  <nav class="prevnext" aria-label="Weitere Funktionen"><a href="${BASE}funktionen/${prev.id}/">← ${esc(prev.title)}</a><a href="${BASE}funktionen/${next.id}/">${esc(next.title)} →</a></nav>
</section>
${siteFooter(o.projectUrl)}
${steps ? cardScript(card.id, card.slide ?? 0) : ''}
</body>
</html>
`
}

/** funktionen/index.html: alle Rubriken auf einen Blick */
export function featuresIndexPage(o: FeatureSiteOptions): string {
  const base = '../'
  return `${siteHead('Funktionen – Hashmark', 'Was Hashmark kann: Baum, Schritte, Layouts, Themes, Diagramme, Presenter, Editor und Export.')}
<body>
${siteNav(base, 'funktionen', o.liveUrl)}
<nav class="crumbs" aria-label="Pfad"><a href="${base}">Start</a> › Funktionen</nav>
<section class="block">
  <h1 class="page-title">Was Hashmark kann</h1>
  <p class="lead">Acht Bereiche, je mit eigener Seite, Bildern aus der App und Links ins Handbuch.</p>
  <div class="fgrid">${FEATURES.map((f) => featureCard(f, o, base)).join('')}</div>
</section>
${siteFooter(o.projectUrl)}
</body>
</html>
`
}
