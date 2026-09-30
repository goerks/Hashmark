# Roadmap: Ausbau nach dem MVP

Stand: 29.09.2026 · Ergebnis des Brainstormings nach dem MVP. Ergänzt das [Konzept](konzept-markdown-praesentations-app.md).

## Ausgangslage

| Bereich | Vorhanden | Lücke |
| --- | --- | --- |
| Themes | `minimal`, `dark-tech`, eigene CSS-Datei mit Tokens | keine Vererbung, kein Corporate (Logo/Fußzeile), kein Hell/Dunkel-Umschalter |
| Übergänge | `slide`, `zoom`, `fade`, `none` (räumlich nach Richtung) | keine Effekte für Schritte, kein Morphing, kein Zoom aus der Kachel |
| Layouts | `title`, `section`, `default`, `two-col`, `::: grid` | wenig Auswahl, keine Vorgaben je Ebene, Titel-Bug auf Ebene ≥ 2 |
| Diagramme | Mermaid inkl. Schritte | keine weiteren Sprachen, keine Plugin-Schnittstelle nach außen |
| Notizen | `::: notes`, `<!-- notes -->` | nur im Handout sichtbar, pro Knoten zusammengefügt |
| Druck | `make pdf`, Ctrl+P, Handout, Lesezeichen, Links | nur 1 Folie pro Seite, kein PPTX |
| Editor | Gliederung (Klick springt), Sync, Bausteine | Gliederung nur lesend, kein Inspector |

## Themen im Einzelnen

### Presenter-Modus (höchste Priorität)

Im Baum entscheidet man live, ob man abtaucht – dafür muss man sehen, welche Details unter der aktuellen Folie liegen.

- Zweites Fenster (Taste `S`) über `window.open` + `postMessage`, funktioniert auch im Single-File-Export (`file://`).
- Inhalt: aktuelle Folie, nächster Schritt bzw. nächste Folie, Notizen (Schrift skalierbar), Uhr, Timer, Mini-Baum mit den Ästen zum Abtauchen.
- Zeitplanung: `## Architektur {duration=5m}` zeigt, ob man im Plan ist.
- Notizen pro Sub-Slide, optional pro Schritt (`::: notes step=2`).
- Ein Bildschirm: Taste `N` blendet Notizen unten ein (zum Üben).
- Später: Publikum folgt live (WebSocket), Laserpointer, Zeichnen.

### Layouts und Styles je Ebene

- Vorgaben je Ebene in `deck.yaml`: `layouts: { 1: section, 2: default }`.
- Spalten: `::: columns cols=3`, `three-col`, Verhältnisse `cols="2:1"`.
- Neue Layouts: `statement`/`quote`, `image-left`/`image-right`, Hintergrundbild `{bg=…}`, `code-focus`, `diagram`, `agenda` (automatisch aus dem Baum), `comparison`.
- Hinweiskästen in GitHub-Syntax `> [!NOTE]`, `[!TIP]`, `[!WARNING]` …
- Kapitel-Nummerierung optional, Fortschritt pro Kapitel.
- Auto-Fit mit Überlauf-Warnung im Editor.

### Themes

- Theme v2: `theme: { extends: minimal, tokens: { --color-accent: "#e30613" } }`, Themes als Ordner (CSS, Logo, Schriften, Layouts).
- Corporate-Theme: Logo, Fußzeile, Farben aus der Konfiguration.
- Hell/Dunkel pro Theme, Taste `T`.
- Lokale Schriften per `@font-face` aus dem Deck/Theme-Ordner (kein CDN).
- Weitere Themes: `high-contrast`, `paper`, `blueprint`, `solarized`.
- Tokens pro Ebene (`--depth-3-*`).

### Animationen

Auf der räumlichen Logik aufbauen (rechts = weiter, unten = tiefer), keine Effekt-Sammlung.

| Feature | Nutzen | Aufwand |
| --- | --- | --- |
| Code-Zeilen hervorheben `lines="3-5\|8"` | hoch | klein |
| Effekte für Schritte (`fade-up`, `dim`, `highlight`) | hoch | klein |
| Zoom aus der Kachel in den Kindknoten | hoch | mittel |
| Auto-Animate über die View Transitions API | hoch | mittel |
| Magic Move für Code (`shiki-magic-move`) | mittel | mittel |
| Mermaid-Morphing zwischen Versionen | mittel | groß |
| `prefers-reduced-motion` beachten | Pflicht | klein |

### Diagrammsprachen

Voraussetzung: Renderer-Schnittstelle `render(code, ctx) → { svg, steps }` mit Pre-Render im Build und Cache per Inhalts-Hash. Theme-Tokens fließen in alle Renderer.

| Sprache | Offline | Empfehlung |
| --- | --- | --- |
| Graphviz/DOT | WASM (`@viz-js/viz`) | früh |
| D2 | WASM (`@terrastruct/d2`, ohne TALA) | früh |
| PlantUML | nur die experimentelle JS-Version (TeaVM) käme infrage | prüfen, sonst gestrichen (kein Java, kein Server) |
| ~~Kroki~~ | braucht Server | gestrichen |
| KaTeX | ja | früh |
| Vega-Lite / ECharts | ja | mittel |
| Markmap | ja | passt zum Baum |
| Excalidraw | ja | später |
| WaveDrom, Nomnoml, Pikchr, BPMN, svgbob | meist JS/WASM | über Plugin-API bzw. Kroki |

