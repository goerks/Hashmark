# Referenz {id=referenz}

Tastatur, Befehle und Syntax im Überblick.

::: notes
Die Kurzreferenz für den Alltag. Ausführlich steht alles in der README des Projekts.
:::

## Tastatur {id=tastatur}

| Taste | Wirkung |
| --- | --- |
| → / ← | weiter / zurück auf der Ebene |
| ↓ / ↑ | abtauchen / zurück |
| Space | dem Vortragsplan nach |
| S / P / N | Presenter-View / Plan / Notizen |
| K | Video der Folie starten / anhalten |
| Ctrl+K | Suche |
| T | Plan aus/an |

::: notes
Unten rechts zeigt ein Steuerkreuz auf jeder Folie, welche Richtungen möglich sind. Nicht mögliche Richtungen sind ausgegraut. PageDown und PageUp verhalten sich wie Space, damit Presenter-Fernbedienungen funktionieren. F5 bzw. F schaltet in den Vollbildmodus.
:::

## Befehle {id=befehle}

| Befehl | Zweck |
| --- | --- |
| `make dev` | Entwicklungsserver mit Hot Reload |
| `make edit` | Editor mit Live-Vorschau |
| `make check` | Deck prüfen (Layouts, Attribute, Überlauf) |
| `make app` | Desktop-App bauen und starten |
| `make test` | Tests |

::: notes
Alle Befehle laufen über `make`, Node.js liegt im Projekt. `make check` prüft ein Deck wie ein Linter, inklusive des Überlaufs aller Folien, und eignet sich für CI. Optionen wie `DECK=…` oder `PORT=…` stehen jeweils im Makefile.
:::

## Syntax in Kurzform {id=syntax}

| Syntax | Bedeutung |
| --- | --- |
| `# … ######` | Knoten (Ebene 1 bis 6) |
| `---` | Sub-Slide |
| `::: name` | Container |
| `{layout=… id=…}` | Attribute |
| `{steps}` / `{optional}` / `{fit}` | Flags |
| `$a^2$` / `$$ … $$` | Formeln |
| `![Demo](demo.mp4){play=1}` | Video (Schritt, K pausiert) |
| ` ```mermaid ` | Diagramm |

::: notes
Die oberste Überschriftenebene jeder Datei wird auf Tiefe 1 gelegt, `maxDepth` begrenzt die Tiefe der Knoten. `{fit}` schrumpft den Inhalt einer Folie, bis alles passt (mindestens auf 70 Prozent), und `hashmark check` meldet, wenn es trotzdem nicht passt.
:::
