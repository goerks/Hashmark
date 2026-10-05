# Hashmark (MVP)

**Mächtige Präsentationen aus reinem Markdown.** Ein starker Editor, Folien als navigierbarer Baum.

Hashmark macht aus 1..n Markdown-Dateien eine Slideshow: → erzählt auf dem Hauptpfad weiter, ↓ taucht ins Detail ab.
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
| `make app` / `make app-package` / `make app-cross` | Desktop-App (Go) bauen und starten / als portables `Hashmark.exe` packen / für alle Plattformen bauen, siehe „Desktop-App“ |
| `make edit` | Editor mit Live-Vorschau im Browser (`DECK=…`), siehe unten |
| `make dev` / `make dev-open` | Dev-Server mit Hot Reload (`DECK=…`, `PORT=…`). Ohne `DECK=` zeigt die Seite unten links eine Auswahl der Beispiel-Decks (`examples/`), z. B. `hashmark-demo` und `theme-demo`. |
| `make build` | Statisches HTML nach `dist/` (`OUT=…`) |
| `make preview` | Gebautes Deck lokal ausliefern |
| `make dev-lan` / `make preview-lan` | Wie `dev` / `preview`, aber im Netzwerk (LAN/VPN) erreichbar |
| `make export` | Eine einzelne HTML-Datei nach `export/<deck>.html`, läuft offline per Doppelklick |
| `make pdf` | PDF nach `export/<deck>.pdf` (Optionen siehe „PDF und Druck“) |
| `make pptx` | PowerPoint nach `export/<deck>.pptx` (siehe „PowerPoint-Export“) |
| `make check` | Deck prüfen wie ein Linter (`DECK=…`): unbekannte Layouts/Attribute, fehlende Bilder, Theme-Fehler und Überlauf der Folien. `NOOVERFLOW=1` ohne Browser, `STRICT=1` Hinweise als Fehler. Exit-Code 1 bei Fehlern, geeignet für CI |
| `make docker` / `make docker-run` | Build und Docker-Image mit nginx (`IMAGE=…`), starten auf `DOCKER_PORT` (8080) |
| `make build-examples` / `make docker-examples` | Alle Beispiele unter `examples/` mit Auswahlseite (`dist/index.html` + `dist/<deck>/`), bzw. als nginx-Image `hashmark/beispiele` |
| `make test` | Tests (Parser, Deck-Baum, Navigator, Layouts, Suche, Zeitplan) |
| `make deps-update` | Pakete online aktualisieren und im Cache ablegen |
| `make clean` / `make distclean` | `dist/` bzw. zusätzlich `node_modules/` löschen |

## Desktop-App (Go)

```sh
make app                          # bauen und starten: Startseite mit Deck öffnen / neu / Beispiel / zuletzt geöffnet
make app DECK=decks/mein-vortrag  # direkt ein Deck öffnen
make app-package                  # portables Programm: dist-app/Hashmark/Hashmark.exe
make app-cross                    # Hülle für Windows, Linux und macOS (amd64, arm64) nach dist-go/
```

Die App ist eine schlanke Go-Hülle (ohne CGO, ca. 7 MB) um die Webview des Systems (WebView2 unter Windows). Die eigentliche Arbeit macht Hashmark wie bisher in Node. Die App startet dafür das Node aus `vendor/node` als **Sidecar**. Es gibt keinen Installer, das Programm ist immer ein Ordner bzw. eine Datei zum Kopieren.

- **Plattformen:** Windows ist umgesetzt und getestet. Linux (GTK 3) und macOS (Objective-C-Laufzeit) haben Menü, Vollbild und Monitorwahl über `purego`, kompilieren (`make app-cross`), sind aber **nie gestartet worden**. Unter Linux brauchen die Dialoge `zenity` oder `kdialog`.
- **Voraussetzung:** Windows WebView2 (in Windows 10/11 enthalten), Linux WebKitGTK, macOS nichts. Zum Bauen genügt Go (ab 1.26) im `PATH`, keine weitere Toolchain.

- **Schnell:** Ein Deck ist in wenigen Sekunden offen, das PDF ist in etwa 5 s fertig. Im Hintergrund wärmt die App schon beim Start auf: Sie lädt den Kern, startet die Code-Hervorhebung und liest das zuletzt geöffnete Deck vorab. Ein Klick darauf öffnet es dann in Millisekunden. Das gepackte Programm bündelt den Node-Teil zu wenigen Dateien, damit auch der allererste Start auf frisch kopierten Dateien (USB-Stick, Virenscanner) schnell ist.
- **Zeiten im Log:** `%APPDATA%\app.hashmark.desktop\sidecar.log` zeigt, wo die Zeit bleibt (Aufwärmen, Deck geöffnet in … ms, PDF in … ms).
- **Vorgebaute Runtime:** Die Oberfläche (Präsentation, Editor, Presenter) wird einmal vorgebaut (`runtime-dist/`, nur nach Änderungen an den Quellen). Ein kleiner Live-Server liefert sie aus, zusammen mit dem Deck. Änderungen an den Markdown-Dateien erscheinen sofort, auch bei Bearbeitung in einem anderen Editor. Der Ordner `dist-app/Hashmark/` lässt sich kopieren und läuft ohne Installation: `Hashmark.exe` bzw. `Hashmark.exe <deck-ordner>`.

