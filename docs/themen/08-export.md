# Export und Weitergabe {id=export}

| Ausgabe | In der App (Datei) | Befehl |
| --- | --- | --- |
| PDF | PDF – alle Folien | `make pdf` |
| Handout mit Notizen | Handout mit Notizen (A4) | `make pdf NOTES=1` |
| PowerPoint | PowerPoint (PPTX) | `make pptx` |
| Eine HTML-Datei | Als HTML-Datei exportieren | `make export` |
| Statische Seite | | `make build` |

::: notes
Aus derselben Quelle entstehen mehrere Ausgaben. In der Desktop-App stehen sie im Menü Datei, im Editor als Buttons, aus dem Quelltext als Befehle. Alle Exporte laufen ohne zusätzliche Software, das PDF nutzt das installierte Edge oder Chrome.
:::

## PDF und Handout {id=pdf}

- eine Folie je Seite, mit Lesezeichen und klickbaren Querverweisen
- nur der Hauptpfad, jeder Schritt eine Seite oder nach Vortragsplan
- **Handout:** Notizen neben den Folien, A4 hoch

::: notes
Das **PDF** kommt aus der Druckansicht (Taste P in der Präsentation). Es hat eine Folie pro Seite, Lesezeichen nach dem Baum und klickbare Querverweise. Mit `DEPTH=1` druckst du nur den Hauptpfad, mit `STEPS=1` wird jeder Schritt eine Seite, mit `PLAN=path` richtet sich die Auswahl nach dem Vortragsplan. Das **Handout** setzt die Sprechernotizen neben die Folien (A4 hoch, auch 2, 3 oder 6 Folien je Seite).

Hat ein Knoten eine Fußzeile aus der `deck.yaml`, ersetzt sie die Druck-Fußzeile mit Brotkrumen und Seitenzahl.
:::

## PowerPoint {id=powerpoint}

- Text, Listen, Code und Tabellen bleiben **bearbeitbar**
- Diagramme und Formeln als Bild
- Schritte werden **Animationen**, Übergänge werden übernommen

::: notes
Die PowerPoint-Datei ist keine Bildersammlung: Überschriften, Absätze, Listen mit Aufzählungsfarbe, Code mit Syntaxfarben und Tabellen sind echte, bearbeitbare PowerPoint-Objekte. Mermaid-Diagramme, SVG, Formeln und Figuren mit Beschriftungen sind Bilder. Die Dekoration (Kacheln, Rahmen, Verläufe, Logos) liegt als Hintergrundbild darunter.

Schritte werden zu **Einblend-Animationen** (ein Klick je Schritt, Listen und Code absatzweise), Folienübergänge werden übernommen, und Sprechernotizen stehen in den Notizen der Folie. Die obersten Kapitel werden PowerPoint-Abschnitte. Mit `STEPS=1` entsteht stattdessen eine Folie je Schritt, „ohne Animationen“ zeigt jede Folie im Endzustand.
:::

## Eine HTML-Datei {id=html}

- die ganze Präsentation in **einer Datei**, rund 5 MB
- läuft per Doppelklick, offline, samt Presenter-View
- Videos liegen im Ordner `<name>-medien` daneben

::: notes
`make export` (in der App Datei › Als HTML-Datei exportieren) erzeugt eine einzelne HTML-Datei mit allem: Folien, Bilder, Schriften, Presenter-View. Sie läuft auf jedem Rechner per Doppelklick, ohne Server und ohne Internet.

**Videos** sind groß: Sie werden nicht eingebettet, sondern in einen Ordner `<name>-medien` neben die Datei gelegt. Gib beides zusammen weiter. Mit `embedMedia: true` in der `deck.yaml` werden Videos bis 25 MB je Datei eingebettet. PDF und PowerPoint zeigen das Standbild.
:::

## Weitergeben {id=weitergeben}

| Situation | Weg |
| --- | --- |
| Am eigenen Laptop, noch am Schreiben | App oder `make dev` |
| Auf einem fremden Rechner oder per Mail | **eine HTML-Datei** |
| Kollegen im selben Netz oder VPN | `make dev-lan` oder `make preview-lan` |
| Dauerhaft im Netz, mit Editor | **Webdienst** (Docker) |
| Beliebiges statisches Hosting | `make build`, Inhalt von `dist/` hochladen |

::: notes
Für den LAN-Weg fragt Windows beim ersten Start, ob `node.exe` im Netzwerk lauschen darf. `make build` funktioniert auch in Unterverzeichnissen, etwa auf GitHub Pages oder S3.

**Vertraulichkeit:** Build und Export enthalten den ganzen Inhalt samt Sprechernotizen im Klartext. Für interne Vorträge nur intern hosten.
:::
