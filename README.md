# Strata (MVP)

Präsentationen aus 1..n Markdown-Dateien als **navigierbarer Baum**: → erzählt weiter, ↓ taucht ins Detail ab.
Konzept: [konzept-markdown-praesentations-app.md](konzept-markdown-praesentations-app.md)

## Schnellstart

```sh
make setup      # nur beim ersten Mal: Node.js prüfen/holen, Pakete offline installieren
make dev        # http://localhost:3030 – Beispiel-Deck mit Hot Reload
```

Eigenes Deck:

```sh
make new DECK=decks/mein-vortrag
make dev DECK=decks/mein-vortrag
```

| Befehl | Wirkung |
| --- | --- |
| `make setup` | Node.js nach `vendor/node` (falls fehlend) und `npm ci --offline` aus `vendor/npm-cache` |
| `make app` / `make app-package` | Desktop-App (Tauri) bauen und starten bzw. als portables `Strata.exe` packen, siehe „Desktop-App“ |
| `make edit` | Editor mit Live-Vorschau im Browser (`DECK=…`), siehe unten |
| `make dev` / `make dev-open` | Dev-Server mit Hot Reload (`DECK=…`, `PORT=…`) |
| `make build` | Statisches HTML nach `dist/` (`OUT=…`) |
| `make preview` | Gebautes Deck lokal ausliefern |
| `make dev-lan` / `make preview-lan` | Wie `dev` / `preview`, aber im Netzwerk (LAN/VPN) erreichbar |
| `make export` | Eine einzelne HTML-Datei nach `export/<deck>.html`, läuft offline per Doppelklick |
| `make pdf` | PDF nach `export/<deck>.pdf` (Optionen siehe „PDF und Druck“) |
| `make docker` / `make docker-run` | Build und Docker-Image mit nginx (`IMAGE=…`), starten auf `DOCKER_PORT` (8080) |
| `make test` | Tests (Parser, Deck-Baum, Navigator, Layouts, Suche, Zeitplan) |
| `make deps-update` | Pakete online aktualisieren und im Cache ablegen |
| `make clean` / `make distclean` | `dist/` bzw. zusätzlich `node_modules/` löschen |

## Desktop-App (Windows, Tauri)

```sh
make toolchain                    # einmalig: Rust + llvm-mingw (ohne Admin, braucht Internet)
make app                          # bauen und starten: Startseite mit Deck öffnen / neu / Beispiel / zuletzt geöffnet
make app DECK=decks/mein-vortrag  # direkt ein Deck öffnen
make app-package                  # portables Programm: dist-app/Strata/Strata.exe
```

Die App ist ein schlankes Tauri-Fenster (WebView2 aus Windows). Die eigentliche Arbeit macht Strata wie bisher in Node. Die App startet dafür das Node aus `vendor/node` als **Sidecar**.

- **Schnell:** Ein Deck ist in wenigen Sekunden offen, das PDF ist in etwa 5 s fertig. Im Hintergrund wärmt die App schon beim Start auf: Sie lädt den Kern, startet die Code-Hervorhebung und liest das zuletzt geöffnete Deck vorab. Ein Klick darauf öffnet es dann in Millisekunden. Das gepackte Programm bündelt den Node-Teil zu wenigen Dateien, damit auch der allererste Start auf frisch kopierten Dateien (USB-Stick, Virenscanner) schnell ist.
- **Zeiten im Log:** `%APPDATA%app.strata.desktopsidecar.log` zeigt, wo die Zeit bleibt (Aufwärmen, Deck geöffnet in … ms, PDF in … ms).
- **Vorgebaute Runtime:** Die Oberfläche (Präsentation, Editor, Presenter) wird einmal vorgebaut (`runtime-dist/`, nur nach Änderungen an den Quellen). Ein kleiner Live-Server liefert sie aus, zusammen mit dem Deck. Änderungen an den Markdown-Dateien erscheinen sofort, auch bei Bearbeitung in einem anderen Editor. Der Ordner `dist-app/Strata/` lässt sich kopieren und läuft ohne Installation: `Strata.exe` bzw. `Strata.exe <deck-ordner>`.

