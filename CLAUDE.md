# CLAUDE.md – Hashmark

Slogan: „Mächtige Präsentationen aus reinem Markdown.“ Präsentations-App: 1..n Markdown-Dateien werden zu einer Slideshow als **navigierbarem Baum**. → erzählt auf dem Hauptpfad weiter, ↓ taucht ins Detail ab. Das Konzept steht in `konzept-markdown-praesentations-app.md`, die Bedienung für Anwender im `README.md`.

Sprache: Code-Kommentare, UI-Texte, Commit-Messages und Doku sind **deutsch**. Bezeichner im Code sind englisch.

## Befehle (immer über `make`, Node liegt im Projekt)

| Befehl | Zweck |
| --- | --- |
| `make setup` | Node nach `vendor/node` (falls fehlend) + `npm ci --offline` aus `vendor/npm-cache` |
| `node scripts/make-icon.ts [logo.png]` | Programm-Icon und Favicon aus `assets/hashmark.png` neu erzeugen (mit Datei: Logo zuschneiden und ersetzen) |
| `make test` | Vitest (`tests/*.test.ts`, 121 Tests, Kern-Logik ohne DOM) |
| `make app` / `make app-cross` / `make app-package` | Desktop-App (Go): bauen + starten (`DECK=…` optional) / Hülle für Windows, Linux, macOS (amd64, arm64) nach `dist-go/` / portables `dist-app/Hashmark/` (windows-amd64). Andere Ziele samt Archiv: `node scripts/package-app.ts <ziel> --version=… --archive` (online, lädt Node und die Pakete des Ziels) |
| `hashmark --version` | Version `<letzter Tag ohne v>.<Kurz-Hash>`, per `-ldflags "-X main.version=…"` eingebettet (`make` über `git describe`, in der Pipeline der Job `version`); `VERSION=…` überschreibt |
| Go | liegt **nicht** im Repo (ab 1.26, im `PATH`). Mehr braucht die Desktop-Hülle nicht: kein CGO, kein C-Compiler, kein Rust |
| `make sidecar-smoke` | Node-Sidecar wie aus der App ansprechen: Deck, Datei-API, Aktionen, PDF, Handout, HTML (`SIDECAR_BUNDLE=1`: das Bündel) |
| `make build-examples` / `make docker-examples` | alle `examples/*` als statische Seiten mit Auswahlseite (`scripts/build-examples.ts`, `src/cli/examples.ts` teilt die Liste mit der Desktop-Startseite); Docker-Image `hashmark/beispiele` |
| `make app-test` | E2E der Desktop-App **headless** (`HASHMARK_HEADLESS=1`, Fenster unsichtbar) über WebView2-CDP, nutzt `dist-app/Hashmark` bzw. `export/hashmark.exe` (`make app`); `VISIBLE=1` zeigt sie; schreibt `export/app-e2e/result.json` mit Zeiten |
| `make serve` / `make image` / `make image-run` | Webdienst lokal (`hashmark serve`, `EDITOR_PASSWORD`, Standard „geheim“) / Docker-Image des Webdienstes (`Dockerfile` im Root) bauen / starten |
| `make dev` / `make edit` | Dev-Server bzw. Editor (`DECK=…`, `PORT=…`, Standard `examples/hashmark-demo`, 3030). `make dev` ohne ausdrückliches `DECK=` startet mit `--examples`: Plugin-Option `examples` (plugin.ts, `/__hashmark/examples` GET/POST wechselt das Deck) + `src/runtime/example-switcher.ts` (nur `import.meta.env.DEV`) |
| `make build` / `make export` / `make pdf` | statisches HTML / Single-File-HTML / PDF über Edge oder Chrome headless (`PLAN=path` oder `PLAN=grouped`: Reihenfolge nach Vortragsplan) |
| `make check` | `hashmark check`: `src/core/check.ts` (statisch: Layouts, Attribute, Übergänge, Hinweise des Ladens), `src/cli/check.ts` (Überlauf: Build + Druckansicht per Edge/Chrome, liest `data-overflow` der `.print-page[data-node][data-sub]`); Exit 1 bei Fehlern; `pdf.ts`: `withPrintView`/`serveBuild` geteilt mit dem PDF-Export |
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
  navigator.ts  reine State-Machine: next/prev/down/up (Pfeile, frei im Baum), forward/backward (Space = dem Vortragsplan nach),
                Schritte, relocate (Hot Reload), progress, Deep-Link-Hash (#id:2); Plan-Zustand je Knoten (state/onPath),
                Ausflug-Stapel (trip, begin/jumpTo/sync), with() für Kopien mit neuem Plan
  plan.ts       Vortragsplan: PlanState (path|optional|appendix), authorPlan (Flags), PlanFile (.hashmark/plan.json, tolerant gelesen),
                Vorlagen (presetAll/Depth/Budget), setSubtree/resetSubtree, summarize (Zeitschätzung), planGroups (Reihenfolge fürs PDF)
  print.ts      Seitenlogik für Druck/PDF (Tiefe, Schritte, Handout, Fußzeile, Reihenfolge nach Plan: tree|path|grouped) + URL-Optionen
  sourcemap.ts  Editor-Sync: Zeile ↔ Knoten/Sub-Slide über DeckNode.source, pathToNode (Brotkrumen)
  snippets.ts   Bausteine (`§` = Cursor, `expand` markiert das Platzhalterwort dahinter)
  vocab.ts      Wortschatz für Editor: Layouts/Container/Attribute mit Beschreibung (Quelle: check.ts), fold, nearest („Meinst du …?“)
  complete.ts   `completionAt(text, pos)`: Vorschläge je Kontext (`/`, `::: `, ```` ```x ````, `> [!`, `{…}`, `layout=`); rein, getestet
  lint.ts       `lintText(text)`: unbekannte Layouts/Attribute/Container, offene `:::`/Codeblöcke, mit Offsets und Korrektur; rein, getestet
  excalidraw.ts Excalidraw-SVG: Szene aus `<metadata>` (zlib/bstring) → Gruppen per Reihenfolge den Top-Level-`<g>` zuordnen → `data-step`; drawio.ts analog mit Ebenen
src/desktop/  Node-Sidecar der Desktop-App: sidecar.ts (stdin JSON-Zeilen → stdout `@@hashmark {…}`; open/isDeck/scaffold/examples/
              recent/forget/pdf/html/position/close; Ereignis `action` aus den Seiten), settings.ts, ui/ (Startseite, `fetch` an `api/<befehl>` der Hülle)
  live-server.ts   statt Vite-Dev-Server: runtime-dist/ statisch, /__hashmark/deck.json, /__hashmark/theme.css,
                   /__hashmark/events (SSE: deck | reload), deck-assets/, Datei-API + App-Aktionen; fs.watch rekursiv
  paths.ts (src/cli) PROJECT_ROOT/realPath ohne Abhängigkeiten – der Sidecar importiert nur Leichtes beim Start, alles Schwere per import()
  bundle-sidecar (scripts/) sidecar.ts → sidecar.bundle.mjs + bundle-*.mjs (Vite SSR-Build, Vite/Svelte/Shiki extern); nur im Paket
  runtime-build.ts vorgebaute Runtime (liveConfig + src/vite/live-plugin.ts), Stempel = Inhalts-Hash der Quellen
src/runtime/deck-source.ts  onDeckUpdate(): Vite-HMR ('hashmark:deck') bzw. EventSource in der App (window.__HASHMARK_LIVE__)
desktop-go/   Desktop-Hülle in Go ohne CGO (go-webview per purego, zenity für Dialoge): main.go (Ablauf, `locate`, Kindprozess `--window`), app.go (Decks, Export,
              Menü, Präsentation/Presenter als eigene Prozesse, Tastenkürzel-JS), api.go (Server der Startseite, `api/<befehl>` mit Header X-Hashmark-App),
              sidecar.go (JSON-Zeilen), native_windows.go (Win32-Menü, Vollbild/Monitore, Symbol), native_linux.go (GTK 3 per purego), native_darwin.go (Objective-C-Laufzeit per purego), native_unix.go; Linux/macOS sind ungetestet und schalten sich bei fehlenden Symbolen ab;
              gepackt `node/` + `app/` neben der EXE, sonst das Repository (`locate`)
src/vite/     plugin.ts: virtual:hashmark/deck (JSON), virtual:hashmark/theme.css, File-Watcher → HMR-Event
              'hashmark:deck', Bild-Middleware, Asset-Emit (auch `.hashmark/plan.json` als `__hashmark/plan`);
              editor-api.ts: Datei-API nur für `hashmark edit`, `planApi` (GET/PUT /__hashmark/plan → .hashmark/plan.json) immer
src/cli/      index.ts (cac: dev | edit | serve | build | preview | export | pdf | check), serve.ts (Webdienst: Seed, Runtime, Live-Server mit `web`-Option), config.ts (gemeinsame Vite-Konfiguration),
              export.ts (Single-File), pdf.ts (CDP), scaffold.ts (Deck-Gerüst für make new)
src/runtime/  Svelte-App (Vite-Root!): main.ts wählt App oder PrintView (?print)
  App.svelte        Präsentation, Tasten (navKey), Hash-Sync, HMR, Editor-Messages, Presenter-Link, Suche,
                    Notiz-Overlay (N), unsichtbare Druckseiten
  Slide.svelte      eine Folie: Layout, Schritte (data-step/data-until → .step-hidden), Zeilen-Hervorhebung (.hl), bg, Mermaid
  PresenterView.svelte  ?presenter: zweites Fenster, per postMessage gekoppelt (presenter-link.ts); eigener Navigator
                    nur für die Vorschau (peek), bekommt Ausflüge und T-Zustand aus der Präsentation. Dazu ScaledSlide.svelte,
                    Notes.svelte, Search.svelte, presenter.css
  PlanPanel.svelte  Vortragsplan bearbeiten (Presenter-View, Taste P): Rolle je Knoten, Vorlagen, Fahrpläne, Zeitsumme;
                    plan-store.ts lädt/speichert (Server-Datei, sonst localStorage)
  NavControls/NavOverview/KeyHelp/PrintView/PrintPages, transitions.ts, mermaid.ts
  base.css, print.css, themes/*.css (nur Design-Tokens: --color-*, --font-*, --shiki-*, …)
  editor.html + editor/   Editor (CodeMirror 6), eigene neutrale Tokens (--ed-*): codemirror.ts (Setup, API), hashmark-lang.ts (Decorations für ::: und {…}, Highlight-Klassen .tok-*/.st-*),
                    assist.ts (Autocomplete, Linter, Formatleiste), Palette.svelte (Strg+K), KeyBar.svelte (Tablet), Editor.svelte; Layout A „Fokus“, unter 900 px Schublade + gestapelt
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
- **Themes:** `minimal`, `dark-tech`. Die Tokens enthalten auch `--color-success`, `--color-warning` und `--color-important` für Hinweiskästen. **Theme v2:** `theme:` darf ein Objekt sein (`extends`, `tokens`, `layouts`, `css`), Beispiel und Doku auf Folien in `examples/theme-demo`. Eigene Layouts = `.layout-<name>` in einer CSS-Datei. Das Theme-CSS ist kein Dateipfad mehr, sondern ein virtuelles Modul (`\0hashmark-theme.css`) bzw. `/__hashmark/theme.css` aus `themeCss`.
- **Auto-Fit/Überlauf:** `{fit}` (bares Flag, wie `{steps}`). `src/runtime/fit.ts` misst `scrollHeight/Width` der Folie, `.content` und `pre` (Layout-Maße ohne Skalierung) und setzt bei `fit` `zoom` am `.content` (Schritt 0,05, Minimum 0,7). `Slide.svelte` misst nach dem Rendern, nach Mermaid und `document.fonts.ready`, setzt `data-overflow`/`data-fit` und zeigt das Badge nur bei `import.meta.env.DEV` oder in einem Iframe (Editor-Vorschau).
- **Vortragsplan:** `{optional}` / `{appendix}` (bare Flags, wie `{steps}`) und `{plan=path|optional|appendix}` setzen den Standard des Autors; die Rolle erbt der Unterbaum.
  - Space (`forward`) läuft nur über Pfad-Knoten; Optionales/Anhang werden übersprungen. Ohne Flags und Plan verhält es sich wie die frühere Tiefensuche.
  - Wirksamer Zustand (`Navigator.state`): nächste Überschreibung des Vortragenden auf dem Weg nach oben, sonst nächster Autor-Standard, sonst `path`. `all` (Taste T) ignoriert den Plan.
  - ↓ (`down`) geht ins erste Kind abseits des Pfads und beginnt dann einen Ausflug (Rückkehrmarke); gibt es keins, ist es wie früher das erste Kind. Space führt am Ende des Ausflugs zur Abzweigung zurück. Ein Sprung (`jumpTo`: Suche, Übersicht, Presenter-Baum) auf einen Knoten abseits des Pfads ist ein Ausflug mit einer Folie.
  - Arrow-Tasten (`next/prev/up`) ignorieren den Plan; `sync(pos)` beendet Ausflüge, in denen die Position nicht mehr liegt.
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
  - Unter http(s) läuft er über BroadcastChannel (`hashmark-presenter:<pfad>`). Der funktioniert ohne `window.opener`, also auch mit App-Fenstern und eigenen Tabs.
  - Unter file:// (Export) läuft er über postMessage an das Partnerfenster. Vertraut wird über `e.source` bzw. denselben Origin.
  - Jede Präsentation hat eine `session`. Die Presenter-View koppelt sich an eine und adressiert Tasten per `target`. Die Editor-Vorschau (`embedded`) nimmt nicht teil.
  - Hello jede Sekunde, so übersteht die Verbindung ein Neuladen. Quelle der Wahrheit bleibt die Präsentation.
- **Vortragsplan (Fahrpläne):**
  - Gespeichert wird nur die Überschreibung je Knoten-ID in `.hashmark/plan.json` (`{ active, plans: { Name: { states, budget? } } }`, tolerant gelesen in `parsePlanFile`). Der Datei-Watcher überspringt Punkt-Ordner, ein Speichern löst also keinen Reload aus.
  - Die Presenter-View ist der einzige Ort zum Bearbeiten. Sie schickt den Plan als `hashmark:presenter-plan` **an alle** Präsentationen (kein `target`: der Plan gehört zum Deck, nicht zur Sitzung); die Präsentation meldet Ausflüge und `all` im `presenter-state` zurück, damit die Vorschau „Als Nächstes“ stimmt.
  - `plan-store.ts`: Server (`./__hashmark/plan`, relativ, mit Header `X-Hashmark-Editor`), sonst `localStorage`. Schlägt das PUT fehl (Webdienst ohne Anmeldung, statischer Export), gilt der Browser-Speicher als neuer (Flag `…:local`).
  - Im Webdienst liegt `/__hashmark/plan` hinter dem Passwort wie die Datei-API (nicht in `PUBLIC_API`).
  - Zeitschätzung: `{duration}` nur an Blättern, sonst 1 min je Sub-Slide (`ownSeconds`). `duration` an Kapiteln gilt für das ganze Kapitel samt Details.
  - Vorlage „Zeitbudget“ schreibt nur die rausgeworfenen Knoten (`optional`). Ein ausdrückliches `path` an einem Elternknoten würde den Autor-Standard (`appendix`) der Kinder überstimmen.
- **Desktop-Modus der Seiten:** Das Vite-Plugin mit `onAppAction` setzt `window.__HASHMARK_DESKTOP__` (transformIndexHtml). Dann gehen P/S/PDF/Präsentieren/Ctrl+W per `POST /__hashmark/app` (Header `X-Hashmark-Editor`) an den Sidecar statt per `window.open`.
- **Go-Hülle (`desktop-go/`):**
  - Die Webview-Bibliothek kennt **ein Fenster je Prozess** und keinen Hook für neue Fenster. Präsentation und Presenter sind deshalb Kindprozesse derselben EXE (`--window URL --mode presentation|presenter`). Schließt die Präsentation, beendet der Hauptprozess auch den Presenter.
  - Das Menü ist ein Win32-Menü über eine Fensterprozedur (`SetWindowLongPtr`). Tastenkürzel greifen darüber nicht, weil WebView2 Tasten selbst verarbeitet: `shortcutsJS` (app.go) fängt sie in jeder Seite des Hauptfensters (nicht in iframes) ab und ruft `window.hmMenu(id)` (Bind).
  - Die Startseite hat einen eigenen Server (api.go). Ihre Befehle verlangen den Header `X-Hashmark-App`, das löst bei fremden Origins einen Preflight aus, den der Server nicht beantwortet. Die Prüfung auf `127.0.0.1` im Host schützt vor DNS-Rebinding.
  - Externe Links (http/https/mailto) und `window.open` fängt `externalLinksJS` (app.go) in allen Frames ab und ruft `hmOpen` (Bind), das nur diese Schemata im Standardbrowser öffnet.
  - Die eingebettete Webview-Bibliothek entpackt sich nach `%TEMP%\webview-<Version>`.
  - Go-Builds **immer mit `CGO_ENABLED=0`** (`make app-cross` setzt es), sonst hängt purego-fremder Code am C-Compiler. Windows: `-ldflags="-H windowsgui"`, sonst erscheint ein Konsolenfenster.
  - Backslashes in Pfaden: Beim Bearbeiten von Makefile/Skripten per Shell gehen sie leicht verloren (aus `\d` wird ein Steuerzeichen). Das Edit-Werkzeug nehmen.
- **Kaltstart auf frisch kopierten Dateien:** Node liest beim ersten Import hunderte kleine Dateien (unified, remark, micromark …). Jede prüft der Virenscanner: kalt 10–30 s, warm 0,3 s. Deshalb ist der Sidecar im Paket ein Bündel (`scripts/bundle-sidecar.ts`, wird von `package-app.ts` erzeugt und danach wieder gelöscht, damit die Entwicklung bei den Quellen bleibt; `HASHMARK_SIDECAR_SOURCE=1` erzwingt die Quelle). Dazu `NODE_COMPILE_CACHE` im Datenordner. Messen mit frischer Kopie (`robocopy`) an einen neuen Ort, nicht mit dem zuletzt benutzten Ordner.
- **Aufwärmen im Sidecar** (`warmUp()`): Kern + Shiki laden und das zuletzt geöffnete Deck lesen, während die Startseite zu sehen ist. `open` nutzt das vorab gelesene Deck nur, wenn `isStale()` keine Änderung seit dem Lesen findet (mtime von Ordner und Deck-Dateien).
- **Headless-Tests der App:** `HASHMARK_HEADLESS=1` macht alle Fenster unsichtbar (Hauptfenster `visible(false)`, Präsentation/Presenter werden nicht gezeigt). Die Seiten laufen trotzdem, WebView2-CDP funktioniert. Screenshots unsichtbarer Fenster sind unzuverlässig, daher nur bei `VISIBLE=1` sinnvoll.
- **Kein Vite-Dev-Server in der App:** Die Vorbündelung (`deps_temp_… → deps`) scheitert unter Windows oft mit `EPERM rename`, weil Virenscanner oder Indexer die Dateien sperren. Die Seite wartet dann minutenlang. Deshalb liefert die App eine vorgebaute Runtime über `live-server.ts` aus. `make dev`/`make edit` nutzen weiterhin Vite. Neue virtuelle Module oder HMR-Ereignisse brauchen beide Wege (`hashmark()` und `hashmarkLive()`, `onDeckUpdate`).
- **8.3-Kurznamen (`C:\Users\MICHAE~1\…`, typisch in %TEMP%):** Vite verweigert Dateien, wenn Freigabe und Anfrage in unterschiedlicher Form vorliegen (`outside of Vite serving allow list`, `/@vite/client` → 404). Deshalb löst `config.ts` (`realPath`), `deck.ts` (Themes) und `main.go` (`longPath` für EXE- und App-Ordner) alles auf lange Pfade auf.
- **WebView2 per CDP testen:** App mit `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>` starten, dann wie bei Edge über `/json/list`.
- **Tasten per CDP:** Für `window.open` (Taste S) braucht es `Input.dispatchKeyEvent`, also eine echte Nutzer-Geste. Synthetische Events öffnen kein Popup.
- **Shell:** Markdown mit Backticks nie in `node -e "…"` bzw. doppelten Anführungszeichen bearbeiten, Bash führt sie als Befehle aus. Dafür das Edit-Werkzeug nehmen.
- **Editor-API:** nur localhost, Header `X-Hashmark-Editor: 1`, nur Pfade im Deck, nur `.md`/`.yaml`/Bilder. `hashmark edit` hat bewusst kein `--host`.
- Die Datei-API-Pfade und `deck-assets/` sind **relativ**, damit Builds auch in Unterverzeichnissen laufen (`base: './'`).

- **Editor (CodeMirror 6):**
  - Die Farben der Hashmark-Syntax (`.st-*`) stehen als Decorations innerhalb der Markdown-Überschrift (`.tok-h`) und brauchen `!important`, sonst gewinnt die Überschriftenfarbe.
  - Bei `showTooltip` ist das gelieferte `dom` selbst das `.cm-tooltip`-Element. Eigene Farben brauchen deshalb `.cm-editor .cm-tooltip.st-bubble` (mehr Spezifität als das Basis-Theme).
  - Vorschläge starten nur bei Eingabe (`userEvent input.type`), nicht bei programmatischen Änderungen. Tests per CDP tippen mit `Input.dispatchKeyEvent` (`char`).
  - Headless: `Emulation.setTouchEmulationEnabled` macht `pointer: coarse` wahr (Tastaturleiste), `setFocusEmulationEnabled` liefert `view.hasFocus`.
  - Beim Laden wechselt der Editor einmal die Datei, sobald die Vorschau ihre Position meldet (`followPreview`). Tests erst danach bedienen.

- **Webdienst (`hashmark serve`, Docker/Render):**
  - Ein Prozess, ein Container: `live-server.ts` mit Option `web` liefert die Präsentation öffentlich und `/editor.html` plus Datei-API nur mit HTTP-Basic-Passwort (`EDITOR_PASSWORD`, ohne Passwort gibt es keinen Editor). `/healthz` für Render.
  - Die Datei-API prüft im Webbetrieb weiter den Header `X-Hashmark-Editor` und dass `Origin` zum `Host` passt (Basic-Zugangsdaten gehen sonst auch von fremden Seiten mit). `/__hashmark/app` bleibt localhost-only.
  - Das Image installiert online per `npm ci` (der Vendor-Cache enthält nur Windows-Binärdateien) und baut die Runtime beim Bauen vor. Läuft als root, weil Render-Festplatten root gehören.
  - Pipeline: `.gitlab-ci.yml` (Test → Kaniko-Image in die GitLab-Registry → Deploy-Hook mit `imgURL` auf den Commit-Tag), `render.yaml` als Blueprint. Lokal gibt es kein Docker: das Image wurde nicht gebaut, nur `hashmark serve` ist getestet.

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
  - **Desktop-App in Go** (Node als Sidecar, Windows getestet; Linux/macOS haben Menü/Vollbild, kompilieren, sind aber nie gelaufen). Davor Tauri/Rust (am 01.10.2026 entfernt, siehe `roadmap.md`) und davor Electron: Eine Electron-Version wurde gebaut und auf Wunsch komplett zurückgenommen, auch aus der Git-Historie, sie war zu groß.
- **Offen:** Stufen 2–6 in `roadmap.md`, u. a. Plugin-API, Theme v2, FS-Abstraktion, Editor-Inspector, Auto-Fit, weitere Diagrammsprachen, Animationen, Outliner.
- **Regel:** keine großen Binärdateien ins Repo (über das bestehende `vendor/` hinaus), auch keine Build-Ergebnisse (`dist-go/`, `export/` sind ignoriert). Es werden **nie Installer** erzeugt, die App ist immer standalone. Go liegt im Benutzerprofil.
- **Pipeline und Releases** (`.gitlab-ci.yml`): Bei jedem Push `version` → `test`, `build-app` (6 Ziele) → `package` (Standalone-Pakete als Artefakte). Bei einem Tag zusätzlich `release-notes` → `publish` (Generic Package Registry) → `release` (GitLab-Release mit Download-Links). `scripts/release-notes.ts` erzeugt die Notizen aus den Commit-Betreffzeilen seit dem vorherigen Tag.
- **Commit-Betreffzeilen sind der Changelog:** Fehlerbehebungen mit `Fix: …` beginnen oder „behoben“/„Fehler“ nennen, dann landen sie unter „Behobene Fehler“, alles andere unter „Neue Funktionen“. Reines `docs:`/`chore:`/`ci:`/`test:` oder `[skip changelog]` taucht nicht auf. Dafür kurze, für Anwender verständliche Betreffzeilen schreiben.
- **Git:** Es gibt noch **kein Remote**, pushen ist erst mit URL möglich. Grösse ca. 125 MB wegen `vendor/`, `node.exe` hat 93 MB (Limit bei GitHub: 100 MB pro Datei).
- **Beispiel-Deck:** `01-einfuehrung.md` enthält einen Test-Abschnitt des Nutzers („### Test“). Nur auf Wunsch entfernen.