- **Startseite:** Deck öffnen (Ctrl+O), Neues Deck (Ctrl+N, leeren Ordner wählen oder anlegen), Liste der Beispiele (`examples/`: `hashmark-demo`, `theme-demo`), zuletzt geöffnete Decks.
- **Editor:** derselbe wie bei `make edit`. „Präsentieren ↗“ startet die Präsentation, „PDF“ speichert direkt ein PDF.
- **Präsentieren:** F5 ab der aktuellen Folie, Shift+F5 von vorne.
  - **Optionen** (Pfeil neben „Präsentieren“ im Editor, Menü Präsentieren › Optionen, Ctrl+K): Presenter-View *automatisch* (nur mit zweitem Bildschirm), *immer* oder *nie*, dazu je ein Bildschirm für die Präsentation und für den Presenter (Karte der angeschlossenen Bildschirme). Die Wahl steht in `present.json` im Datenordner. Ohne Auswahl läuft die Präsentation im Vollbild auf dem Zusatzbildschirm und der Presenter auf dem Hauptbildschirm.
  - **Mit Presenter-View** zeigt die Präsentation keine Bedienhilfen: kein Steuerkreuz, keine Schrittpunkte und Folienzähler, kein „↓ n Details“, keine Plan-Hinweise. Sie stehen im Presenter. Ohne Presenter bleibt alles sichtbar. Das gilt auch, wenn du den Presenter mit S öffnest.
  - Mit nur einem Bildschirm öffnet S die Presenter-View als eigenes Fenster.
  - Beenden: Ctrl+W, der Knopf ✕ Beenden (oben rechts in der Präsentation, erscheint mit der Maus; im Presenter mit Rückfrage) oder Menü Präsentieren › Präsentation beenden. Alt+F4 geht ebenfalls.
- **Export** (Menü Datei): Als HTML-Datei (Ctrl+Shift+E), PDF mit allen Folien (Ctrl+Shift+P), nur Hauptpfad, jeder Schritt eine Seite, Handout mit Notizen, PowerPoint (Ctrl+Shift+X, siehe „PowerPoint-Export“). Das PDF entsteht wie bei `make pdf` über Edge headless, direkt vom laufenden Deck, ohne neuen Build.
- **Ansicht:** Editor (Ctrl+1), Präsentation im Fenster (Ctrl+2), Neu laden (Ctrl+R), Vollbild (F11), Entwicklertools (F12). Die Tastenkürzel des Menüs sind Skripte in den Seiten, weil WebView2 Tasten selbst verarbeitet.
- **Sicherheit:**
  - Die internen Server lauschen nur auf 127.0.0.1 mit zufälligem Port.
  - Die Startseite hat einen eigenen Server mit App-Befehlen. Sie verlangen den Header `X-Hashmark-App`, den fremde Seiten wegen CORS nicht senden können. Die Seiten des Deck-Servers (Editor, Folien) erreichen sie nicht.
  - Aktionen wie „Präsentieren“ melden die Seiten per HTTP mit Schutz-Header an den Sidecar.
  - Externe Links (http, https, mailto) und `window.open` dorthin öffnen im Standardbrowser: Die Webview hat keinen Hook für neue Fenster, deshalb fängt ein Skript sie in den Seiten ab und die Hülle öffnet nur diese Schemata.