- **Startseite:** Deck öffnen (Ctrl+O), Neues Deck (Ctrl+N, leeren Ordner wählen oder anlegen), Beispiel-Deck, zuletzt geöffnete Decks.
- **Editor:** derselbe wie bei `make edit`. „Präsentieren ↗“ startet die Präsentation, „PDF“ speichert direkt ein PDF.
- **Präsentieren:** F5 ab der aktuellen Folie, Shift+F5 von vorne.
  - Mit Beamer laufen die Folien dort im Vollbild, die Presenter-View öffnet sich auf dem Hauptbildschirm.
  - Mit nur einem Bildschirm öffnet S die Presenter-View als eigenes Fenster.
  - Ctrl+W beendet die Präsentation, Alt+F4 geht ebenfalls.
- **Export** (Menü Datei): Als HTML-Datei (Ctrl+Shift+E), PDF mit allen Folien (Ctrl+Shift+P), nur Hauptpfad, jeder Schritt eine Seite, Handout mit Notizen. Das PDF entsteht wie bei `make pdf` über Edge headless, direkt vom laufenden Deck, ohne neuen Build.
- **Ansicht:** Editor (Ctrl+1), Präsentation im Fenster (Ctrl+2), Neu laden, Entwicklertools, Vollbild (F11).
- **Sicherheit:**
  - Der interne Server lauscht nur auf 127.0.0.1 mit zufälligem Port.
  - Die Seiten vom Server (Editor, Folien) dürfen keine App-Befehle aufrufen, nur die eigene Startseite.
  - Aktionen wie „Präsentieren“ melden die Seiten per HTTP mit Schutz-Header an den Sidecar.
  - Externe Links öffnen im Standardbrowser.
- **Daten:** zuletzt geöffnete Decks und `sidecar.log` in `%APPDATA%\app.strata.desktop\` (Menü Hilfe → Datenordner).

**Werkzeuge zum Bauen** (nicht im Repo, nur auf dem Entwicklungsrechner):
- Rust über rustup, Toolchain `stable-x86_64-pc-windows-gnullvm`
- [llvm-mingw](https://github.com/mstorsjo/llvm-mingw) in `%LOCALAPPDATA%\strata-toolchain\`, SHA256-geprüft

Visual Studio bzw. Admin-Rechte braucht es nicht. Beim ersten Build lädt cargo die Rust-Bibliotheken (~400 Crates) aus dem Internet nach `%USERPROFILE%\.cargo`, danach geht es offline. Die App selbst bringt keine weiteren Binärdateien ins Repo, Node liegt ohnehin schon in `vendor/node`.

**Tests (alle headless, ohne sichtbare Fenster):**
- `make test` – Unit-Tests
- `make sidecar-smoke` – Node-Teil so, wie die App ihn anspricht (Deck öffnen, Datei-API, App-Aktionen, PDF, Handout, HTML). `SIDECAR_BUNDLE=1` prüft das Bündel.
- `make app-test` – die ganze App: Startseite, Deck öffnen, Editor, Rechte, Präsentation, Presenter, Tasten, Ctrl+W, dazu die Zeiten. Nutzt das gepackte Programm bzw. den Release-Build. `VISIBLE=1` zeigt die Fenster, `node scripts/app-e2e.ts <exe>` testet eine beliebige EXE.

## Alle Abhängigkeiten liegen im Projekt

Es muss nichts global installiert werden:

- `vendor/node/` enthält portables Node.js 24 LTS. Es wurde von nodejs.org geladen und per SHA256 geprüft (`scripts/get-node.ps1`).
- `vendor/npm-cache/` enthält alle npm-Pakete als Tarballs. `make setup` installiert daraus **ohne Internet**, weil `.npmrc` auf diesen Cache zeigt.
- Zur Laufzeit gibt es keine CDNs und keine Web-Fonts. Mermaid und Shiki werden mitgebündelt, Schriften kommen aus dem System.

Voraussetzungen: Windows x64 und GNU Make (z. B. `choco install make`).

## Editor

```sh
make edit                          # Beispiel-Deck
make edit DECK=decks/mein-vortrag  # eigenes Deck
```

Der Browser öffnet `http://localhost:3030/editor.html`:

- **Links** stehen Dateien und Gliederung des Decks, in der Mitte der Markdown-Editor (CodeMirror, mit Hervorhebung, Suchen/Ersetzen Ctrl+F und Undo).
- **Rechts** ist die Live-Vorschau. Jede Änderung wird nach 0,4 s automatisch gespeichert und sofort angezeigt. Ctrl+S speichert direkt.
- **Synchron** (Schalter oben): Die Vorschau zeigt die Folie unter dem Cursor, inklusive Sub-Slide, vollständig aufgedeckt. Umgekehrt scrollt der Editor mit, wenn du in der Vorschau mit den Pfeiltasten oder der Übersicht navigierst.
- **Gliederung:** Ein Klick öffnet die Datei an der Überschrift und zeigt die Folie.
- **Werkzeugleiste:** Bausteine für Kapitel, Detail, Sub-Slide, Zwei Spalten, Schritte, Code, Mermaid, Notizen, Kacheln, Hinweis, Statement, Bild rechts, Agenda und Drei Spalten.
- **Bilder:** *Bild* kopiert die Datei nach `bilder/` und fügt den Link ein. Das geht auch per **Drag & Drop** oder **Einfügen (Ctrl+V)** eines Screenshots. *Bild (Base64)* bettet das Bild direkt in die Markdown-Datei ein, als Referenz am Dateiende.
- **+ Datei** legt eine neue Markdown-Datei an und trägt sie in `deck.yaml` ein. Kommentare dort bleiben erhalten.
- **Präsentieren ↗** öffnet die Präsentation an der aktuellen Folie in einem neuen Tab.
- **Externe Änderungen** (z. B. in VS Code) übernimmt der Editor automatisch, solange er selbst nichts Ungespeichertes hat.

Sicherheit: Die Datei-API existiert nur mit `make edit`. Sie ist nur über localhost erreichbar, schreibt nur innerhalb des Deck-Ordners und nur `.md`/`.yaml` bzw. Bilder. `make dev-lan` hat bewusst keinen Editor.

## PDF und Druck

**Per Befehl** (reproduzierbar, ohne Druckdialog):

```sh
make pdf                          # alle Folien → export/strata-demo.pdf
make pdf DEPTH=1                  # nur Hauptpfad (Kurzfassung)
make pdf STEPS=1                  # jeder Schritt eine eigene Seite
make pdf NOTES=1                  # Handout A4: Folie + Sprechernotizen → export/<deck>-handout.pdf
make pdf DECK=decks/x PDF=vortrag.pdf
```

`make pdf` baut das Deck und druckt es mit dem installierten **Edge oder Chrome** im Headless-Modus. Es braucht keine zusätzliche Software und läuft offline. Einen anderen Browser gibst du mit `BROWSER=pfad` oder der Umgebungsvariable `STRATA_BROWSER` an.

**Im Browser:**

- **Ctrl+P** (oder Menü „Drucken“) direkt in der Präsentation druckt **alle Folien**, eine pro Seite. Im Druckdialog lässt sich unter „Seiten“ ein Bereich wählen, z. B. `5-12`. Die Seitenzahlen stehen unten rechts auf jeder Folie.
- **P** in der Präsentation, der Button **PDF** im Editor oder die URL `?print` öffnen die **Druckansicht mit Optionen** (Tiefe, jeder Schritt eine Seite, Handout, Fußzeile) und danach den Druckdialog.
- Die Folien passen sich jedem Papierformat an (16:9 ist Standard, A4/Letter werden auf die Breite skaliert). Das funktioniert auch im Single-File-Export.

