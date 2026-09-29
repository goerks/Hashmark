# CLAUDE.md – Strata

Präsentations-App: 1..n Markdown-Dateien werden zu einem **navigierbaren Baum**. → erzählt auf dem Hauptpfad weiter, ↓ taucht ins Detail ab. Das Konzept steht in `konzept-markdown-praesentations-app.md`, die Bedienung für Anwender im `README.md`.

Sprache: Code-Kommentare, UI-Texte, Commit-Messages und Doku sind **deutsch**. Bezeichner im Code sind englisch.

## Befehle (immer über `make`, Node liegt im Projekt)

| Befehl | Zweck |
| --- | --- |
| `make setup` | Node nach `vendor/node` (falls fehlend) + `npm ci --offline` aus `vendor/npm-cache` |
| `make test` | Vitest (`tests/core.test.ts`, ca. 28 Tests, Kern-Logik ohne DOM) |
| `make dev` / `make edit` | Dev-Server bzw. Editor (`DECK=…`, `PORT=…`, Standard `examples/strata-demo`, 3030) |
| `make build` / `make export` / `make pdf` | statisches HTML / Single-File-HTML / PDF über Edge oder Chrome headless |
| `make deps-update` | neue Pakete online holen, landen im Cache `vendor/npm-cache` |

- Das Makefile nutzt `SHELL := cmd.exe`. Rezepte müssen in cmd funktionieren und stellen `vendor\node` vor den `PATH`.
- Node direkt aufrufen, z. B. für Skripte: `export PATH="$PWD/vendor/node:$PATH"` (Git Bash). Global ist **kein** Node installiert.
- Neue npm-Pakete mit `vendor/node/npm.cmd install <pkg>` installieren. Wegen `.npmrc` (`cache=./vendor/npm-cache`, `save-exact`) liegen sie danach offline im Repo. Die neuen Cache-Dateien mitcommitten.

## Harte Regeln

- **Keine externen Laufzeit-Abhängigkeiten:** kein CDN, keine Web-Fonts, alles gebündelt und offline lauffähig. Neue Pakete immer über den Vendor-Cache.
- **`vendor/` wird eingecheckt**, mit portablem Node 24 und npm-Cache. `.gitignore` ignoriert nur `/node_modules/`, `/dist/` und `/export/` im Root, sonst würde npm unter `vendor/node/node_modules` fehlen.
- **TypeScript läuft ohne Build-Schritt** über Node-Type-Stripping (CLI, Plugin, Kern). Deshalb:
  - nur „erasable syntax“: keine Parameter-Properties (`constructor(readonly x)`), keine Enums, keine Namespaces;
  - relative Imports **mit `.ts`-Endung**; reine Typen per `import type`.
- **Svelte 5 mit Runes.** Typ-Exports einer Komponente gehören in `<script module>`.

## Architektur

```
src/core/     framework-unabhängig, in Node und im Browser nutzbar, getestet
  types.ts      DeckNode/Slide/Step/Deck/Manifest – das zentrale Datenmodell
  syntax.ts     Pandoc-Container (::: name, gleich viele Doppelpunkte) → remark-directive (außen mehr ':'),
                Überschriften-Attribute {layout=… id=… .klasse}, parseAttrs
  parse.ts      Markdown → mdast → RawNode-Baum; maxDepth; Setext-Fix; Referenz-Bilder dateiweit
  render.ts     Blöcke → HTML je Sub-Slide: Shiki (CSS-Variablen-Theme), Mermaid-Platzhalter, Direktiven,
                ::: steps, Bilder (deck-assets/ bzw. Base64), Notizen; zählt data-step → slide.steps
  deck.ts       deck.yaml/Ordner → Mounts (under + automatisches Verschieben der Ebenen) → Deck + Theme-Pfad + Warnungen
  navigator.ts  reine State-Machine: next/prev/down/up (Pfeile), forward/backward (Space = Tiefensuche),
                Schritte, relocate (Hot Reload), progress, Deep-Link-Hash (#id:2)
  print.ts      Seitenlogik für Druck/PDF (Tiefe, Schritte, Handout, Fußzeile) + URL-Optionen
  sourcemap.ts  Editor-Sync: Zeile ↔ Knoten/Sub-Slide über DeckNode.source
src/vite/     plugin.ts: virtual:strata/deck (JSON), virtual:strata/theme.css, File-Watcher → HMR-Event
              'strata:deck', Bild-Middleware, Asset-Emit; editor-api.ts: Datei-API nur für `strata edit`
src/cli/      index.ts (cac: dev | edit | build | preview | export | pdf), export.ts (Single-File), pdf.ts (CDP)
src/runtime/  Svelte-App (Vite-Root!): main.ts wählt App oder PrintView (?print)
  App.svelte        Präsentation, Tasten, Hash-Sync, HMR, Editor-Messages, unsichtbare Druckseiten
  Slide.svelte      eine Folie: Layout, Schritte (data-step/data-until → .step-hidden), Mermaid
  NavControls/NavOverview/KeyHelp/PrintView/PrintPages, transitions.ts, mermaid.ts
  base.css, print.css, themes/*.css (nur Design-Tokens: --color-*, --font-*, --shiki-*, …)
  editor.html + editor/   Editor (CodeMirror 6), eigene neutrale Tokens (--ed-*)
```

Datenfluss: Markdown → `loadDeck` (Node, im Vite-Plugin) → Deck-JSON mit fertigem HTML je Slide → Client. Mermaid rendert erst im Client, mit den Farben aus den Theme-Tokens.

## Syntax (Kurzfassung)