- **Fenster:** Präsentation und Presenter-View laufen als eigene Prozesse derselben EXE, weil die Webview-Bibliothek nur ein Fenster je Prozess kennt.
- **Daten:** zuletzt geöffnete Decks und `sidecar.log` in `%APPDATA%\app.hashmark.desktop\` (Menü Hilfe → Datenordner).

**Bauen:** Go (nicht im Repo) genügt, die Abhängigkeiten (`go-webview`, `zenity`) lädt Go beim ersten Build ins Modulcache. Die Webview-Bibliothek ist in die EXE eingebettet und entpackt sich beim Start nach `%TEMP%\webview-<Version>`. Die App bringt keine weiteren Binärdateien ins Repo, Node liegt ohnehin in `vendor/node`.

**Tests (alle headless, ohne sichtbare Fenster):**
- `make test` – Unit-Tests
- `make sidecar-smoke` – Node-Teil so, wie die App ihn anspricht (Deck öffnen, Datei-API, App-Aktionen, PDF, Handout, HTML). `SIDECAR_BUNDLE=1` prüft das Bündel.
- `make app-test` – die ganze App: Startseite, Deck öffnen, Editor, Rechte, Präsentation, Presenter, Tasten, Ctrl+W, dazu die Zeiten. Nutzt das gepackte Programm bzw. `export/hashmark.exe` (`make app`). `VISIBLE=1` zeigt die Fenster, `node scripts/app-e2e.ts <exe>` testet eine beliebige EXE.

## Alle Abhängigkeiten liegen im Projekt

Es muss nichts global installiert werden:

- `vendor/node/` enthält portables Node.js 24 LTS. Es wurde von nodejs.org geladen und per SHA256 geprüft (`scripts/get-node.ps1`).
- `vendor/npm-cache/` enthält alle npm-Pakete als Tarballs. `make setup` installiert daraus **ohne Internet**, weil `.npmrc` auf diesen Cache zeigt.
- Zur Laufzeit gibt es keine CDNs und keine Web-Fonts. Mermaid und Shiki werden mitgebündelt, Schriften kommen aus dem System.

Voraussetzungen: Windows x64 und GNU Make (z. B. `choco install make`). Für die Desktop-App zusätzlich Go (ab 1.26) im `PATH`.

## Versionen und Releases der Desktop-App

**Version:** `<letzter Tag ohne v>.<Kurz-Hash>`, z. B. `1.2.0.a1b2c3d` (ohne Tag `0.0.0.<hash>`). Sie wird beim Bauen in die Hülle eingebettet und ist abfragbar:

```sh
hashmark --version       # Hashmark 1.2.0.a1b2c3d   (Windows: Hashmark.exe --version)
```

Außerdem steht sie im Menü Hilfe → Über. `make app`, `make app-cross` und `make app-exe` setzen sie aus `git describe` (mit `VERSION=…` überschreibbar).

**Pipeline (`.gitlab-ci.yml`), bei jedem Push:**
1. `version` ermittelt die Version und gibt sie an alle Jobs weiter.
2. `test` führt Vitest aus.
3. `build-app` baut die Go-Hülle ohne CGO für Windows, Linux und macOS (amd64 und arm64).
4. `package` baut je Ziel ein Standalone-Paket, ohne Installer: Hülle, Node (von nodejs.org, SHA256 geprüft) und die App mit den Laufzeit-Paketen des Ziels. Als Artefakt `dist-app/hashmark-<version>-<ziel>.zip` (Windows) bzw. `.tar.gz`. Lokal: `node scripts/package-app.ts <ziel> --version=… --archive`.

**Release:** Ein Tag (z. B. `git tag v1.0.0 && git push origin v1.0.0`) erzeugt zusätzlich ein GitLab-Release. Die Pakete landen in der Generic Package Registry des Projekts und sind im Release verlinkt. Die Notizen entstehen aus den Commit-Betreffzeilen seit dem vorherigen Tag (`scripts/release-notes.ts`):
- **Behobene Fehler:** Betreffzeile beginnt mit `Fix` (z. B. `Fix: Überlauf bei Tabellen`) oder enthält „behoben“, „behebt“, „Fehler“ oder „Bug“.
- **Neue Funktionen:** alles andere. Weggelassen werden Merge-Commits, `docs:`/`chore:`/`ci:`/`test:`/`style:` und `[skip changelog]`.

**Hinweise zu den Paketen:** Die Programme sind nicht signiert. Unter macOS (`Hashmark.app`) warnt Gatekeeper beim ersten Start (Rechtsklick → Öffnen, oder `xattr -dr com.apple.quarantine Hashmark.app`), unter Windows kann SmartScreen warnen. Linux braucht WebKitGTK, für Dialoge zenity oder kdialog.

## Deployment (GitLab-Registry und Render)

Ein einziger Container liefert die Präsentation (`/`, öffentlich) und den Editor (`/editor.html`, mit Passwort). Beide arbeiten auf demselben Deck-Ordner, Änderungen im Editor erscheinen sofort in der Präsentation. Es braucht deshalb **nur eine Bereitstellung**.

```sh
make serve                         # lokal ohne Docker: http://localhost:3030, Editor-Passwort „geheim“ (EDITOR_PASSWORD)
make image && make image-run       # dasselbe als Docker-Image, http://localhost:8080
```

**Einstellungen** (Umgebungsvariablen des Containers):

| Variable | Bedeutung |
| --- | --- |
| `EDITOR_PASSWORD` | schaltet den Editor frei, ohne gibt es nur die Präsentation |
| `EDITOR_USER` | Benutzername, Standard `editor` |
| `PORT` | Standard 10000, Render setzt ihn selbst |
| `DECK_DIR` | Deck-Ordner, Standard `/data/deck` |
| `DECK_SEED` | wird beim ersten Start in einen leeren `DECK_DIR` kopiert, Standard das Beispiel-Deck |

**Automatik:** `.gitlab-ci.yml` führt bei jedem Push auf den Standard-Branch die Tests aus (die Desktop-App-Jobs stehen oben), baut das Image mit Kaniko, legt es als `:<commit>` und `:latest` in die GitLab-Registry und stößt Render über den Deploy-Hook an.

**Einmalig einrichten:**

1. In GitLab ein **Deploy-Token** mit `read_registry` anlegen (Settings → Repository → Deploy tokens).
2. In Render unter *Workspace Settings → Registry Credentials* Zugangsdaten anlegen: Registry `registry.gitlab.com`, Benutzername und Token aus Schritt 1, Name `gitlab`.
3. In `render.yaml` die Image-Adresse eintragen (`registry.gitlab.com/<gruppe>/<projekt>:latest`) und das Blueprint in Render anlegen, oder den Dienst von Hand erstellen: *Existing image*, Port 10000, Health Check `/healthz`, Festplatte auf `/data`.
4. In Render `EDITOR_PASSWORD` setzen.
5. In Render die **Deploy-Hook-URL** des Dienstes kopieren und in GitLab als CI/CD-Variable `RENDER_DEPLOY_HOOK_URL` eintragen (maskiert und geschützt).

**Wichtig zur Festplatte:** Ohne Festplatte ist das Dateisystem bei Render flüchtig, Änderungen aus dem Editor gehen bei jedem Neustart und Deploy verloren (kostenlose Dienste haben keine Festplatte). Mit der Festplatte auf `/data` bleiben sie erhalten, das Image selbst enthält nur das Beispiel-Deck als Startinhalt. Die Zugangsdaten gehen per HTTP Basic über HTTPS (Render terminiert TLS).

## Editor

```sh
make edit                          # Beispiel-Deck
make edit DECK=decks/mein-vortrag  # eigenes Deck
```

Der Browser öffnet `http://localhost:3030/editor.html`:

- **Seitenleiste** (Symbol oben links): Dateien und Gliederung des Decks. Die Gliederung zeigt den Baum mit → für den Hauptpfad und ↓ für Details, ein Klick öffnet die Datei an der Überschrift und zeigt die Folie. Die Brotkrumen oben zeigen, wo du im Baum stehst.
- **Ansicht:** *Schreiben*, *Geteilt* oder *Vorschau*. Den Trenner zwischen Text und Vorschau kannst du ziehen.
- **Text** (CodeMirror): Markdown und die Hashmark-Syntax (`:::`, `{layout=…}`, Hinweiskästen, Code in Blöcken) sind farbig. Suchen/Ersetzen mit Ctrl+F, Undo, Listen setzen sich mit Enter fort, Tab rückt ein.
- **Vorschau** rechts: Jede Änderung wird nach 0,4 s automatisch gespeichert und sofort angezeigt. Ctrl+S speichert direkt.
- **Synchron** (Schalter oben): Die Vorschau zeigt die Folie unter dem Cursor, inklusive Sub-Slide, vollständig aufgedeckt. Umgekehrt scrollt der Editor mit, wenn du in der Vorschau mit den Pfeiltasten oder der Übersicht navigierst.
- **Vorschläge** erscheinen beim Tippen, **Tab** oder **Enter** übernimmt, **Esc** schließt, **Strg+Leertaste** erzwingt sie:
  - `/` am Zeilenanfang: Bausteine (Kapitel, Detail, Neue Folie, Spalten, Schritte, Code, Mermaid, Notizen, Kacheln, Hinweis, Statement, Bild rechts, Agenda). Der Platzhalter ist markiert und wird beim Tippen ersetzt.
  - `:::` und Leertaste: Container (`col`, `columns`, `grid`, `steps`, `notes`, `children`).
  - `{` an einer Überschrift: Attribute, nach `layout=` die Layouts (auch die des Themes), nach `transition=` die Übergänge.
  - `> [!`: Hinweiskästen, dreimal Backtick plus Buchstabe: Code-Sprachen.