Das PDF hat:
- **Format:** eine Folie pro Seite im Format 16:9 (13,33 × 7,5 Zoll wie PowerPoint), bzw. A4 hoch beim Handout
- **Inhalt:** Folien in Lesereihenfolge (Kapitel, dann seine Details), Schritte vollständig aufgedeckt, Diagramme gerendert
- **Fußzeile:** Breadcrumb und Seitenzahl, abschaltbar mit `footer=0` bzw. `--no-footer`
- **Klickbare interne Links:** Querverweise und Kacheln springen zur Zielfolie im PDF
- **Lesezeichen** nach der Hierarchie des Decks

## Präsentieren: lokal und remote

| Situation | Befehl | Ergebnis |
| --- | --- | --- |
| Am eigenen Laptop, noch am Schreiben | `make dev` | http://localhost:3030, Hot Reload. Im Browser F11 für Vollbild. |
| Am eigenen Laptop, stabile Fassung | `make build` + `make preview` | http://localhost:4173, ohne File-Watcher |
| Auf einem fremden Rechner / USB-Stick / per Mail | `make export` | `export/<deck>.html` per Doppelklick öffnen. Braucht weder Server noch Internet, alles ist eingebettet (~5 MB). |
| Kollegen im selben Netz/VPN öffnen mit | `make dev-lan` oder `make preview-lan` | Vite zeigt die Netzwerk-URL (`Network: http://<ip>:3030/`) |
| Dauerhaft auf einem Server | `make docker` + `make docker-run` | nginx-Container, http://<server>:8080 |
| Beliebiges statisches Hosting (GitLab/GitHub Pages, IIS, S3 …) | `make build` | Inhalt von `dist/` hochladen. Funktioniert auch in Unterverzeichnissen. |

Hinweise:

- **Windows-Firewall:** Beim ersten `*-lan`-Start fragt Windows, ob `node.exe` im Netzwerk lauschen darf.
- **Vertraulichkeit:** Build und Export enthalten den ganzen Deck-Inhalt samt Sprechernotizen im Klartext. Für interne Vorträge nur intern hosten. Für Docker gibt es einen vorbereiteten Basic-Auth-Block in [docker/nginx.conf](docker/nginx.conf).
- **Docker** braucht beim ersten `make docker` Internet, um das Basis-Image `nginx:alpine` zu laden. Das Image enthält nur das gebaute Deck. Gebaut wird vorher lokal mit dem Node aus `vendor/`.
- **CI unter Linux:** `vendor/` enthält nur Windows-Pakete (Node und die nativen Binaries von Vite/Rolldown). Auf einem Linux-Runner braucht es `npm ci` mit Registry-Zugriff. Alternativ lokal bauen und nur `dist/` veröffentlichen.
- **Remote-Vortrag** (Teams/Zoom): Nur das Präsentationsfenster teilen, die Presenter-View (S) bleibt privat. Dass das Publikum der Position live im eigenen Browser folgt, ist noch nicht umgesetzt.

## Presenter-View und Notizen

**S** öffnet die Presenter-View in einem zweiten Fenster, das du auf den eigenen Bildschirm schiebst. Die Präsentation kommt auf den Beamer (F für Vollbild). Beide Fenster bleiben synchron. Das funktioniert mit `make dev`, `make preview` und im Single-File-Export per Doppelklick.

