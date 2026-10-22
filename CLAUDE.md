# CLAUDE.md – Hashmark

Slogan: „Mächtige Präsentationen aus reinem Markdown.“ Präsentations-App: 1..n Markdown-Dateien werden zu einer Slideshow als **navigierbarem Baum**. → erzählt auf dem Hauptpfad weiter, ↓ taucht ins Detail ab.

Sprache: Code-Kommentare, UI-Texte, Commit-Messages und Doku sind **deutsch**. Bezeichner im Code sind englisch.

## Wo steht was

| Für wen | Wo |
| --- | --- |
| Anwender | Handbuch `docs/` (ein Hashmark-Deck, veröffentlicht auf GitHub Pages), Schaufenster `README.md` |
| Entwickler | `CONTRIBUTING.md` (Einrichten, Befehle, Workflow) |
| Claude / Details je Bereich | `.claude/rules/*.md`, werden bei passenden Pfaden automatisch geladen |
| Konzept und Ausbau | `konzept-markdown-praesentations-app.md`, `roadmap.md` |

Regeln je Bereich:

- `git-workflow.md` – **immer**: Feature-Branch + Pull Request, nie auf `main`
- `architektur-core.md` – `src/core/**`, `tests/**`: Datenmodell, Parser, Navigator, Plan, Syntax, Komponenten
- `runtime-editor.md` – `src/runtime/**`, `src/vite/**`, `src/cli/**`: Svelte-App, Editor, Druck, Presenter-Link, Fahrpläne
- `desktop-go.md` – `desktop-go/**`, `src/desktop/**`: Go-Hülle, Sidecar, Abstürze, Kaltstart
- `pptx-export.md` – `src/pptx/**`: PowerPoint-Export
- `webdienst.md` – `hashmark serve`, Docker, Render
- `pipeline-release.md` – `.github/**`, Release-Notizen, Dokumentations-Seiten

## Workflow

Jede Änderung auf einem **Feature-Branch** (`/feature <thema>`), per **Pull Request** nach `main` (`/pr`), PR-Titel = Changelog-Zeile. Nie direkt auf `main` (ein Hook blockiert das). Details: `.claude/rules/git-workflow.md`.

## Befehle (immer über `make`, Node liegt im Projekt)

| Befehl | Zweck |
| --- | --- |
| `make setup` | Node nach `vendor/node` (falls fehlend, online von nodejs.org) + `npm ci` (nutzt `vendor/npm-cache`, holt Fehlendes online) |
| `make test` | Vitest (`tests/*.test.ts`, Kern-Logik ohne DOM) |
| `make dev` / `make edit` | Dev-Server bzw. Editor (`DECK=…`, `PORT=…`, Standard `examples/hashmark-demo`, 3030). `make dev` ohne ausdrückliches `DECK=` startet mit `--examples`: Plugin-Option `examples` (plugin.ts, `/__hashmark/examples` GET/POST wechselt das Deck) + `src/runtime/example-switcher.ts` (nur `import.meta.env.DEV`) |
| `make check` | `hashmark check`: statisch (Layouts, Attribute, Übergänge, Hinweise) + Überlauf per Edge/Chrome; Exit 1 bei Fehlern |
| `make build` / `make export` / `make pdf` / `make pptx` | statisches HTML / Single-File-HTML / PDF (`PLAN=path` oder `PLAN=grouped`) / PowerPoint (`DEPTH=1 STEPS=1 PLAN=… PPTX=…`) |
| `make app` / `make app-cross` / `make app-package` | Desktop-App (Go): bauen + starten (`DECK=…` optional) / Hülle für Windows, Linux, macOS (amd64, arm64) nach `dist-go/` / portables `dist-app/Hashmark/` (windows-amd64). Andere Ziele samt Archiv: `node scripts/package-app.ts <ziel> --version=… --archive` (online) |
| `make app-test` / `make sidecar-smoke` | E2E der Desktop-App **headless** über WebView2-CDP (`VISIBLE=1` zeigt sie; schreibt `export/app-e2e/result.json`) / Node-Sidecar wie aus der App angesprochen (`SIDECAR_BUNDLE=1`: das Bündel) |
| `make docs` / `make docs-serve` | Dokumentation als statische Seiten nach `public/` (`DOCS_OUT`, `DOCS_PORT`, Standard 4000): Handbuch `handbuch/`, Beispiele `beispiele/`, Startseite (`scripts/docs-landing.ts`). `HASHMARK_PROJECT_URL` setzt die Projektadresse der Download-Karten |
| `make build-examples` / `make docker-examples` | alle `examples/*` als statische Seiten mit Auswahlseite / Docker-Image `hashmark/beispiele` |
| `make serve` / `make image` / `make image-run` | Webdienst lokal (`EDITOR_PASSWORD`, Standard „geheim“) / Docker-Image des Webdienstes (`Dockerfile` im Root) bauen / starten |
| `make deps-update` | neue Pakete online holen, landen im lokalen Cache `vendor/npm-cache` |
| `node scripts/make-icon.ts [logo.png]` | Programm-Icon und Favicon aus `assets/hashmark.png` neu erzeugen |
| `hashmark --version` | Version `<letzter Tag ohne v>.<Kurz-Hash>`, per `-ldflags "-X main.version=…"` eingebettet (`VERSION=…` überschreibt) |