### Druck

Großteils umgesetzt. Ergänzungen: Handout 2/3/6 pro Seite, Titelseite mit Baum und Inhaltsverzeichnis, Gliederung als Textdokument, `{print=false}`, PPTX-Export (`pptxgenjs`).

### Editor

Grundsatz: kein WYSIWYG, jede UI-Aktion schreibt Markdown.

- Stufe 1: Inspector für den Knoten unter dem Cursor (Layout, Übergang, Id, Klassen, `hidden`, `duration`), Formular für `deck.yaml`, Autovervollständigung, Diagnose, Schritte in der Vorschau durchspielen, Symbole in der Gliederung.
- Stufe 2: Gliederung als Outliner – Drag & Drop (auch dateiübergreifend), Ebene höher/tiefer, umbenennen.

### Desktop-App

Jetzt die Weichen stellen: Dateisystem-Abstraktion im Kern und Editor-API als Interface statt nur HTTP.

| Option | Größe | Aufwand | Bewertung |
| --- | --- | --- | --- |
| Node SEA (`strata.exe`) | ~95 MB | klein | schneller Zwischenschritt |
| Electron | ~150 MB | mittel | passt zum Node-Stack, PDF über `printToPDF`, PlantUML-JAR als Sidecar |
| Tauri | ~10 MB | groß | Kern muss im Browser laufen oder Node als Sidecar |
| PWA | – | klein | ohne echten Dateizugriff |

Empfehlung: zuerst Node SEA, für die richtige App Electron.

### Weiteres

Suche Ctrl+K, Includes (`!include`, Code aus dem Repo mit Zeilenbereich), `hidden`-Knoten als Reserve, Bild-Zoom, Video/Embeds, `strata check` als Linter, Deck-Vorlagen, VS-Code-Extension, Barrierefreiheit (Alt-Texte, Kontrast).

## Umsetzungsreihenfolge

| Stufe | Inhalt |
| --- | --- |
| **1 · Vortragsreif** ✅ umgesetzt | Presenter-View + Timer, Notizen pro Sub-Slide/Schritt, Code-Zeilen hervorheben, Hinweiskästen, Layouts `statement`/`quote`/`image-left`/`image-right`/`agenda`, `cols=N`, `bg=`, Layouts je Ebene, Suche Ctrl+K, Titel-Bug |
| **2 · Fundament** | Renderer-Plugin-API + Cache, Theme v2 (extends, Tokens, Corporate, Hell/Dunkel), FS-Abstraktion, Editor-Inspector/Autocomplete/Diagnose, Auto-Fit |
| **3 · Inhalte** | Graphviz (WASM), D2 (WASM), KaTeX, PlantUML nur als JS-Version, Includes, Vega-Lite, Markmap, Handout n pro Seite |
| **4 · Animation** | Schritt-Effekte, Zoom aus Kachel, View Transitions, Magic Move, Mermaid-Morph |
| **5 · Editor-Outliner** | Drag & Drop, Ebene höher/tiefer, dateiübergreifend verschieben |
| **6 · Desktop & Verteilung** | Tauri-App ✅ (Node als Sidecar), später ohne Node, PPTX-Export, Publikum folgt live |

Begründung: Stufe 1 macht Strata für echte Vorträge fertig und nutzt, was der Parser schon liefert. Stufe 2 vor Diagrammen, Themes und App, weil sonst jede neue Sprache und später die Desktop-App die heutigen Kopplungen (Vite-Middleware, feste Renderer) umbauen müsste.

## Entscheidungen

- **Zielgruppe (29.09.2026):** vorerst nur eigene Vorträge. Corporate-Theme und PPTX-Export bleiben hinten.
- **Diagrammsprachen (29.09.2026):** nur Engines, die als Bibliothek im Browser bzw. im Build laufen (JS/WASM), ohne externe Installation (kein Java, kein Graphviz-Binary, kein Server). Ohne solche Bibliothek wird die Sprache nicht unterstützt. Damit entfallen Kroki und PlantUML per JAR/Server. PlantUML nur, falls sich die JS-Version (TeaVM) offline bündeln lässt.

- **Desktop (29.09.2026):** Tauri. Eine Electron-Version wurde gebaut und wieder verworfen: Sie war zu groß (Electron allein ~160 MB im Repo, Programm ~510 MB). Große Binärdateien kommen nicht ins Repo.

- **Tauri-Umsetzung (30.09.2026):** Node als Sidecar (vendor/node, Repo wächst nicht), Build ohne Admin mit Rust `gnullvm` + llvm-mingw. Die Crates kommen beim ersten Build aus dem Internet. Später möglich: Kern ganz im WebView (nach der FS-Abstraktion aus Stufe 2), dann ohne Node im Programm.
