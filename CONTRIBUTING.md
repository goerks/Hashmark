# Mitentwickeln an Hashmark

Anwender-Dokumentation: [Handbuch](https://goerks.github.io/Hashmark/handbuch/?reader). Diese Datei ist für alle, die am Quelltext arbeiten.

## Einrichten

Voraussetzungen: Windows x64 und GNU Make (z. B. `choco install make`). Für die Desktop-App zusätzlich Go (ab 1.26) im `PATH`. Sonst muss nichts global installiert werden:

- `vendor/node/` enthält portables Node.js 24 LTS. `make setup` lädt es von nodejs.org und prüft es per SHA256 (`scripts/get-node.ps1`). Der Ordner gehört nicht zum Repo.
- `vendor/npm-cache/` ist der lokale npm-Cache (`.npmrc`). Nach dem ersten `make setup` geht die Installation **ohne Internet**.
- Zur Laufzeit gibt es keine CDNs und keine Web-Fonts. Mermaid und Shiki sind gebündelt, Schriften kommen aus dem System.

```sh
make setup      # nur beim ersten Mal
make dev        # http://localhost:3030 – Beispiel-Deck mit Hot Reload
```

## Arbeitsweise: Feature-Branch und Pull Request

Nichts geht direkt auf `main`. Jede Änderung entsteht auf einem Branch und kommt per Pull Request nach `main`.

1. Branch von aktuellem `main`: `feat/<thema>`, `fix/<thema>`, `docs/<thema>` oder `chore/<thema>`.
2. Ein Thema pro PR. Vor dem PR `make test`; bei Doku-Änderungen `make docs`; bei Decks und Syntax `make check`; UI-Änderungen im Browser ansehen.
3. **Der PR-Titel ist der Changelog-Eintrag** (gemergt wird per Squash): kurz, deutsch, für Anwender verständlich. Fehlerbehebungen beginnen mit `Fix: …`. Reines `docs:`/`chore:`/`ci:`/`test:` oder `[skip changelog]` taucht nicht in den Release-Notizen auf.
4. Die CI (`ci.yml`) läuft bei jedem PR: Tests, Go-Hülle für alle Ziele, Docker-Probebau.
5. Ein Merge nach `main` veröffentlicht die Dokumentation (GitHub Pages) und deployt das Image (Render).

**Mit Claude Code** läuft der Ablauf ohne Zutun des Auftraggebers:

1. Auftrag als **GitHub-Ticket** (vorbereitet: `.github/ISSUE_TEMPLATE/auftrag.md`). Nennt jemand eine Aufgabe ohne Ticket, legt Claude es an.
2. Claude hinterfragt die Anforderung und legt **mindestens zwei Varianten mit Bewertung, je einem Design-Vorschlag und einer klaren Empfehlung** vor (`/analyse`, Ergebnis als Ticketkommentar). Der Auftraggeber entscheidet.
3. Claude legt Branch und Pull Request an, setzt um und prüft (`/feature`, `/pr` benutzt er selbst).
4. Der Auftraggeber bekommt eine fachliche **Abnahmemeldung** („so probierst du es aus“, „nicht getestet“), probiert es aus und gibt ausdrücklich frei oder nennt Änderungswünsche.
5. Nach der Freigabe und grüner CI führt Claude den PR per Squash zusammen. Danach ist das Ticket geschlossen.

Der Auftraggeber muss keinen Git-Befehl kennen. Ein Hook verhindert Commits und Pushes auf `main`. Die Regeln stehen in `.claude/rules/git-workflow.md`.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `make setup` | Node.js nach `vendor/node` (falls fehlend) und `npm ci` (Cache in `vendor/npm-cache`) |
| `make dev` / `make dev-open` | Dev-Server mit Hot Reload (`DECK=…`, `PORT=…`). Ohne `DECK=` zeigt die Seite unten links eine Auswahl der Beispiel-Decks (`examples/`) |
| `make edit` | Editor mit Live-Vorschau im Browser (`DECK=…`) |
| `make new DECK=decks/mein-vortrag` | neues Deck anlegen |
| `make build` / `make preview` | Statisches HTML nach `dist/` (`OUT=…`) / lokal ausliefern |
| `make dev-lan` / `make preview-lan` | wie `dev` / `preview`, aber im Netzwerk erreichbar |
| `make export` | eine einzelne HTML-Datei nach `export/<deck>.html` |
| `make pdf` | PDF nach `export/<deck>.pdf` (`DEPTH=1`, `STEPS=1`, `NOTES=1`, `PLAN=path\|grouped`, `PDF=…`, `BROWSER=…`) |
| `make pptx` | PowerPoint nach `export/<deck>.pptx` (`DEPTH=1`, `STEPS=1`, `NOANIM=1`, `PLAN=…`) |
| `make check` | Deck prüfen wie ein Linter (`NOOVERFLOW=1` ohne Browser, `STRICT=1` Hinweise als Fehler); Exit 1 bei Fehlern, geeignet für CI |
| `make test` | Tests (Vitest) |
| `make docs` / `make docs-serve` | Dokumentation als statische Seiten nach `public/` / bauen und ansehen (http://localhost:4000) |
| `make build-examples` / `make docker-examples` | alle Beispiele mit Auswahlseite bzw. als nginx-Image |
| `make serve` / `make image` / `make image-run` | Webdienst lokal (Editor ohne Anmeldung) / Docker-Image bauen / starten |
| `make docker` / `make docker-run` | Deck als nginx-Image (`IMAGE=…`, `DOCKER_PORT`) |
| `make app` / `make app-package` / `make app-cross` | Desktop-App bauen und starten / portables Paket / Hülle für alle Plattformen |
| `make app-test` / `make sidecar-smoke` | E2E der Desktop-App (headless) / Node-Sidecar wie aus der App |
| `make deps-update` | Pakete online aktualisieren und im Cache ablegen |
| `make clean` / `make distclean` | `dist/` bzw. zusätzlich `node_modules/` löschen |

## Dokumentation

Die Dokumentation ist selbst mit Hashmark gebaut: Startseite (`scripts/docs-landing.ts`), acht Funktionsseiten (`scripts/docs-features.ts`), Handbuch (`docs/`, ein Hashmark-Deck mit Lesemodus in drei Teilen: Lernen, Themen, Nachschlagen) und alle Beispiele. Die Bilder der Webseite nimmt `node scripts/make-screenshots.ts --out <ordner>` aus der echten App auf; die Pipeline macht das bei jedem Bau, `HASHMARK_SHOTS=<ordner>` gibt sie an `make docs` weiter. `make docs-serve` zeigt sie lokal. Auf GitHub baut `pages.yml` sie bei jedem Push auf `main` und nach jedem Release (einmalig: Settings → Pages → Source „GitHub Actions“). Die Erklärtexte stehen im Handbuch in `::: notes`; der Lesemodus zeigt sie als Fließtext.

Faustregel: Was Anwender wissen müssen, gehört ins Handbuch. Das README bleibt das Schaufenster.

## Desktop-App

Eine schlanke Go-Hülle (ohne CGO, ca. 7 MB) um die Webview des Systems; die Arbeit macht Node als Sidecar. Zum Bauen genügt Go im `PATH`, die Bibliotheken lädt Go beim ersten Build. Keine Installer: das Programm ist immer ein Ordner bzw. eine Datei.

```sh
make app                          # bauen und starten
make app DECK=decks/mein-vortrag  # direkt ein Deck öffnen
make app-package                  # portabel: dist-app/Hashmark/Hashmark.exe
make app-cross                    # Windows, Linux, macOS (amd64, arm64) nach dist-go/
```

- **Plattformen:** Windows ist umgesetzt und getestet. Linux (GTK 3) und macOS haben Menü, Vollbild und Monitorwahl, kompilieren, sind aber nie gestartet worden.
- **Daten und Diagnose:** `%APPDATA%\app.hashmark.desktop\` (`hashmark.log`, `sidecar.log`, `crash.log`, zuletzt geöffnete Decks). Menü Hilfe › „Protokoll öffnen“.
- **Tests (alle headless):** `make test` (Unit), `make sidecar-smoke` (Node-Teil; `SIDECAR_BUNDLE=1` prüft das Bündel), `make app-test` (ganze App; `VISIBLE=1` zeigt die Fenster). `make app-test` teilt sich den Datenordner mit der echten App und scheitert, solange diese läuft.
- **Sicherheit:** Die internen Server lauschen nur auf 127.0.0.1 mit zufälligem Port; App-Befehle verlangen den Header `X-Hashmark-App`; externe Links öffnen im Standardbrowser.

Die Interna (Fenster als Prozesse, Menü, Absturzprotokoll, Kaltstart) stehen in `.claude/rules/desktop-go.md`.

## Versionen und Release

**Version:** `<letzter Tag ohne v>.<Kurz-Hash>`, z. B. `1.2.0.a1b2c3d` (ohne Tag `0.0.0.<hash>`), beim Bauen in die Hülle eingebettet: `hashmark --version`, Menü Hilfe › Über.

**Pipeline (GitHub Actions):** `ci.yml` bei Push und PR, `release.yml` bei einem Tag `v*`, `pages.yml` für die Dokumentation, `docker.yml` veröffentlicht das Image bei jedem Push auf `main` und ruft den Render-Deploy-Hook auf (Secret `RENDER_DEPLOY_HOOK_URL`).

**Release:** `git tag v1.0.0 && git push origin v1.0.0` baut die Pakete aller sechs Ziele und veröffentlicht sie als GitHub-Release. Die Notizen entstehen aus den Commit-Betreffzeilen seit dem vorherigen Tag (`node scripts/release-notes.ts <tag>`), gesammelt in `release-notes/`. Sie werden vor dem Tag-Push durchgesehen.

- **Behobene Fehler:** Betreffzeile beginnt mit `Fix` oder enthält „behoben“, „behebt“, „Fehler“ oder „Bug“.
- **Neue Funktionen:** alles andere. Weggelassen werden Merge-Commits, `docs:`/`chore:`/`ci:`/`test:`/`style:` und `[skip changelog]`.

Andere Ziele samt Archiv: `node scripts/package-app.ts <ziel> --version=… --archive` (online, lädt Node und die Pakete des Ziels). Die Programme sind nicht signiert.

## Aufbau

```
src/core/      Parser (remark), Deck-Baum, Render-Plugins (Shiki, Mermaid), Navigator – ohne UI, getestet
src/vite/      Vite-Plugin: Deck als virtuelles Modul, Datei-Watcher, Hot Reload, Bild-Assets
src/runtime/   Svelte-5-App: Bühne, Layouts, Übergänge, Presenter-View, Lesemodus, Druckansicht, Themes
src/runtime/editor/  Editor (editor.html): CodeMirror, Vorschau-Sync, Bild-Upload
src/cli/       hashmark dev | edit | serve | build | preview | export | pdf | pptx | check
src/pptx/      PowerPoint-Export
src/desktop/   Node-Sidecar der Desktop-App (stdin/stdout-Protokoll), Startseite (ui/)
desktop-go/    Desktop-App in Go (ohne CGO): Fenster, Menü, Dialoge, Bildschirmwahl
docs/          Handbuch (ein Hashmark-Deck)
hashmark-fuer-ki.md  Beschreibung des Deck-Aufbaus für KI (Root); mit vocab.ts synchron halten (Test)
examples/      Beispiel-Decks: hashmark-demo, theme-demo, komponenten-demo, formeln-demo
```

Konzept: [konzept-markdown-praesentations-app.md](konzept-markdown-praesentations-app.md). Ausbaustufen: [roadmap.md](roadmap.md).

## Regeln für den Quelltext

- Code-Kommentare, UI-Texte, Commit-Messages und Doku sind **deutsch**, Bezeichner **englisch**.
- Keine externen Laufzeit-Abhängigkeiten (kein CDN, keine Web-Fonts); neue Pakete mit `vendor/node/npm.cmd install <pkg>` und `package.json` samt `package-lock.json` committen.
- TypeScript läuft ohne Build-Schritt (Node-Type-Stripping): nur „erasable syntax“, relative Imports mit `.ts`-Endung, Typen per `import type`.
- Svelte 5 mit Runes.
- Keine großen Binärdateien und keine Build-Ergebnisse ins Repo; es gibt nie Installer.