- **Hinweise im Text:** Unbekannte Layouts, Attribute, Übergänge und Container sowie nicht geschlossene `:::`/Codeblöcke sind wellig unterstrichen. Die Zeile unten zeigt die Anzahl, ein Klick listet sie, *Korrigieren* übernimmt den Vorschlag („Meinst du two-col?“).
- **Formatleiste:** Markierter Text zeigt Fett, Kursiv, Code, Link und Überschrift (auch Strg+B, Strg+I, Strg+E).
- **Strg+K:** Palette für Folien, Bausteine, Dateien und Aktionen (Präsentieren, PDF, Ansicht, Bild, neue Datei).
- **Bilder:** *Bild einfügen* (Palette) kopiert die Datei nach `bilder/` und fügt den Link ein. Das geht auch per **Drag & Drop** oder **Einfügen (Ctrl+V)** eines Screenshots. *Bild einbetten* bettet das Bild direkt in die Markdown-Datei ein, als Referenz am Dateiende.
- **+ Datei** legt eine neue Markdown-Datei an und trägt sie in `deck.yaml` ein. Kommentare dort bleiben erhalten.
- **Präsentieren** öffnet die Präsentation an der aktuellen Folie.
- **Externe Änderungen** (z. B. in VS Code) übernimmt der Editor automatisch, solange er selbst nichts Ungespeichertes hat.
- **Tablet:** Unter 900 px Breite liegt die Seitenleiste als Schublade über dem Text, Text und Vorschau stehen untereinander. Bei Touch-Bedienung sind die Bedienelemente größer, und über der Bildschirmtastatur erscheint eine Leiste mit `⇥ # ::: { } ` - [ ] B I` und *+ Baustein*.

Sicherheit: Die Datei-API existiert nur mit `make edit`. Sie ist nur über localhost erreichbar, schreibt nur innerhalb des Deck-Ordners und nur `.md`/`.yaml` bzw. Bilder. `make dev-lan` hat bewusst keinen Editor.

## PDF und Druck

**Per Befehl** (reproduzierbar, ohne Druckdialog):

```sh
make pdf                          # alle Folien → export/hashmark-demo.pdf
make pdf DEPTH=1                  # nur Hauptpfad (Kurzfassung)
make pdf STEPS=1                  # jeder Schritt eine eigene Seite
make pdf NOTES=1                  # Handout A4: Folie + Sprechernotizen → export/<deck>-handout.pdf
make pdf DECK=decks/x PDF=vortrag.pdf
```

`make pdf` baut das Deck und druckt es mit dem installierten **Edge oder Chrome** im Headless-Modus. Es braucht keine zusätzliche Software und läuft offline. Einen anderen Browser gibst du mit `BROWSER=pfad` oder der Umgebungsvariable `HASHMARK_BROWSER` an.

**Im Browser:**

- **Ctrl+P** (oder Menü „Drucken“) direkt in der Präsentation druckt **alle Folien**, eine pro Seite. Im Druckdialog lässt sich unter „Seiten“ ein Bereich wählen, z. B. `5-12`. Die Seitenzahlen stehen unten rechts auf jeder Folie.
- **P** in der Präsentation, der Button **PDF** im Editor oder die URL `?print` öffnen die **Druckansicht mit Optionen** (Tiefe, Reihenfolge nach Vortragsplan, jeder Schritt eine Seite, Handout, Fußzeile) und danach den Druckdialog.
- Die Folien passen sich jedem Papierformat an (16:9 ist Standard, A4/Letter werden auf die Breite skaliert). Das funktioniert auch im Single-File-Export.

### PowerPoint-Export

`make pptx` (Editor: Button **PPTX** oder Ctrl+K › „PowerPoint“, Desktop-App: Datei › PowerPoint) erzeugt eine `.pptx`-Datei, die sich in PowerPoint weiterbearbeiten lässt.

```sh
make pptx                         # alle Folien → export/<deck>.pptx
make pptx DEPTH=1                 # nur Hauptpfad
make pptx STEPS=1                 # jeder Schritt eine eigene Folie statt Animationen
make pptx NOANIM=1                # ohne Animationen und Übergänge: nur der Endzustand
make pptx PLAN=path               # Reihenfolge nach dem Vortragsplan (path | grouped)
```

Was dabei entsteht:

- **Bearbeitbar:** Überschriften, Absätze, Listen (mit Aufzählungsfarbe und Ebenen), Code (Consolas, Syntaxfarben), Tabellen (echte PowerPoint-Tabellen), Fett/Kursiv/Links und Inline-Code. Querverweise werden zu Sprungmarken auf die Zielfolie.
- **Als Bild:** Mermaid-Diagramme, Formeln, SVG, QR-Codes, Figuren mit Beschriftungen, runde oder zugeschnittene Bilder. Normale PNG/JPG/GIF-Bilder bleiben echte Bilder (mit Alternativtext).
- **Dekoration** (Kacheln, Rahmen, Verläufe, Hintergrundbilder, Logos des Themes) liegt als Hintergrundbild unter dem Text. Folien mit einfarbigem Hintergrund bekommen stattdessen eine echte Hintergrundfarbe.
- **Sprechernotizen** stehen in den Notizen der Folie, die obersten Kapitel werden PowerPoint-Abschnitte.
- Es braucht wie das PDF Edge oder Chrome (`BROWSER=…`), sonst nichts, und läuft offline. Im Browser-Editor rendert der Server die Datei; im Webdienst (Docker) fehlt dort der Browser.
- Schriften: Es werden die Schriftnamen des Themes verwendet (Segoe UI, Consolas, bei Code-Schriften ohne Consolas bleibt der Name). Fehlt eine Schrift auf dem Zielrechner, ersetzt PowerPoint sie.
- **Animationen:** Die Schritte der Präsentation werden zu PowerPoint-Animationen (Einblenden, ein Klick je Schritt, gleiche Schrittnummer gleichzeitig). Listenpunkte und Codezeilen bauen sich absatzweise auf. Karten, Sprechblasen, Rahmen und Pins (Dekoration samt Text), Bilder, Tabellenzeilen und die Versionen eines Mermaid-Diagramms (`%% step`, die alte Version verschwindet) erscheinen mit ihrem Schritt. Nicht möglich sind Gruppen *innerhalb* eines SVG (Excalidraw, draw.io, `{steps=ids}`), sie stehen im Endzustand, ebenso Tabellen mit Spaltenschritten und das Abdunkeln von Codezeilen (`lines=`).
- **Übergänge:** Der Übergang zur Folie wird übernommen (Schieben, Zoom beim Abtauchen, Überblenden, `transition=`).
- Wer lieber eine Folie je Schritt will (zum Beispiel für ein PDF-artiges Handout): `STEPS=1`. Ohne beides (`NOANIM=1`) bleibt nur der Endzustand.

Das PDF hat:
- **Format:** eine Folie pro Seite im Format 16:9 (13,33 × 7,5 Zoll wie PowerPoint), bzw. A4 hoch beim Handout
- **Inhalt:** Folien in Lesereihenfolge (Kapitel, dann seine Details), Schritte vollständig aufgedeckt, Diagramme gerendert. Mit der Option **Reihenfolge** folgt das PDF dem [Vortragsplan](#vortragsplan-pfad-optional-anhang): nur der Pfad, oder Pfad, Optionales und Anhang als eigene Teile (`hashmark pdf --plan path|grouped`).
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
| Webservice mit Auswahl aller Beispiel-Decks | `make docker-examples` + `make docker-run IMAGE=hashmark/beispiele` | http://<server>:8080 zeigt eine Auswahlseite, jedes Deck liegt unter `/<name>/` (z. B. `/theme-demo/`). Neue Ordner unter `examples/` erscheinen automatisch. |
| Beliebiges statisches Hosting (GitLab/GitHub Pages, IIS, S3 …) | `make build` | Inhalt von `dist/` hochladen. Funktioniert auch in Unterverzeichnissen. |

Hinweise:

- **Windows-Firewall:** Beim ersten `*-lan`-Start fragt Windows, ob `node.exe` im Netzwerk lauschen darf.
- **Vertraulichkeit:** Build und Export enthalten den ganzen Deck-Inhalt samt Sprechernotizen im Klartext. Für interne Vorträge nur intern hosten. Für Docker gibt es einen vorbereiteten Basic-Auth-Block in [docker/nginx.conf](docker/nginx.conf).
- **Docker** braucht beim ersten `make docker` Internet, um das Basis-Image `nginx:alpine` zu laden. Das Image enthält nur das gebaute Deck. Gebaut wird vorher lokal mit dem Node aus `vendor/`.
- **CI unter Linux:** `vendor/` enthält nur Windows-Pakete (Node und die nativen Binaries von Vite/Rolldown). Auf einem Linux-Runner braucht es `npm ci` mit Registry-Zugriff. Alternativ lokal bauen und nur `dist/` veröffentlichen.
- **Remote-Vortrag** (Teams/Zoom): Nur das Präsentationsfenster teilen, die Presenter-View (S) bleibt privat. Dass das Publikum der Position live im eigenen Browser folgt, ist noch nicht umgesetzt.

## Vortragsplan: Pfad, Optional, Anhang

Nicht jeder Vortrag zeigt alle Folien. Mal läuft alles durch, mal wird gekürzt, und manche Details kommen nur bei Zeit oder Fragen dran. Dafür hat jeder Knoten eine **Rolle**:

| Rolle | Wirkung |
| --- | --- |
| **Pfad** | Space und Clicker laufen hindurch |
| **Optional** | Space überspringt sie. ↓ startet einen **Ausflug**: Space geht die optionalen Details durch und führt am Ende von selbst zur Abzweigung zurück |
| **Anhang** | Nur über Suche (Ctrl+K), Übersicht (O) oder die Presenter-View erreichbar. Im Handout ein eigener Teil |

Der **Autor** setzt den Standard im Markdown, mit bloßen Flags an der Überschrift. Ohne Flags ist alles Pfad, Space läuft also wie gewohnt durch alles.

```markdown
## Backend

