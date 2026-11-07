# Lizenzen der enthaltenen Bibliotheken

Hashmark selbst steht unter der Functional Source License 1.1 mit Apache-2.0 als spätere Lizenz ([FSL-1.1-ALv2](LICENSE)). Diese Datei nennt die Bibliotheken, die Hashmark mitliefert oder zum Bauen braucht, und wie ihre Lizenzen zu behandeln sind.

Stand: 03.11.2026. Grundlage sind die Lizenzfelder und Lizenzdateien der Pakete, gelesen in GitHub Actions (`npm ci` mit dem Lockfile, `go mod download`). Das ist eine technische Bestandsaufnahme, keine Rechtsberatung.

## Überblick

- **npm (Laufzeit und Build):** rund 330 Pakete, fast alle unter MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0 oder Unlicense. Dazu zählen Svelte, Vite, CodeMirror, Mermaid, KaTeX, Shiki, `markmap-view`, `d3`, `pptxgenjs`, `markdown-it`. Die vollständige Liste liefert `npm ls --all`, die Lizenztexte liegen in den Paketen (`node_modules/<paket>/LICENSE`).
- **Go (Desktop-App):** `go-webview` (MIT), `zenity` (MIT), `purego` (Apache-2.0), `golang.org/x/*` (BSD-3-Clause), `makefat` (Unlicense), `rsrc` und `goversioninfo` (MIT, Werkzeuge zum Bauen). Die Liste liefert `go list -m all`.
- **Kein Pflichtpaket mit starkem Copyleft** (GPL, AGPL). Neue Pakete müssen das einhalten, siehe `CONTRIBUTING.md`.

## Besonderheiten

| Paket | Lizenz | Was wir tun |
| --- | --- | --- |
| `jszip` | MIT **oder** GPL-3.0-or-later | wir nutzen es unter **MIT** |
| `dompurify` | MPL-2.0 **oder** Apache-2.0 | wir nutzen es unter **Apache-2.0** |
| `elkjs` (kommt mit Mermaid) | EPL-2.0 | Copyleft nur für Änderungen an `elkjs` selbst, wir ändern es nicht. Der Lizenztext liegt im Paket und gehört zur Auslieferung des Programms. |
| `lightningcss` (Build-Werkzeug von Vite, nativer Teil) | MPL-2.0 | Copyleft nur für Änderungen am Paket selbst, wir ändern es nicht. Es steckt im Build, nicht in der Präsentation. |
| `argparse` (über `markdown-it`) | Python-2.0 | freizügig, nur der Lizenzhinweis bleibt erhalten |
| `khroma` (über Mermaid) | MIT | das Paket hat kein Lizenzfeld, die Lizenzdatei im Paket ist die MIT-Lizenz (Fabio Spampinato, Andrew Maney) |
| `https` 1.0.0 (über `pptxgenjs`) | ISC | ein sehr kleines Platzhalter-Paket mit diesem Namen, es bringt nach meiner Kenntnis keine eigene Funktion |
| `github.com/dchest/jsmin` (Go, über `zenity`) | Crockford-Lizenz mit dem Zusatz „The Software shall be used for Good, not Evil“ | steht in der Modulliste, wird aber für **keines** der Zielsysteme (Linux, Windows, macOS) ins Programm einkompiliert: Es wird nur von einem Hilfsprogramm in `zenity` zum Erzeugen von Skripten benutzt (`internal/zenutil/osa_generator.go`). Der Zusatz ist keine Standardlizenz-Klausel. Sobald `jsmin` Teil des Programms würde, muss es ersetzt werden. Prüfung: `go list -deps` je Zielsystem, 03.11.2026. |
| KaTeX-Schriften | siehe Paket `katex` | die Schriftdateien (`src/runtime/katex-fonts`) stammen aus `katex`, ihre Lizenzen liegen dort bei |

## Pflege

- Neues Paket: Lizenz prüfen, bei Copyleft-Lizenzen auf Dateiebene (MPL, EPL) oder doppelter Lizenzierung hier eintragen.
- Nach größeren Updates (`make deps-update`) die Besonderheiten noch einmal durchsehen.
