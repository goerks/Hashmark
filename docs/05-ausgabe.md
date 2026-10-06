# Export {id=export}

| Ausgabe | Befehl |
| --- | --- |
| PDF | `make pdf` |
| Handout mit Notizen | `make pdf NOTES=1` |
| PowerPoint | `make pptx` |
| Eine HTML-Datei | `make export` |
| Statische Seite | `make build` |

::: notes
Aus derselben Quelle entstehen mehrere Ausgaben. Das **PDF** kommt aus der Druckansicht mit dem installierten Edge oder Chrome, ohne zusätzliche Software, eine Folie pro Seite mit Lesezeichen und klickbaren Querverweisen. Das **Handout** setzt Sprechernotizen neben die Folien (A4 hoch, auch 2, 3 oder 6 Folien je Seite). `make export` erzeugt **eine einzelne HTML-Datei**, die offline per Doppelklick läuft, samt Presenter-View.

Mit `PLAN=path` richtet sich die Auswahl nach dem Vortragsplan, `DEPTH=1` druckt nur den Hauptpfad.
:::

## PowerPoint {id=powerpoint}

- Text, Listen, Code und Tabellen bleiben **bearbeitbar**
- Diagramme und Formeln als Bild
- Schritte werden **Animationen**, Übergänge werden übernommen

::: notes
Die PowerPoint-Datei ist keine Bildersammlung: Überschriften, Absätze, Listen mit Aufzählungsfarbe, Code mit Syntaxfarben und Tabellen sind echte, bearbeitbare PowerPoint-Objekte. Mermaid-Diagramme, SVG, Formeln und Figuren mit Beschriftungen sind Bilder. Die Dekoration (Kacheln, Rahmen, Verläufe, Logos) liegt als Hintergrundbild darunter.

Schritte werden zu **Einblend-Animationen** (ein Klick je Schritt, Listen und Code absatzweise), Folienübergänge werden übernommen, und Sprechernotizen stehen in den Notizen der Folie. Die obersten Kapitel werden PowerPoint-Abschnitte. Mit `STEPS=1` entsteht stattdessen eine Folie je Schritt.

Der Export steht im Editor als Button „PPTX“ zur Verfügung und in der Desktop-App im Menü „Datei“.
:::

# App und Webdienst {id=app}

- **Desktop-App** für Windows, Linux und macOS, ohne Installer
- **Webdienst** als Docker-Image: Präsentation öffentlich, Editor mit Passwort

::: notes
Die **Desktop-App** besteht aus einer kleinen Hülle in Go und Node.js im Paket: ein entpackbarer Ordner, kein Installer. Sie öffnet Decks per Dialog, hat den Editor und die Präsentation im Fenster, die Presenter-View auf dem zweiten Bildschirm sowie Exporte im Menü. Windows ist getestet; Linux und macOS werden gebaut, sind aber noch nicht erprobt.

Der **Webdienst** (`hashmark serve`, als Docker-Image) liefert die Präsentation öffentlich und den Editor unter `/editor.html` mit Passwort. Er lässt sich auf Render oder in jeder Container-Umgebung betreiben.
:::