- **Überschriften:** `#`…`######` sind Knoten. Die oberste Ebene einer Datei wird auf Tiefe 1 bzw. unter das `under`-Ziel gelegt. Überschriften tiefer als `maxDepth` werden Abschnitte innerhalb der Folie.
- **`---`** teilt einen Knoten in Sub-Slides. Auch direkt unter Text ist es ein Trenner (Setext-Fix nach dem Parsen, damit die Zeilennummern stimmen).
- **Container:** `::: col`, `::: columns`, `::: grid cols=… gap=…`, `::: steps [start=N]`, `::: notes`, `::: children`. Notizen auch per `<!-- notes -->`.
- **Schritte** synchronisieren sich über die Nummer:
  - Listenpunkte in `::: steps`;
  - Code ` ```ts {steps="1,6|2-3||4"} ` (Zeilen ohne Schritt bilden das Gerüst);
  - Mermaid `%% step` (kumulative Versionen übereinander).
- **Layouts:** `title`, `section` (Kacheln der Kinder), `default`, `two-col`. **Themes:** `minimal`, `dark-tech`.
- **Bilder:**
  - `![](pfad){width=60% .klasse}`;
  - Dateien außerhalb des Decks bzw. mit `embedImages: true` werden als Base64 eingebettet;
  - Referenz-Bilder `![a][ref]` + `[ref]: data:…`.

## Tests und Verifikation

- `make test` für den Kern. Neue Kern-Logik bekommt Tests in `tests/core.test.ts`. Temporäre Decks entstehen dort über `tempDeck()`.
- **UI im Browser prüfen:** mit Edge headless über CDP (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe --headless=new --remote-debugging-port=…`). Node 24 hat `fetch` und `WebSocket` eingebaut. Screenshots gehen per `Page.captureScreenshot`, Druck per `Page.printToPDF`, gezählt über `/Type /Page` im PDF.
- **Stolperstein:** Direkt nach dem Start des Dev-Servers optimiert Vite die Abhängigkeiten und lädt die Seite neu. Deshalb erst eine Aufwärm-Navigation machen, sonst sehen Tests „leere“ Zustände.
- **Stolperstein:** Synthetische Keyboard-Events auf `document.body` dispatchen, nicht auf `window`, weil `e.target.closest` verwendet wird.
- **Dev-Server stoppen:** nur den eigenen Prozess beenden, über den Port (`netstat -ano | grep :3030` → `taskkill //PID … //T //F`), nicht `taskkill /IM node.exe`.
- `pdftoppm` ist nicht vorhanden, PDFs lassen sich nicht als Bild ansehen. Stattdessen `Emulation.setEmulatedMedia({media:'print'})` + Screenshot.

## Bekannte Fallstricke (bereits gelöst – nicht wieder einbauen)

- **Druck:** Folien im Druck 2 px niedriger als 16:9 (`aspect-ratio: 1280/718`), `html, body { height: auto }`. Sonst entstehen durch Rundung oder Skalierung leere Zusatzseiten. Kein `100vh` für die Seitenhöhe.
- **Chromium wendet `place-items` auch auf Block-Layout an.** Für Druck/Block-Kontexte ausdrücklich `place-items: normal` setzen.
- **Bühne absolut zentrieren** (`left/top 50%` + `translate(-50%,-50%) scale()`), nicht per Grid. Sonst wird in Fenstern unter 1280 px links abgeschnitten.
- **Mermaid:** feste `max-height` (460px) statt `%`, weil sich das SVG in Spalten sonst an die Nachbarspalte anpasst. Der Versions-Container braucht `grid-template-columns: minmax(0,1fr)`.
- **Druckbereitschaft:** `document.documentElement.dataset.printReady = '1'` ist das Signal für `make pdf`. Die Präsentation rendert die Druckseiten nach 1,5 s bzw. bei `beforeprint` (`.print-only`).
- **Navigator:** `down()`/`forward()` merken sich die Position für ↑. Für reine Anzeige immer `peek = true` übergeben.
- **Editor-API:** nur localhost, Header `X-Strata-Editor: 1`, nur Pfade im Deck, nur `.md`/`.yaml`/Bilder. `strata edit` hat bewusst kein `--host`.
- Die Datei-API-Pfade und `deck-assets/` sind **relativ**, damit Builds auch in Unterverzeichnissen laufen (`base: './'`).

## Stand und offene Punkte

- **Umgesetzt:**
  - Baum-Navigation mit Steuerkreuz, Space der Linie nach, Presenter-Tasten
  - Schritte, Übersicht (Ctrl+Shift+O), Editor, Bilder
  - PDF/Druck (Ctrl+P, P, `make pdf`), Export, LAN, Docker
- **Offen, laut Konzept bzw. Vorschlägen:**
  - Code-Zeilen hervorheben (`lines=` wird schon geparst), Effekte für Schritte, Zoom aus der Kachel
  - stabile Diagramm-Schritte, Magic Move
  - Layouts `agenda`, `statement`, `image-left/right`, Hinweiskästen, Kennzahlen, Zeitleiste
  - Auto-Layout/Auto-Fit, PlantUML, Presenter-View, Suche, Plugin-API
- **Bekannter kleiner Bug:** Titel-Folien auf Ebene ≥ 2 („Danke“) zeigen den Titel zu klein, weil `.slide[data-depth] .slide-title` `.layout-title .slide-title` überschreibt.
- **Git:** Es gibt noch **kein Remote**, pushen ist erst mit URL möglich. Grösse ca. 125 MB wegen `vendor/`, `node.exe` hat 93 MB (Limit bei GitHub: 100 MB pro Datei).
- **Beispiel-Deck:** `01-einfuehrung.md` enthält einen Test-Abschnitt des Nutzers („### Test“). Nur auf Wunsch entfernen.
