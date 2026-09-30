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
- Neue Layouts: `statement`/`quote`, `image-left`/`image-right`, Hintergrundbild `{bg=…}`, `agenda` (automatisch aus dem Baum), ✅ `comparison` und `code-focus`. Offen: `diagram`.
- Hinweiskästen in GitHub-Syntax `> [!NOTE]`, `[!TIP]`, `[!WARNING]` …
- Kapitel-Nummerierung optional, Fortschritt pro Kapitel.
- ✅ Auto-Fit `{fit}` und Überlauf-Badge (Dev-Server, Editor-Vorschau). Offen: Warnung im Terminal bzw. `strata check` für alle Folien, Miniatur-Hinweis im Presenter.

### Themes

- ✅ Theme v2 (Beispiel `examples/theme-demo`): `theme: { extends, tokens, layouts, css }`, Themes als Ordner (`theme.css` + `layouts/`), eigene Layouts per CSS, Logo/Schriften per `url()` eingebettet. Offen: Hell/Dunkel-Varianten, `extends` zwischen Theme-Ordnern verketten.
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

- **Rust/Tauri bleibt (30.09.2026):** Ein Umbau auf Go wurde erwogen und verschoben, siehe Backlog.

## Backlog: mögliche Refactorings

Nicht eingeplant, nur festgehalten. Jeder Punkt braucht vor dem Start einen kurzen Spike.

### Desktop-App ohne Rust (Go oder Node-only)

Anlass: Der Rust-Teil (`src-tauri/`, ~650 Zeilen) ist nicht beliebt, die Toolchain (Rust + llvm-mingw) ist eine externe Installation, und ein kalter Release-Build dauert 5–14 Minuten. Entschieden am 30.09.2026: Wir bleiben bei Tauri, weil es läuft, getestet ist und sich kaum ändert.

| Option | Werkzeuge | Cross-Compile | Preis |
| --- | --- | --- | --- |
| Go + Wails v3 | ein Go-ZIP, kein C-Compiler unter Windows | Windows von überall, Mac/Linux brauchen cgo | Wails v2 kennt nur ein Fenster (wir brauchen 2–3), v3 war meines Wissens noch Alpha (vorher prüfen), ~650 Zeilen neu schreiben |
| Node-only mit Edge im App-Modus | keine, nur Node | Kopieren genügt | kein natives Menü, Ordnerwahl per PowerShell-Dialog, Edge muss installiert sein (für PDF ohnehin nötig) |

Hinweise für später:
- Die Tests sind von der Fenster-Technik unabhängig: `make app-test` (`scripts/app-e2e.ts`) steuert jede EXE über WebView2-CDP, `make sidecar-smoke` prüft den Node-Teil allein.
- Das Protokoll zwischen Fenster und Sidecar ist klein (`src/desktop/sidecar.ts`, JSON-Zeilen), ein neues Fenster müsste nur das nachbauen.
- Die Programmgröße (233 MB) kommt von Node und den Paketen, nicht von Rust (`Strata.exe` hat 4 MB). Ein Wechsel der Fenster-Technik ändert daran nichts.

### Node aus dem Programm entfernen (Kern in Go oder im WebView)

Erst sinnvoll, wenn Mac oder Linux wirklich gebraucht werden, denn Node ist der eigentliche Hemmschuh beim Cross-Compiling (pro System ein eigenes Node, WebView-Bibliothek je System mit cgo). Voraussetzung ist die Dateisystem-Abstraktion aus Stufe 2. Bringt: kleines Programm (~15 MB), ein Binary pro System, kein Sidecar. Kostet: Parser, Renderer und Export neu oder im WebView (remark, Shiki, Vite-Build laufen heute nur in Node). Wenn, dann zusammen mit dem Wechsel auf Go/Wails.
