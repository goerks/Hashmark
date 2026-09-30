# CLAUDE.md – Strata

Präsentations-App: 1..n Markdown-Dateien werden zu einem **navigierbaren Baum**. → erzählt auf dem Hauptpfad weiter, ↓ taucht ins Detail ab. Das Konzept steht in `konzept-markdown-praesentations-app.md`, die Bedienung für Anwender im `README.md`.

Sprache: Code-Kommentare, UI-Texte, Commit-Messages und Doku sind **deutsch**. Bezeichner im Code sind englisch.

## Befehle (immer über `make`, Node liegt im Projekt)

| Befehl | Zweck |
| --- | --- |
| `make setup` | Node nach `vendor/node` (falls fehlend) + `npm ci --offline` aus `vendor/npm-cache` |
| `make test` | Vitest (`tests/*.test.ts`, 64 Tests, Kern-Logik ohne DOM) |
| `make app` / `make app-build` / `make app-package` | Tauri-App: Debug bauen + starten (`DECK=…` optional) / Release bauen / portables `dist-app/Strata/` |
| `make toolchain` | einmalig Rust (`stable-x86_64-pc-windows-gnullvm`) + llvm-mingw nach `%LOCALAPPDATA%\strata-toolchain` (ohne Admin) |
| `make sidecar-smoke` | Node-Sidecar wie aus der App ansprechen: Deck, Datei-API, Aktionen, PDF, Handout, HTML (`SIDECAR_BUNDLE=1`: das Bündel) |
| `make build-examples` / `make docker-examples` | alle `examples/*` als statische Seiten mit Auswahlseite (`scripts/build-examples.ts`, `src/cli/examples.ts` teilt die Liste mit der Desktop-Startseite); Docker-Image `strata/beispiele` |
| `make app-test` | E2E der Tauri-App **headless** (`STRATA_HEADLESS=1`, Fenster unsichtbar) über WebView2-CDP; `VISIBLE=1` zeigt sie; schreibt `export/app-e2e/result.json` mit Zeiten |
| `make dev` / `make edit` | Dev-Server bzw. Editor (`DECK=…`, `PORT=…`, Standard `examples/strata-demo`, 3030). `make dev` ohne ausdrückliches `DECK=` startet mit `--examples`: Plugin-Option `examples` (plugin.ts, `/__strata/examples` GET/POST wechselt das Deck) + `src/runtime/example-switcher.ts` (nur `import.meta.env.DEV`) |
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
  render.ts     Blöcke → HTML je Sub-Slide: Shiki (CSS-Variablen-Theme, lines=/steps=), Mermaid-Platzhalter, Direktiven,
                ::: steps, Hinweiskästen > [!NOTE], cols=, Bilder (deck-assets/ bzw. Base64), Notizen pro Sub-Slide
                (::: notes step=k → [data-note-step]), image-left/right → .media/.body;
                zählt data-step und data-hl-count − 1 → slide.steps
  theme.ts      Theme v2: `theme:` (String | Objekt `extends/tokens/layouts/css`) → ein CSS-Text (Basis, layouts/*.css, css, zuletzt Tokens),
                Theme-Ordner (`theme.css` + `layouts/`), relative `url()` als Data-URI, Dateiliste fürs Watchen, Hinweise
  deck.ts       deck.yaml/Ordner → Mounts (under + automatisches Verschieben der Ebenen) → Deck + Theme-CSS (`themeCss`, `themeFiles`) + Warnungen;
                löst das Layout auf (Attribut > layouts[Ebene] > layout), bg=, duration=, erzeugt Agenda-HTML
  timing.ts     parseDuration (5m, 1h30m, 1:30), formatClock, pace – Zeitplan der Presenter-View
  search.ts     Suchindex (Titel, Pfad, Text je Sub-Slide), Wort-Suche + unscharfe Titel-Suche, Umlaute gefaltet
  navigator.ts  reine State-Machine: next/prev/down/up (Pfeile), forward/backward (Space = Tiefensuche),
                Schritte, relocate (Hot Reload), progress, Deep-Link-Hash (#id:2)
  print.ts      Seitenlogik für Druck/PDF (Tiefe, Schritte, Handout, Fußzeile) + URL-Optionen
  sourcemap.ts  Editor-Sync: Zeile ↔ Knoten/Sub-Slide über DeckNode.source
src/desktop/  Node-Sidecar der Tauri-App: sidecar.ts (stdin JSON-Zeilen → stdout `@@strata {…}`; open/isDeck/scaffold/examples/
              recent/forget/pdf/html/position/close; Ereignis `action` aus den Seiten), settings.ts, ui/ (Startseite, Tauri-invoke)
  live-server.ts   statt Vite-Dev-Server: runtime-dist/ statisch, /__strata/deck.json, /__strata/theme.css,
                   /__strata/events (SSE: deck | reload), deck-assets/, Datei-API + App-Aktionen; fs.watch rekursiv
  paths.ts (src/cli) PROJECT_ROOT/realPath ohne Abhängigkeiten – der Sidecar importiert nur Leichtes beim Start, alles Schwere per import()
  bundle-sidecar (scripts/) sidecar.ts → sidecar.bundle.mjs + bundle-*.mjs (Vite SSR-Build, Vite/Svelte/Shiki extern); nur im Paket
  runtime-build.ts vorgebaute Runtime (liveConfig + src/vite/live-plugin.ts), Stempel = Inhalts-Hash der Quellen
src/runtime/deck-source.ts  onDeckUpdate(): Vite-HMR ('strata:deck') bzw. EventSource in der App (window.__STRATA_LIVE__)
src-tauri/    Tauri 2 (Rust): main.rs startet vendor/node/node.exe mit dem Sidecar (gepackt: node/ + app/ neben der EXE),
              Hauptfenster = Startseite (tauri://) bzw. Editor (http://127.0.0.1), Menü, Dialoge, Präsentation (Vollbild
              extern) + Presenter (primär), on_new_window → Deny. Capability nur für das Hauptfenster/lokale Startseite.
src/vite/     plugin.ts: virtual:strata/deck (JSON), virtual:strata/theme.css, File-Watcher → HMR-Event
              'strata:deck', Bild-Middleware, Asset-Emit; editor-api.ts: Datei-API nur für `strata edit`
src/cli/      index.ts (cac: dev | edit | build | preview | export | pdf), config.ts (gemeinsame Vite-Konfiguration),
              export.ts (Single-File), pdf.ts (CDP), scaffold.ts (Deck-Gerüst für make new)
src/runtime/  Svelte-App (Vite-Root!): main.ts wählt App oder PrintView (?print)
  App.svelte        Präsentation, Tasten (navKey), Hash-Sync, HMR, Editor-Messages, Presenter-Link, Suche,
                    Notiz-Overlay (N), unsichtbare Druckseiten
  Slide.svelte      eine Folie: Layout, Schritte (data-step/data-until → .step-hidden), Zeilen-Hervorhebung (.hl), bg, Mermaid
  PresenterView.svelte  ?presenter: zweites Fenster, per postMessage gekoppelt (presenter-link.ts); eigener Navigator
                    nur für die Vorschau (peek). Dazu ScaledSlide.svelte, Notes.svelte, Search.svelte, presenter.css
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
  - Listenpunkte in `::: steps` bzw. automatisch per `## Titel {steps}` (`markAutoSteps` in render.ts; `{steps}` ist das einzige Überschriften-Flag ohne `=`/`.`/`#`, siehe `splitHeadingAttrs`; `::: steps` in der Folie hat Vorrang);
  - Code ` ```ts {steps="1,6|2-3||4"} ` (Zeilen ohne Schritt bilden das Gerüst);
  - Mermaid `%% step` (kumulative Versionen übereinander).
- **Layouts:** `title`, `section` (Kacheln der Kinder), `default`, `two-col`, `three-col`, `statement`, `quote`, `image-left`, `image-right`, `agenda`, `comparison`, `code-focus`. Je Ebene über `layouts: { 1: section }`.
- **Themes:** `minimal`, `dark-tech`. Die Tokens enthalten auch `--color-success`, `--color-warning` und `--color-important` für Hinweiskästen. **Theme v2:** `theme:` darf ein Objekt sein (`extends`, `tokens`, `layouts`, `css`), Beispiel und Doku auf Folien in `examples/theme-demo`. Eigene Layouts = `.layout-<name>` in einer CSS-Datei. Das Theme-CSS ist kein Dateipfad mehr, sondern ein virtuelles Modul (`\0strata-theme.css`) bzw. `/__strata/theme.css` aus `themeCss`.
- **Auto-Fit/Überlauf:** `{fit}` (bares Flag, wie `{steps}`). `src/runtime/fit.ts` misst `scrollHeight/Width` der Folie, `.content` und `pre` (Layout-Maße ohne Skalierung) und setzt bei `fit` `zoom` am `.content` (Schritt 0,05, Minimum 0,7). `Slide.svelte` misst nach dem Rendern, nach Mermaid und `document.fonts.ready`, setzt `data-overflow`/`data-fit` und zeigt das Badge nur bei `import.meta.env.DEV` oder in einem Iframe (Editor-Vorschau).
- **Knoten-Attribute:** `layout`, `id`, `transition`, `.klasse`, `duration=5m`, `bg=…` (Farbe/Verlauf bleibt CSS, sonst Bild → `url(…)`), `bgdim=0.5`.
- **Code:** `lines="2-3|5|all"`: Abschnitt k gilt ab Schritt k (Abschnitt 0 sofort), `all` bzw. leer = nichts abdunkeln.
- **Hinweiskästen:** `> [!NOTE|TIP|IMPORTANT|WARNING|CAUTION] [eigener Titel]`.
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
- **Slugs behalten Umlaute** (github-slugger): `# Präsentieren` → Id `präsentieren`, im Hash `#pr%C3%A4sentieren`. In CDP-Tests die Ids kodieren.
- **Presenter-Link** (`presenter-link.ts`):
  - Unter http(s) läuft er über BroadcastChannel (`strata-presenter:<pfad>`). Der funktioniert ohne `window.opener`, also auch mit Tauri-Fenstern und eigenen Tabs.
  - Unter file:// (Export) läuft er über postMessage an das Partnerfenster. Vertraut wird über `e.source` bzw. denselben Origin.
  - Jede Präsentation hat eine `session`. Die Presenter-View koppelt sich an eine und adressiert Tasten per `target`. Die Editor-Vorschau (`embedded`) nimmt nicht teil.
  - Hello jede Sekunde, so übersteht die Verbindung ein Neuladen. Quelle der Wahrheit bleibt die Präsentation.
- **Desktop-Modus der Seiten:** Das Vite-Plugin mit `onAppAction` setzt `window.__STRATA_DESKTOP__` (transformIndexHtml). Dann gehen P/S/PDF/Präsentieren/Ctrl+W per `POST /__strata/app` (Header `X-Strata-Editor`) an den Sidecar statt per `window.open`.
- **Tauri spritzt `__TAURI__` in jede Seite ein**, auch in die vom lokalen Server. Aufrufe werden dort aber abgelehnt („not allowed“), weil die Capability nur das Hauptfenster mit der lokalen Startseite abdeckt. Nie `remote`-URLs in die Capability aufnehmen.
- **Tauri-Build ohne Visual Studio:** Toolchain `x86_64-pc-windows-gnullvm` + llvm-mingw (`src-tauri/rust-toolchain.toml`, `.cargo/config.toml`). `+crt-static` ist nötig, sonst hängt die EXE an `libunwind.dll` und startet außerhalb der Build-Umgebung nicht. Git Bash meldet das irreführend als fehlende `api-ms-win-crt-…`-DLL.
- **Kaltstart auf frisch kopierten Dateien:** Node liest beim ersten Import hunderte kleine Dateien (unified, remark, micromark …). Jede prüft der Virenscanner: kalt 10–30 s, warm 0,3 s. Deshalb ist der Sidecar im Paket ein Bündel (`scripts/bundle-sidecar.ts`, wird von `package-app.ts` erzeugt und danach wieder gelöscht, damit die Entwicklung bei den Quellen bleibt; `STRATA_SIDECAR_SOURCE=1` erzwingt die Quelle). Dazu `NODE_COMPILE_CACHE` im Datenordner. Messen mit frischer Kopie (`robocopy`) an einen neuen Ort, nicht mit dem zuletzt benutzten Ordner.
- **Aufwärmen im Sidecar** (`warmUp()`): Kern + Shiki laden und das zuletzt geöffnete Deck lesen, während die Startseite zu sehen ist. `open` nutzt das vorab gelesene Deck nur, wenn `isStale()` keine Änderung seit dem Lesen findet (mtime von Ordner und Deck-Dateien).
- **Headless-Tests der App:** `STRATA_HEADLESS=1` macht alle Fenster unsichtbar (Hauptfenster `visible(false)`, Präsentation/Presenter werden nicht gezeigt). Die Seiten laufen trotzdem, WebView2-CDP funktioniert. Screenshots unsichtbarer Fenster sind unzuverlässig, daher nur bei `VISIBLE=1` sinnvoll.
- **Kein Vite-Dev-Server in der App:** Die Vorbündelung (`deps_temp_… → deps`) scheitert unter Windows oft mit `EPERM rename`, weil Virenscanner oder Indexer die Dateien sperren. Die Seite wartet dann minutenlang. Deshalb liefert die App eine vorgebaute Runtime über `live-server.ts` aus. `make dev`/`make edit` nutzen weiterhin Vite. Neue virtuelle Module oder HMR-Ereignisse brauchen beide Wege (`strata()` und `strataLive()`, `onDeckUpdate`).
- **8.3-Kurznamen (`C:\Users\MICHAE~1\…`, typisch in %TEMP%):** Vite verweigert Dateien, wenn Freigabe und Anfrage in unterschiedlicher Form vorliegen (`outside of Vite serving allow list`, `/@vite/client` → 404). Deshalb löst `config.ts` (`realPath`), `deck.ts` (Themes) und `main.rs` (`long_path` für EXE- und App-Ordner) alles auf lange Pfade auf.
- **Gepacktes Programm:** Mit der GNU-Toolchain ist der WebView2-Loader dynamisch gelinkt, `WebView2Loader.dll` muss neben `Strata.exe` liegen (erledigt `package-app.ts`).
- **Ohne Feature `custom-protocol`** erwartet Tauri einen Dev-Server. Es steht als Default in `Cargo.toml`.
- **Drag & Drop:** Das Hauptfenster nutzt `disable_drag_drop_handler()`, damit Bilder im Editor per HTML5-Drag & Drop funktionieren.
- **WebView2 per CDP testen:** App mit `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>` starten, dann wie bei Edge über `/json/list`.
- **Tasten per CDP:** Für `window.open` (Taste S) braucht es `Input.dispatchKeyEvent`, also eine echte Nutzer-Geste. Synthetische Events öffnen kein Popup.
- **Shell:** Markdown mit Backticks nie in `node -e "…"` bzw. doppelten Anführungszeichen bearbeiten, Bash führt sie als Befehle aus. Dafür das Edit-Werkzeug nehmen.
- **Editor-API:** nur localhost, Header `X-Strata-Editor: 1`, nur Pfade im Deck, nur `.md`/`.yaml`/Bilder. `strata edit` hat bewusst kein `--host`.
- Die Datei-API-Pfade und `deck-assets/` sind **relativ**, damit Builds auch in Unterverzeichnissen laufen (`base: './'`).

## Stand und offene Punkte

- **Umgesetzt:**
  - Baum-Navigation mit Steuerkreuz, Space der Linie nach, Presenter-Tasten
  - Schritte, Übersicht (Ctrl+Shift+O), Editor, Bilder
  - PDF/Druck (Ctrl+P, P, `make pdf`), Export, LAN, Docker
  - **Stufe 1 der Roadmap** (`roadmap.md`):
    - Presenter-View (S) mit Timer, Zeitplan und Baum
    - Notizen pro Sub-Slide und Schritt, Notiz-Overlay (N)
    - Suche (Ctrl+K, /)
    - Code-Zeilen hervorheben, Hinweiskästen
    - Layouts `statement`, `quote`, `image-*`, `agenda`, `three-col`, dazu `cols=`, `bg=` und Layouts je Ebene
    - Titel-Bug auf Ebene ≥ 2 behoben (`:where` bei den Größen je Ebene)
  - **Desktop-App mit Tauri** (Node als Sidecar). Eine Electron-Version wurde gebaut und auf Wunsch komplett zurückgenommen, auch aus der Git-Historie: Sie war zu groß.
- **Offen:** Stufen 2–6 in `roadmap.md`, u. a. Plugin-API, Theme v2, FS-Abstraktion, Editor-Inspector, Auto-Fit, weitere Diagrammsprachen, Animationen, Outliner.
- **Regel:** keine großen Binärdateien ins Repo (über das bestehende `vendor/` hinaus). Build-Werkzeuge (Rust, llvm-mingw, Crates) liegen im Benutzerprofil.
- **Git:** Es gibt noch **kein Remote**, pushen ist erst mit URL möglich. Grösse ca. 125 MB wegen `vendor/`, `node.exe` hat 93 MB (Limit bei GitHub: 100 MB pro Datei).
- **Beispiel-Deck:** `01-einfuehrung.md` enthält einen Test-Abschnitt des Nutzers („### Test“). Nur auf Wunsch entfernen.
