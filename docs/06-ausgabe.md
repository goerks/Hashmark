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

**Videos** sind groß: `make export` bettet sie nicht in die HTML-Datei ein, sondern legt sie in einen Ordner `<name>-medien` daneben. Gib beides zusammen weiter. Mit `embedMedia: true` in der `deck.yaml` werden Videos bis 25 MB je Datei eingebettet. `make build` und der Webdienst liefern die Videodateien mit dem Deck aus. PDF und PowerPoint zeigen das Standbild.
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

## Webdienst betreiben {id=webdienst}

| Variable | Bedeutung |
| --- | --- |
| `EDITOR_PASSWORD` | schaltet den Editor frei, ohne gibt es nur die Präsentation |
| `EDITOR_USER` | Benutzername, Standard `editor` |
| `PORT` | Standard 10000, Render setzt ihn selbst |
| `DECK_DIR` | Deck-Ordner, Standard `/data/deck` |
| `DECK_SEED` | wird beim ersten Start in einen leeren `DECK_DIR` kopiert |

::: notes
Ein einziger Container liefert die Präsentation (`/`, öffentlich) und den Editor (`/editor.html`, mit Passwort). Beide arbeiten auf demselben Deck-Ordner: Änderungen im Editor erscheinen sofort in der Präsentation, es braucht also nur **eine Bereitstellung**. Lokal startest du ihn mit `make serve` (Passwort „geheim“) oder als Image mit `make image` und `make image-run`.

Das Image läuft auf jedem Container-Dienst: Port aus `PORT`, Health Check `/healthz`, eine Festplatte auf `/data` und `EDITOR_PASSWORD` gesetzt. Die Zugangsdaten gehen per HTTP Basic, deshalb nur über HTTPS betreiben (Render beendet TLS selbst).

**Wichtig:** Ohne Festplatte ist das Dateisystem bei Render flüchtig, Änderungen aus dem Editor gehen bei jedem Neustart verloren (kostenlose Dienste haben keine Festplatte). Mit der Festplatte auf `/data` bleiben sie erhalten.
:::

## Weitergeben {id=weitergeben}

| Situation | Weg |
| --- | --- |
| Am eigenen Laptop, noch am Schreiben | App oder `make dev` (Hot Reload) |
| Auf einem fremden Rechner oder per Mail | **Eine HTML-Datei** (`make export`), per Doppelklick, ohne Server |
| Kollegen im selben Netz oder VPN | `make dev-lan` oder `make preview-lan` |
| Dauerhaft im Netz, mit Editor | **Webdienst** (Docker) |
| Beliebiges statisches Hosting | `make build`, Inhalt von `dist/` hochladen |

::: notes
Die HTML-Datei ist etwa 5 MB groß und enthält alles. Für den LAN-Weg fragt Windows beim ersten Start, ob `node.exe` im Netzwerk lauschen darf. `make build` funktioniert auch in Unterverzeichnissen, etwa auf GitHub Pages oder S3.

**Vertraulichkeit:** Build und Export enthalten den ganzen Inhalt samt Sprechernotizen im Klartext. Für interne Vorträge nur intern hosten. **Remote-Vortrag** (Teams, Zoom): nur das Präsentationsfenster teilen, die Presenter-View (S) bleibt privat.
:::