- Go liegt **nicht** im Repo (ab 1.26, im `PATH`). Mehr braucht die Desktop-Hülle nicht: kein CGO, kein C-Compiler, kein Rust.
- Das Makefile nutzt `SHELL := cmd.exe`. Rezepte müssen in cmd funktionieren und stellen `vendor\node` vor den `PATH`.
- Node direkt aufrufen, z. B. für Skripte: `export PATH="$PWD/vendor/node:$PATH"` (Git Bash). Global ist **kein** Node installiert.
- Neue npm-Pakete mit `vendor/node/npm.cmd install <pkg>` installieren. Wegen `.npmrc` (`cache=./vendor/npm-cache`, `save-exact`) liegen sie danach im lokalen Cache; `package.json` und `package-lock.json` mitcommitten.

## Harte Regeln

- **Keine externen Laufzeit-Abhängigkeiten:** kein CDN, keine Web-Fonts, alles gebündelt und offline lauffähig. Neue Pakete nur über `package.json`/`package-lock.json`.
- **`vendor/` ist nicht im Repo** (`.gitignore`): portables Node 24 (`make setup` lädt es per `scripts/get-node.ps1`) und npm-Cache. Die CI installiert online per `npm ci`.
- **TypeScript läuft ohne Build-Schritt** über Node-Type-Stripping (CLI, Plugin, Kern). Deshalb:
  - nur „erasable syntax“: keine Parameter-Properties (`constructor(readonly x)`), keine Enums, keine Namespaces;
  - relative Imports **mit `.ts`-Endung**; reine Typen per `import type`.
- **Svelte 5 mit Runes.** Typ-Exports einer Komponente gehören in `<script module>`.
- **Keine großen Binärdateien ins Repo**, auch keine Build-Ergebnisse (`dist-go/`, `export/` sind ignoriert). Es werden **nie Installer** erzeugt, die App ist immer standalone.

## Architektur in Kürze

```
src/core/      framework-unabhängig (Node + Browser), getestet: Parser, Deck-Baum, Render, Navigator, Vortragsplan, Themes, Komponenten
src/vite/      Vite-Plugin: Deck als virtuelles Modul, File-Watcher, Hot Reload, Editor-API
src/cli/       hashmark dev | edit | serve | build | preview | export | pdf | pptx | check
src/runtime/   Svelte-App: Präsentation, Presenter-View, Lesemodus, Druckansicht, Editor (CodeMirror 6)
src/pptx/      PowerPoint-Export
src/desktop/   Node-Sidecar der Desktop-App
desktop-go/    Desktop-Hülle in Go (ohne CGO)
docs/          Handbuch (ein Hashmark-Deck);  scripts/docs-landing.ts = Startseite
examples/      Beispiel-Decks; local/ = ignorierte, firmeninterne Decks
```

Datenfluss: Markdown → `loadDeck` (Node, im Vite-Plugin) → Deck-JSON mit fertigem HTML je Slide → Client. Mermaid rendert erst im Client, mit den Farben aus den Theme-Tokens. Die Einzelheiten stehen in den Regeln je Bereich.

## Tests und Verifikation

- `make test` für den Kern. Neue Kern-Logik bekommt Tests in `tests/core.test.ts`. Temporäre Decks entstehen dort über `tempDeck()`.
- **UI im Browser prüfen:** mit Edge headless über CDP (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe --headless=new --remote-debugging-port=…`). Node 24 hat `fetch` und `WebSocket` eingebaut. Screenshots gehen per `Page.captureScreenshot`, Druck per `Page.printToPDF`, gezählt über `/Type /Page` im PDF.
- **Stolperstein:** Direkt nach dem Start des Dev-Servers optimiert Vite die Abhängigkeiten und lädt die Seite neu. Deshalb erst eine Aufwärm-Navigation machen, sonst sehen Tests „leere“ Zustände.
- **Stolperstein:** Synthetische Keyboard-Events auf `document.body` dispatchen, nicht auf `window`, weil `e.target.closest` verwendet wird.
- **Dev-Server stoppen:** nur den eigenen Prozess beenden, über den Port (`netstat -ano | grep :3030` → `taskkill //PID … //T //F`), nicht `taskkill /IM node.exe`.
- `pdftoppm` ist nicht vorhanden, PDFs lassen sich nicht als Bild ansehen. Stattdessen `Emulation.setEmulatedMedia({media:'print'})` + Screenshot.
- **Shell:** Markdown mit Backticks nie in `node -e "…"` bzw. doppelten Anführungszeichen bearbeiten, Bash führt sie als Befehle aus. Dafür das Edit-Werkzeug nehmen.

## Projekt-Hinweise

- **Beispiel-Deck:** `01-einfuehrung.md` enthält einen Test-Abschnitt des Nutzers („### Test“). Nur auf Wunsch entfernen.
- **Lokale Decks:** `local/` ist ignoriert (`.gitignore`, `.dockerignore`), taucht weder in `listExamples` noch in Build, Docker oder Desktop-Beispielen auf. Dort liegen firmeninterne Decks, z. B. `local/<deck>` (Diagramm-Generator unter `tools/`): `make dev DECK=local/<deck>`. Nie nach `examples/` verschieben.
- **Desktop-App:** Go (Node als Sidecar, Windows getestet; Linux/macOS kompilieren, sind aber nie gelaufen). Davor Tauri/Rust (am 01.10.2026 entfernt, siehe `roadmap.md`) und davor Electron, das auf Wunsch komplett zurückgenommen wurde (zu groß).
- **Stand und offene Punkte** stehen in `roadmap.md` (Stufen 2–6: Plugin-API, Theme v2, FS-Abstraktion, Editor-Inspector, weitere Diagrammsprachen, Animationen, Outliner), nicht hier.
