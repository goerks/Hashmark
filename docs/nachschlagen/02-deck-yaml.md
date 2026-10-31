# deck.yaml {id=deck-yaml}

| Schlüssel | Wirkung |
| --- | --- |
| `title` | Titel des Decks (Fenster, PDF) |
| `theme` | `minimal`, `dark-tech`, Pfad oder Block |
| `maxDepth` | wie tief Überschriften Knoten sind (Standard 3) |
| `layout` | Standard-Layout aller Folien |
| `layouts` | Layout je Ebene, z. B. `{ 1: section }` |
| `duration` | geplante Gesamtdauer, z. B. `25m` |

---

| Schlüssel | Wirkung |
| --- | --- |
| `footer` | Fußzeile auf jeder Folie |
| `slideNumber` | Folienzahl: `true` oder Vorlage `"{n} / {total}"` |
| `mount` | Dateien und Reihenfolge, `under:` hängt unter einen Knoten |
| `motion` | Bewegung: `speed: fast \| normal \| slow` für alle Übergänge, `effect: up` (u. a., auch `wipe`) für den Auftritt der Schritte |
| `zoom` | alle Bilder mit Z vergrößerbar |
| `embedImages` | alle Bilder einbetten |
| `embedMedia` | Videos in die HTML-Datei einbetten (bis 25 MB) |

::: notes
Die `deck.yaml` liegt im Deck-Ordner und ist optional. Ohne sie nimmt Hashmark alle Markdown-Dateien in alphabetischer Reihenfolge, das Theme `minimal` und den ersten Titel. Dieses Handbuch hat zum Beispiel `title`, `theme: dark-tech`, `duration: 25m`, eine Fußzeile, die Folienzahl und eine `mount`-Liste, die die Kapitel unter die drei Teile hängt (`under: Lernen`).

Der Block für `theme:` (`extends`, `tokens`, `layouts`, `css`) steht im Thema „Themes und Firmen-Look“.
:::
