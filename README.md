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
| `make dev` / `make dev-open` | Dev-Server mit Hot Reload (`DECK=…`, `PORT=…`) |
| `make build` | Statisches HTML nach `dist/` (`OUT=…`) |
| `make preview` | Gebautes Deck lokal ausliefern |
| `make dev-lan` / `make preview-lan` | Wie `dev` / `preview`, aber im Netzwerk (LAN/VPN) erreichbar |
| `make export` | Eine einzelne HTML-Datei nach `export/<deck>.html`, läuft offline per Doppelklick |
| `make docker` / `make docker-run` | Build und Docker-Image mit nginx (`IMAGE=…`), starten auf `DOCKER_PORT` (8080) |
| `make test` | Tests (Parser, Deck-Baum, Navigator) |
| `make deps-update` | Pakete online aktualisieren und im Cache ablegen |
| `make clean` / `make distclean` | `dist/` bzw. zusätzlich `node_modules/` löschen |

## Alle Abhängigkeiten liegen im Projekt

Es muss nichts global installiert werden:

- `vendor/node/` enthält portables Node.js 24 LTS. Es wurde von nodejs.org geladen und per SHA256 geprüft (`scripts/get-node.ps1`).
- `vendor/npm-cache/` enthält alle npm-Pakete als Tarballs. `make setup` installiert daraus **ohne Internet**, weil `.npmrc` auf diesen Cache zeigt.
- Zur Laufzeit gibt es keine CDNs und keine Web-Fonts. Mermaid und Shiki werden mitgebündelt, Schriften kommen aus dem System.

Voraussetzungen: Windows x64 und GNU Make (z. B. `choco install make`).

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
- **Remote-Vortrag** (Teams/Zoom): Bildschirm bzw. Browserfenster teilen. Dass das Publikum der Position live im eigenen Browser folgt, ist noch nicht umgesetzt.

## Tastatur

| Taste | Wirkung |
| --- | --- |
| → / Space / PageDown | weiter: nächster Schritt, dann Sub-Slide, dann Geschwister, am Ende einer Ebene Nachfolger des Elternknotens |
| ← / Shift+Space / PageUp | zurück (auf vorherigen Folien landet man vollständig aufgedeckt) |
| ↓ / Enter | in den ersten Kindknoten abtauchen |
| ↑ / Esc | zum Elternknoten, an die Sub-Slide, von der aus abgetaucht wurde |
| Ctrl+Shift+O (kurz: O) | Navigations-Übersicht: Hierarchie mit Miniatur jeder Folie; Klick oder Pfeiltasten + Enter springt direkt dorthin, Esc schließt |
| Home | zum Anfang |

Deep-Links: `#architektur/parser` bzw. `#architektur/parser:2` für die zweite Sub-Slide.

## Syntax

```yaml
# deck.yaml (optional – ohne Manifest: alle .md im Ordner, alphabetisch)
title: Mein Vortrag
theme: minimal          # minimal | dark-tech | ./eigenes-theme.css
maxDepth: 3             # tiefere Überschriften werden Abschnitte innerhalb der Folie
layout: default         # Default-Layout
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

- **Layouts:** `title`, `section` (zeigt Kinder automatisch als Kacheln), `default`, `two-col`
- **Container:** `::: columns`/`::: col`, `::: grid cols="2fr 1fr" gap=2`, `::: children`, `::: notes`. Verschachtelung im Pandoc-Stil mit gleicher Anzahl Doppelpunkte.
- **Code:** ` ```ts {title="auth.ts" lines="3-5|all"} ` mit Shiki. Die Farben kommen aus den `--shiki-token-*`-Tokens des Themes. `lines` wird bereits übernommen und in Phase 3 animiert.
- **Mermaid:** ` ```mermaid `, gerendert im Browser. Die Farben kommen aus den Theme-Tokens.
- **Schritt für Schritt:** Die Schritte einer Folie werden über ihre Nummer synchronisiert. Gleiche Nummer bedeutet gleichzeitig: Links erscheint Bullet 2, rechts Code-Teil 2. Oben rechts zeigen Punkte den Fortschritt.
  - `::: steps` um eine Liste: Jeder Listenpunkt (bzw. jeder Block) ist ein Schritt. `::: steps start=2` beginnt später.
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
src/cli/       strata dev | build | preview
examples/      Beispiel-Deck (5 Dateien, 3 Ebenen)
```

## Nicht im MVP (siehe Roadmap im Konzept)

Includes, `hidden`, Suche, Presenter-View, Linear-Modus, PDF-Export, PlantUML, Auto-Layout/Auto-Fit, Hell/Dunkel-Umschaltung, Code-Hervorhebung per `lines=`, Magic Move, Diagramm-Morphing (stabile Knotenpositionen), eigene Layouts.