- **Aktuell** (groß) und **Als Nächstes**: das Ziel von Space, also auch der nächste Schritt.
- **Notizen** der aktuellen Sub-Slide. A− / A+ bzw. − / + ändern die Schriftgröße (wird gemerkt).
- **Baum** links: Hauptpfad, entlang der aktuellen Position aufgeklappt, `↓3` = Anzahl Details. Klick springt.
- Unter der Folie: die Details, in die man mit ↓ abtauchen kann (anklickbar), und das Ziel von →.
- **Timer** startet mit der ersten Bewegung. ❚❚/▶ bzw. **T** pausiert, ↺ setzt zurück. Daneben steht die Uhrzeit.
- **Zeitplan:** Mit `duration: 30m` in `deck.yaml` zeigt die Leiste „im Plan“, „2:10 hinter Plan“ bzw. „… voraus“ und die Restzeit. `{duration=5m}` an einer Überschrift gibt dem Kapitel ein eigenes Budget („Architektur: 3:12 / 5:00“, rot bei Überzug).
- Alle Navigationstasten, B (Schwarzbild) und Ctrl+K funktionieren auch in der Presenter-View. Presenter-Fernbedienungen gehen an das Fenster, das den Fokus hat.

**N** blendet die Notizen unten in der Präsentation ein. Das ist zum Üben gedacht, wenn nur ein Bildschirm da ist. Beim Teilen sieht das Publikum sie auch.

```markdown
::: notes
Gilt für die ganze Sub-Slide.
:::

::: notes step=2
Wird in der Presenter-View hervorgehoben, sobald Schritt 2 läuft (spätere Schritte gedämpft).
:::

<!-- notes -->
Alles ab hier bis zum nächsten --- ist ebenfalls Notiz.
```

Notizen gehören zur **Sub-Slide**, in der sie stehen. Das Handout (`make pdf NOTES=1`) druckt sie deshalb neben der richtigen Folie.

## Tastatur

Unten rechts auf jeder Folie zeigt ein **Steuerkreuz**, welche Richtungen möglich sind. Nicht mögliche Richtungen sind ausgegraut. Ein Klick darauf navigiert. Beim Überfahren steht das Ziel daneben („↑ zurück zu Parser“). Darüber steht, wohin **Space** als Nächstes führt, dazu die Position („12 / 32 · Kapitel 4 / 8“). Nach 3 s ohne Maus oder Tasten wird es dezenter. **H** blendet es aus, **?** zeigt alle Tasten.