### Frontend
### Deployment

### DB-Schema {optional}
### API {optional}
### Messwerte {appendix}
```

Die Rolle gilt für den ganzen Unterbaum. `{plan=path}` an einem Kind überstimmt sie wieder.

Der **Vortragende** bestimmt den Pfad in der Presenter-View (**S**, dann **P**), vor und während des Vortrags:

- Pro Knoten **Pfad / Optional / Anhang** umschalten (gilt samt Unterbaum), ↺ nimmt die Änderung zurück.
- **Vorlagen:** *Standard* (Autor), *Alles*, *Bis Ebene n* (tiefere Ebenen optional), *Zeitbudget* (wirft die tiefsten und letzten Knoten aus dem Pfad, bis es in die Minuten passt).
- **Zeitschätzung:** `{duration=…}` an Blättern, sonst 1 Minute je Folie. Unten steht die Summe je Rolle gegen das Budget. Ohne Eingabe gilt `duration` aus `deck.yaml`.
- **Fahrpläne:** mehrere benannte Pläne je Deck („Kurz“, „Voll“), per „Kopie anlegen“ aus dem aktuellen. Sie liegen in `.hashmark/plan.json` neben dem Deck und lassen sich mit einchecken. Im Webdienst ohne Anmeldung und im Export landen sie im Browser-Speicher. Ein statischer Build (`make build`) enthält die Datei und folgt dem Plan.
- **Live umplanen:** Änderungen gelten sofort in der Präsentation. Wirfst du die aktuelle Folie aus dem Pfad, bleibt sie stehen, und Space geht zum nächsten Pfad-Knoten.
- **T** (in der Präsentation, in der Presenter-View als Knopf unten im Plan): Plan ausschalten. Space läuft durch alles, ohne dass der Plan geändert wird.

In der Präsentation zeigt ein Schild neben den Brotkrumen „Optional“ bzw. „Anhang“. Der Chip „↓ 3 Details“ zeigt Details abseits des Pfads als Ring statt Punkt. Im Ausflug erinnert eine Leiste unten („↩ Ausflug · zurück zu …“). Die Pfeile → ← bewegen sich weiter frei im Baum und kümmern sich nicht um den Plan.

## Presenter-View und Notizen

**S** öffnet die Presenter-View in einem zweiten Fenster, das du auf den eigenen Bildschirm schiebst. Die Präsentation kommt auf den Beamer (F für Vollbild). Beide Fenster bleiben synchron. Das funktioniert mit `make dev`, `make preview` und im Single-File-Export per Doppelklick.

- **Aktuell** (groß) und **Als Nächstes**: das Ziel von Space, also auch der nächste Schritt.
- **Notizen** der aktuellen Sub-Slide. A− / A+ bzw. − / + ändern die Schriftgröße (wird gemerkt).
- **Baum** links: Hauptpfad, entlang der aktuellen Position aufgeklappt, `↓3` = Anzahl Details. Klick springt. Optionales und Anhang stehen kursiv mit Rollenschild; ein Sprung dorthin ist ein Ausflug.
- **Plan** (Knopf oben, Taste **P**): Vortragsplan bearbeiten, siehe [oben](#vortragsplan-pfad-optional-anhang).
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
| ↓ / Enter | abtauchen: in die optionalen Details (Ausflug), sonst in den ersten Kindknoten |
| ↑ / Esc | zum Elternknoten, an die Stelle, von der aus abgetaucht wurde; beendet den Ausflug |
| **Space** / Shift+Space | **dem Vortragsplan nach**: Schritte, Sub-Slides, dann der nächste Pfad-Knoten in Lesereihenfolge (Tiefensuche, ohne Optionales und Anhang); im Ausflug die Details und am Ende zurück zur Abzweigung. Ohne Flags und Plan läuft es durch alles |
| T | Plan aus/an: Space läuft durch alles |
| PageDown / PageUp | wie Space / Shift+Space. Das senden **Presenter-Fernbedienungen** („Pointer“) |
| F5 / F | Vollbild an/aus (Play-Taste des Presenters) |
| B / . | Schwarzbild an/aus (Schwarzbild-Taste des Presenters). Jede Bewegung beendet es ebenfalls. |
| **S** | Presenter-View im zweiten Fenster (siehe oben), dort **P** für den Vortragsplan |
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
theme: minimal          # minimal | dark-tech | ./eigenes-theme.css | Objekt (siehe Theme)
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
  | `comparison` | `::: col`-Blöcke als gleich hohe Karten nebeneinander (2 bis 4), die erste Zeile jeder Karte ist ihre Überschrift |
  | `banner` | Bildband oben (`banner=bild bannerh=210`), Titel und Inhalt darunter |
  | `code-focus` | der Codeblock füllt die Folie, Text steht klein darüber. Passt zu `lines="…"` und `steps="…"` |
  | `agenda` | Liste der Kapitel des Hauptpfads. Erledigte gedämpft, das nächste (zwischen Kapiteln) bzw. aktuelle (unter einem Kapitel) hervorgehoben. Ab 10 Kapiteln zweispaltig |

- **Auto-Fit und Überlauf:** `## Titel {fit}` verkleinert den Inhalt der Folie in 5-%-Schritten bis auf 70 %, bis er passt (`{fit=off}` schaltet ab). Läuft etwas über (Inhalt höher oder breiter als die Folie, auch breiter Code), zeigt die Folie beim Schreiben ein rotes Badge „Überlauf“, im Dev-Server und in der Editor-Vorschau, auch in den Miniaturen der Übersicht. Im Vortrag, im Export und im PDF gibt es kein Badge. Besser als Verkleinern ist meist Kürzen oder `---`.
- **Vortragsplan:** `## Titel {optional}` (nur bei Zeit oder Fragen, ↓ taucht ab), `## Titel {appendix}` (nur über Suche und Übersicht), `{plan=path}` (überstimmt die Rolle des Elternknotens). Bare Flags wie `{steps}`; Details im Abschnitt [Vortragsplan](#vortragsplan-pfad-optional-anhang).
- **Knoten-Attribute:** `layout=…`, `id=…`, `transition=slide|zoom|fade|none`, `.klasse`, `duration=5m` (Budget in der Presenter-View), `bg=…` (Hintergrund: Farbe `#123`, Verlauf `"linear-gradient(…)"` oder Bild `bilder/x.jpg`), `bgdim=0.5` (Bild abdunkeln)
- **Container:** `::: columns`/`::: col`, `::: columns cols=3` bzw. `cols="2:1"` (feste Spalten, Verhältnis), `::: grid cols="2fr 1fr" gap=2`, `::: children`, `::: notes` (`step=2`). Verschachtelung im Pandoc-Stil mit gleicher Anzahl Doppelpunkte.
- **Hinweiskästen** wie auf GitHub: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`. Titel auf Deutsch (Hinweis, Tipp, Wichtig, Warnung, Achtung), eigener Titel mit `> [!TIP] Mein Titel`.
- **Code:** ` ```ts {title="auth.ts" lines="3-5|8|all"} ` mit Shiki. Die Farben kommen aus den `--shiki-token-*`-Tokens des Themes.
  - `lines`: hebt Zeilen hervor und dunkelt die übrigen ab. Jeder `|`-Abschnitt ist ein Schritt: Abschnitt 1 gilt sofort, jedes → schaltet weiter. `all` bzw. ein leerer Abschnitt zeigt alles normal. Ein einzelner Abschnitt (`lines="3-5"`) hebt fest hervor, ohne Schritt.
  - `lines` und `steps` lassen sich kombinieren, beide zählen über dieselbe Schrittnummer.
- **Formeln (KaTeX):** `$a^2 + b^2 = c^2$` im Satz, `$$ … $$` als eigener Block (auch über mehrere Zeilen) und ` ```math ` (mit `step=2` / `until=3`). Ein Teil einer Formel erscheint schrittweise mit `\htmlData{step=2}{…}`. Gesetzt wird beim Laden des Decks (kein Skript im Browser), Schriften und Stile liegen im Programm: offline, im PDF, im Single-File-Export und in der App. Wie bei Pandoc beginnt eine Formel ohne Leerzeichen nach dem `$` und endet ohne Leerzeichen davor („kostet $5 und $6“ bleibt Text), `\$` ist ein Dollarzeichen. Inline-Code, Codeblöcke und Überschriften bleiben unberührt. Fehler stehen als roter Quelltext auf der Folie und als Hinweis in `hashmark check`. Beispiele: `examples/formeln-demo`. PowerPoint: Formeln gehen als Bilder hinein (Blockformeln einzeln, Absätze mit Formel im Satz als ganzer Absatz), `\htmlData`-Teile werden Animationen.
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
  - **Diagramme als Schritte:** `![](a.drawio.svg){steps=layers}` blendet die Ebenen eines draw.io-Diagramms der Reihe nach ein. `![](map.excalidraw.svg){steps=groups order="3,1,2+4"}` macht das mit den Gruppen einer Excalidraw-Zeichnung (Export als SVG mit **„Szene einbetten“**). Gruppe k in Z-Reihenfolge (äußerste Gruppe) ist Schritt k, `order` legt eine andere Reihenfolge fest (Nummer = Gruppe, `,` = nächster Schritt, `+` = gleichzeitig; nicht genannte Gruppen bleiben sichtbar). Ungruppierte Elemente sind immer sichtbar. Die Schritte laufen mit `::: steps` in der Folie synchron. Beispiel: `examples/hashmark-demo/story-map.md`.
- **Gestaltung** (Beispiel: `examples/hashmark-demo/gestaltung.md`; ungültige Angaben meldet `hashmark check` als Hinweis):
  - **Bildband:** `## Titel {layout=banner banner=bilder/x.jpg bannerh=210 bannerpos="50% 60%"}` legt ein Bild als Band an den oberen Rand, der Titel steht darunter. `banner` funktioniert mit jedem Layout (`.slide-banner` im Theme-CSS).
  - **Bilder:** `![](x.png){fit=cover pos="50% 20%" ratio=16/9 step=2 until=3}`: Zuschnitt (`object-fit`, `object-position`, `aspect-ratio`) und Einblenden ab Schritt `step` bis vor `until`.
  - **Figur mit Beschriftungen:** `::: figure` um ein Bild oder Diagramm, darin frei platzierte Elemente. Position und Größe in Prozent der Figur (ohne Figur: der Folie): `at="x,y"`, `w=30` bzw. `size="breite,höhe"`, jedes mit `step=n`.
    - `::: bubble at="60,20" w=30 tail=left|right|up|down` – Sprechblase (Markdown darin erlaubt)
    - `::: frame at="10,15" size="30,25" label="Fokus"` – Hervorhebungsrahmen
    - `::: pin at="80,32"` mit `1` darin – nummerierte Markierung
  - **Karten:** `::: cards cols=3 steps` mit `::: card icon=user title="Titel"` und Text. `steps` blendet die Karten nacheinander ein. `icon` ist ein eingebauter Name (`user users target clock check x alert star book gear link cloud flag list map layers scissors search lock card bank phone bulb file code chart arrow ball sitemap shield mail calendar coffee rocket puzzle heart`) oder beliebiger Text, z. B. ein Emoji. Die Farbe setzt `accent=#…`.
  - **Tabellen:** `::: table widths="2:1:1" steps=rows|cols hl="r2c3,c1"` um eine Markdown-Tabelle: Spaltenbreiten, Zeilen oder Spalten als Schritte, Zellen hervorheben (`r` = Zeile, `c` = Spalte, 1-basiert, `r0` = Kopfzeile).
  - **Beliebiger Block als Schritt:** `::: reveal step=2` um Absatz, Tabelle, Bild oder Hinweis. `step=n` und `until=m` gehen an jedem Container (`::: col step=2`).
  - **SVG als Schritte:** `![](x.svg){steps=ids}`: Elemente mit `id="step-N"` (auch `step_N`, `step-N-name`) erscheinen ab Schritt N, gleiche Nummer gleichzeitig. Das SVG darf von Hand sein oder aus Inkscape, Figma und Illustrator stammen (Ebenen und Gruppen so benennen).
  - **QR-Code:** ` ```qr {size=220 label="Poster"} ` mit der Adresse im Block, erzeugt ein Inline-SVG ohne externen Dienst.
  - **Folienzahl und Fußzeile:** `footer: Acme Academy` und `slideNumber: "Seite {n} / {total}"` (`true` = nur die Zahl) in der `deck.yaml`. Nummeriert wird in Baumreihenfolge wie im PDF „Baum“. `## Titel {footer=off}` blendet sie auf einer Folie aus, Titel-, Kapitel- und Statement-Folien zeigen keine.
  - **Nummerierte Unterlisten:** `## Titel {.alpha}` zählt verschachtelte Listen als `1.` → `a.` → `i.` (ein Theme kann das für alle Folien setzen).
  - **Mermaid:** ` ```mermaid {height=520 look=hand align=left} `: `height` (px, Standard 460), `look=hand` (Skizzenstil), `align`. In Flussdiagrammen, Zuständen und Klassendiagrammen stehen die Theme-Klassen `accent`, `ok`, `warn`, `bad`, `important`, `muted` und `actor` bereit: `A[Start]:::accent`. `hashmark check` meldet fehlerhafte Diagramme.
- **`---` als Folientrenner** funktioniert auch ohne Leerzeile darüber. CommonMark würde daraus sonst eine Überschrift machen.
- **Theme** = CSS mit Tokens (`--color-*`, `--font-*`, `--radius`, `--space-*`, `--shiki-*`), eingebaute Themes in `src/runtime/themes/`. Kurzform: `theme: dark-tech` oder `theme: ./eigenes.css`. Ausführlich als Objekt (Beispiel: `examples/theme-demo`, `make dev DECK=examples/theme-demo`):
  ```yaml
  theme:
    extends: minimal            # minimal | dark-tech | ./datei.css | ./theme-ordner
    tokens:                     # überschreiben einzelne Tokens (mit oder ohne --)
      color-accent: "#e30613"
      radius: 4px
    layouts: ./theme/layouts    # Ordner (oder Liste) mit *.css: je Datei ein Layout `.layout-<name>`
    css: ./theme/brand.css      # weitere CSS-Dateien (eine oder Liste): Logo, Fußzeile, Schriften
  ```
  - Reihenfolge im fertigen CSS: Basis, `layouts`, `css`, zuletzt `tokens`. Ein Token gewinnt also immer.
  - **Theme-Ordner** als `extends`: `theme.css` (Pflicht) plus `layouts/*.css`. So lässt sich ein Theme in mehreren Decks wiederverwenden und pro Deck per `tokens` nachjustieren.
  - **Eigenes Layout:** Eine CSS-Datei mit `.layout-kpi { … }` im `layouts`-Ordner genügt, verwendet wird es mit `## Titel {layout=kpi}`. Jede Folie ist `section.slide.layout-<name>` mit `.slide-title` und `.content`.
  - Relative `url(…)` in Theme-CSS (Bilder, `woff2`/`woff`/`ttf`/`otf`) werden als Data-URI eingebettet, Build und Export bleiben autark.
  - Änderungen an Theme-Dateien laden live nach, auch außerhalb des Deck-Ordners. Fehlende Dateien und ungültige Tokens (z. B. mit `;`) erscheinen als Hinweis im Terminal.
- **Komponenten (eigene Container):** Eine Datei `components/<name>.html` macht `::: <name>` zu einem eigenen Baustein. Hashmark bringt `timeline`, `process`, `kpis` und `person` mit (`src/runtime/components/`), eigene liegen im Theme-Ordner oder im Deck-Ordner `components/` und überschreiben bei gleichem Namen (Reihenfolge: eingebaut, Theme, Deck). Daneben liegt `components/<name>.css`. Beispiel: `examples/komponenten-demo` (`make dev DECK=examples/komponenten-demo`).
  ```md
  ::: kpis steps
  ::: kpi value="87 %" label="Zufriedenheit" trend=up delta="+4 %"
  :::
  ::: kpi value="42" label="Teams"
  Anmerkung
  :::
  :::
  ```
  - Die Vorlage ist **logikfrei**: `{{ name }}` (maskiert), `{{ foto|image }}` (Bildpfad wie ein normales Bild auflösen), `{{{ body }}}` und `{{{ html }}}` (gerenderter Markdown), `{{#each items}}`, `{{#each children}}`, `{{#if x}}…{{else}}…{{/if}}`, `{{! Kommentar }}`. Keine Ausdrücke, kein JavaScript.
  - Variablen: alle Attribute des Containers (ein Flag wie `vertical` ist wahr), `body` (Inhalt), `count`; `items` (Listenpunkte der obersten Ebene) mit `html`, `text`, `index`, `number`, `first`, `last`, `step`; `children` (Kind-Container) mit deren Attributen, `kind`, `body` und denselben Zählern. `items` und `children` gibt es nur, wenn die Vorlage sie liest, sonst gehört der Inhalt zu `body`. `step` füllt sich bei `steps` (und `start=N`) am Container, ein eigenes `step=` am Kind gewinnt.
  - Der Container behält den Wrapper `.d-<name>` (damit gehen `class`, `step`, `until`). Der Inhalt läuft durch die normale Pipeline: Bilder, Code, Mermaid, Schritte und Editor-Sync funktionieren darin.
  - **Kopf `{{!meta … }}`** (YAML, ganz oben in der Vorlage): `description`, `attrs` und `flags` (Name → Beschreibung), `required`, `example` (wird vom Editor eingefügt) und `children` (Kind-Container mit eigenem `attrs`/`flags`/`required`). Der Kopf speist die Hinweise (unbekanntes Attribut mit „meintest du …?“, fehlendes Pflichtattribut, unbekannter Kind-Container) und den Editor: Vorschläge nach `::: ` und für Attribute, Linter.
  - Weitere Fehler erscheinen ebenfalls als Hinweis (`hashmark check`): Syntaxfehler mit Zeile, Inhalt ohne `{{{ body }}}`, Namen eingebauter Container (die gewinnen immer).

## Aufbau

```
src/core/      Parser (remark), Deck-Baum, Render-Plugins (Shiki, Mermaid), Navigator – ohne UI, getestet
src/vite/      Vite-Plugin: Deck als virtuelles Modul, Datei-Watcher, Hot Reload, Bild-Assets
src/runtime/   Svelte-5-App: Bühne, Layouts, Übergänge, Breadcrumb, Übersicht, Themes
src/runtime/editor/  Editor (editor.html): CodeMirror, Vorschau-Sync, Bild-Upload
src/cli/       hashmark dev | build | preview | export | pdf, gemeinsame Vite-Konfiguration, Deck-Gerüst
src/desktop/   Node-Sidecar der Desktop-App (stdin/stdout-Protokoll), Startseite (ui/)
desktop-go/    Desktop-App in Go (ohne CGO): Fenster, Menü, Dialoge, Bildschirmwahl
examples/      Beispiel-Decks: hashmark-demo (Funktionen, 3 Ebenen), theme-demo (eigenes Theme), komponenten-demo (eigene Container) und formeln-demo (KaTeX)
```

## Noch nicht umgesetzt

Die Reihenfolge der nächsten Ausbaustufen steht in der [Roadmap](roadmap.md). Noch offen sind z. B. Includes, `hidden`, PlantUML/D2/Graphviz, Auto-Layout/Auto-Fit, Hell/Dunkel-Umschaltung, Magic Move, Diagramm-Morphing (stabile Knotenpositionen) und eigene Layouts.