| Taste | Wirkung |
| --- | --- |
| → / ← | weiter / zurück auf der aktuellen Ebene: Schritte, Sub-Slides, Geschwister, am Ende einer Ebene zum Nachfolger des Elternknotens |
| ↓ / Enter | in den ersten Kindknoten abtauchen |
| ↑ / Esc | zum Elternknoten, an die Stelle, von der aus abgetaucht wurde |
| **Space** / Shift+Space | **der Linie nach**: alles in Lesereihenfolge (Tiefensuche), also Schritte, Sub-Slides, dann die Details, dann das nächste Kapitel; rückwärts derselbe Weg |
| PageDown / PageUp | wie Space / Shift+Space. Das senden **Presenter-Fernbedienungen** („Pointer“) |
| F5 / F | Vollbild an/aus (Play-Taste des Presenters) |
| B / . | Schwarzbild an/aus (Schwarzbild-Taste des Presenters). Jede Bewegung beendet es ebenfalls. |
| **S** | Presenter-View im zweiten Fenster (siehe oben) |
| **N** | Notizen unten einblenden / ausblenden |
| **Ctrl+K** oder **/** | Suche: Titel, Pfad und Folientext; ohne Eingabe ein Inhaltsverzeichnis. ↑ ↓ + Enter springt, Esc schließt |
| H | Steuerkreuz aus-/einblenden |
| ? | Tastenhilfe |
| Home | zum Anfang |
| Ctrl+Shift+O (kurz: O) | Navigations-Übersicht: Hierarchie mit Miniatur jeder Folie; Klick oder Pfeiltasten + Enter springt direkt dorthin, Esc schließt |
| Ctrl+P | alle Folien drucken, Seitenbereich im Dialog wählbar |
| P | Druckansicht mit Optionen (Tiefe, Schritte, Handout) in neuem Tab |

Deep-Links: `#architektur/parser` bzw. `#architektur/parser:2` für die zweite Sub-Slide.

## Syntax

```yaml
# deck.yaml (optional – ohne Manifest: alle .md im Ordner, alphabetisch)
title: Mein Vortrag
theme: minimal          # minimal | dark-tech | ./eigenes-theme.css
maxDepth: 3             # tiefere Überschriften werden Abschnitte innerhalb der Folie
layout: default         # Default-Layout
layouts:                # Default-Layout je Ebene (vor `layout`, nach dem Attribut am Knoten)
  1: section
duration: 30m           # Zeitplan für die Presenter-View (30m, 1h30m, 90s, 1:30)
mount:
  - file: intro.md
  - file: details/backend.md
    under: "Architektur > Backend"   # Überschriften werden automatisch verschoben
```

```markdown
## Backend {layout=two-col id=backend transition=fade .klasse}

::: col
Linke Spalte
:::
::: col
![Bild](bilder/arch.svg)
:::

---                       ← neue Sub-Slide im selben Knoten

::: notes
Sprechernotiz (alternativ: alles nach <!-- notes -->)
:::

[Querverweis](#backend/db-schema)
```

- **Layouts:**

  | Layout | Wirkung |
  | --- | --- |
  | `title` | Titel groß, Text als Untertitel |
  | `section` | Kapitelstart, Kinder automatisch als Kacheln |
  | `default` | Titel und Inhalt |
  | `two-col` / `three-col` | `::: col`-Blöcke nebeneinander |
  | `statement` | eine Kernaussage groß und mittig (Titel = Aussage) |
  | `quote` | Blockquote groß mit Anführungszeichen, Titel klein darüber, Text darunter = Quelle |
  | `image-right` / `image-left` | das erste Bild (bzw. Mermaid-Diagramm) füllt eine Hälfte, der Rest steht daneben |
  | `agenda` | Liste der Kapitel des Hauptpfads. Erledigte gedämpft, das nächste (zwischen Kapiteln) bzw. aktuelle (unter einem Kapitel) hervorgehoben. Ab 10 Kapiteln zweispaltig |

- **Knoten-Attribute:** `layout=…`, `id=…`, `transition=slide|zoom|fade|none`, `.klasse`, `duration=5m` (Budget in der Presenter-View), `bg=…` (Hintergrund: Farbe `#123`, Verlauf `"linear-gradient(…)"` oder Bild `bilder/x.jpg`), `bgdim=0.5` (Bild abdunkeln)
- **Container:** `::: columns`/`::: col`, `::: columns cols=3` bzw. `cols="2:1"` (feste Spalten, Verhältnis), `::: grid cols="2fr 1fr" gap=2`, `::: children`, `::: notes` (`step=2`). Verschachtelung im Pandoc-Stil mit gleicher Anzahl Doppelpunkte.
- **Hinweiskästen** wie auf GitHub: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`. Titel auf Deutsch (Hinweis, Tipp, Wichtig, Warnung, Achtung), eigener Titel mit `> [!TIP] Mein Titel`.
- **Code:** ` ```ts {title="auth.ts" lines="3-5|8|all"} ` mit Shiki. Die Farben kommen aus den `--shiki-token-*`-Tokens des Themes.
  - `lines`: hebt Zeilen hervor und dunkelt die übrigen ab. Jeder `|`-Abschnitt ist ein Schritt: Abschnitt 1 gilt sofort, jedes → schaltet weiter. `all` bzw. ein leerer Abschnitt zeigt alles normal. Ein einzelner Abschnitt (`lines="3-5"`) hebt fest hervor, ohne Schritt.
  - `lines` und `steps` lassen sich kombinieren, beide zählen über dieselbe Schrittnummer.
- **Mermaid:** ` ```mermaid `, gerendert im Browser. Die Farben kommen aus den Theme-Tokens.
- **Schritt für Schritt:** Die Schritte einer Folie werden über ihre Nummer synchronisiert. Gleiche Nummer bedeutet gleichzeitig: Links erscheint Bullet 2, rechts Code-Teil 2. Oben rechts zeigen Punkte den Fortschritt.
  - `::: steps` um eine Liste: Jeder Listenpunkt (bzw. jeder Block) ist ein Schritt. `::: steps start=2` beginnt später.
  - `## Titel {steps}`: Alle Listen der Folie (auch in Spalten) werden automatisch schrittweise eingeblendet, die Liste selbst bleibt unverändert. Gezählt wird die oberste Ebene, Unterpunkte erscheinen mit ihrem Elternpunkt. Ein ausdrücklich gesetztes `::: steps` in der Folie hat Vorrang. Das Attribut gilt für alle Sub-Slides (`---`) des Knotens, `{steps=off}` schaltet es ab.
  - Code ` ```ts {steps="1,6|2-3|4-5"} `: Je `|`-Abschnitt kommen Zeilen hinzu, neue Zeilen werden kurz hervorgehoben. Zeilen ohne Schritt sind sofort sichtbar (Gerüst), leere Abschnitte bedeuten keine Änderung.
  - Mermaid: Eine Zeile `%% step` beginnt den nächsten Abschnitt, und das Diagramm wächst kumulativ.

  ```markdown
  ## Login {layout=two-col}
  ::: col
  ::: steps
  - Funktion anlegen
  - Zugangsdaten prüfen
  :::
  :::
  ::: col
  ```ts {steps="1,4|2-3"}
  export function login(user) {
    const ok = verify(user)
    if (!ok) throw new AuthError()
  }
  ```
  :::
  ```
- **Bilder:**
  - `![Alt](bilder/x.png)`: Eine Datei im Deck-Ordner wird beim Build mitkopiert.
  - Dateien außerhalb des Decks (`../shared/logo.png`) werden automatisch als Base64 eingebettet.
  - Base64 direkt: `![Alt](data:image/png;base64,…)` oder lesbarer als Referenz `![Logo][logo]` mit `[logo]: data:image/png;base64,…` am Dateiende. Die Referenz gilt in der ganzen Datei, über Folien hinweg.
  - `embedImages: true` in `deck.yaml` bettet alle Bilder ein.
  - Größe/Klasse direkt hinter dem Bild: `![](x.png){width=60% height=200 .rund}`
  - Fehlende Bilder meldet das Terminal als Warnung.
- **`---` als Folientrenner** funktioniert auch ohne Leerzeile darüber. CommonMark würde daraus sonst eine Überschrift machen.
- **Theme** = CSS-Datei mit Tokens (`--color-*`, `--font-*`, `--radius`, `--space-*`, `--shiki-*`), siehe `src/runtime/themes/`

## Aufbau

```
src/core/      Parser (remark), Deck-Baum, Render-Plugins (Shiki, Mermaid), Navigator – ohne UI, getestet
src/vite/      Vite-Plugin: Deck als virtuelles Modul, Datei-Watcher, Hot Reload, Bild-Assets
src/runtime/   Svelte-5-App: Bühne, Layouts, Übergänge, Breadcrumb, Übersicht, Themes
src/runtime/editor/  Editor (editor.html): CodeMirror, Vorschau-Sync, Bild-Upload
src/cli/       strata dev | build | preview | export | pdf, gemeinsame Vite-Konfiguration, Deck-Gerüst
src/desktop/   Node-Sidecar der Desktop-App (stdin/stdout-Protokoll), Startseite (ui/)
src-tauri/     Desktop-App in Rust (Tauri 2): Fenster, Menü, Dialoge, Bildschirmwahl
examples/      Beispiel-Deck (5 Dateien, 3 Ebenen)
```

## Noch nicht umgesetzt

Die Reihenfolge der nächsten Ausbaustufen steht in der [Roadmap](roadmap.md). Noch offen sind z. B. Includes, `hidden`, PlantUML/D2/Graphviz, Auto-Layout/Auto-Fit, Hell/Dunkel-Umschaltung, Magic Move, Diagramm-Morphing (stabile Knotenpositionen) und eigene Layouts.
