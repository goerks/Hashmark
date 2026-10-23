# Erste Schritte {id=erste-schritte}

::: steps
- Hashmark **laden** und starten
- Ein **neues Deck** anlegen
- **Schreiben**: Überschriften sind Folien
- **Präsentieren** und ausgeben
:::

::: notes
In wenigen Minuten steht die erste Präsentation. Du brauchst dafür keine Installation und keine Konsole: Die Desktop-App ist ein entpackbarer Ordner mit allem, was sie braucht, auch Node.js. Wer lieber aus dem Quelltext arbeitet, findet den Weg am Ende dieses Kapitels.
:::

## Die App laden {id=app-laden}

- **Windows:** Zip entpacken, `Hashmark.exe` starten
- **macOS und Linux:** `.tar.gz` entpacken, Programm starten
- Kein Installer, kein Konto, kein Internet nötig

::: notes
Die Pakete stehen auf der Download-Karte der Startseite und in den GitHub-Releases, eine portable Datei je Plattform. Der Ordner lässt sich auf einen USB-Stick kopieren.

Die Programme sind **nicht signiert**. Unter Windows kann SmartScreen warnen („Weitere Informationen“ → „Trotzdem ausführen“). Unter macOS warnt Gatekeeper beim ersten Start: Rechtsklick → Öffnen, oder im Terminal `xattr -dr com.apple.quarantine Hashmark.app`. Windows ist die am besten erprobte Plattform; macOS und Linux werden gebaut, sind aber noch wenig getestet. Linux braucht WebKitGTK und für Dialoge `zenity` oder `kdialog`.
:::

## Dein erstes Deck {id=erstes-deck}

````md
# Mein Vortrag {layout=title}

Eine Zeile Untertitel.

# Warum?

- Erster Grund
- Zweiter Grund

## Mehr dazu {optional}

Details, nur bei Fragen.
````

::: notes
In der App wählst du auf der Startseite „Neues Deck“ (Strg+N) und legst einen leeren Ordner an, oder du öffnest eines der Beispiele. Ein Deck ist ein Ordner mit einer oder mehreren Markdown-Dateien; eine `deck.yaml` ist optional und legt Titel, Theme und die Reihenfolge der Dateien fest.

Jede Überschrift ist ein Knoten im Baum. Das Beispiel hat zwei Kapitel auf dem Hauptpfad; „Mehr dazu“ ist ein **optionales** Detail darunter: Die Leertaste überspringt es, ↓ taucht dort hinein. Das Gerüst für ein neues Deck erzeugt auch der Befehl `make new DECK=decks/mein-vortrag`.
:::

## Schreiben mit dem Editor {id=editor}

- Text links, **Live-Vorschau** rechts
- `/` öffnet Bausteine, `Strg+K` die Palette
- Bilder per Drag & Drop oder Einfügen

::: notes
Der Editor ist in der App eingebaut (Strg+1) und läuft auch im Browser mit `make edit`. Jede Änderung wird nach einem Moment gespeichert und sofort in der Vorschau gezeigt; die Vorschau folgt dem Cursor. Vorschläge erscheinen beim Tippen: ein `/` am Zeilenanfang öffnet die Bausteine (Kapitel, Spalten, Code, Mermaid, Notizen und mehr), `::: ` die Container, `{` die Attribute. Unbekannte Layouts oder Attribute sind wellig unterstrichen, ein Klick bietet die Korrektur an.

Bilder fügst du per Drag & Drop oder mit Strg+V (Screenshot) ein; sie landen im Ordner `bilder/` neben dem Deck. Änderungen aus einem anderen Editor, zum Beispiel VS Code, übernimmt Hashmark automatisch.
:::

## Präsentieren und ausgeben {id=erstes-praesentieren}

| Taste / Menü | Wirkung |
| --- | --- |
| F5 / Shift+F5 | Präsentieren ab hier / von vorne |
| Space | dem Vortragsplan nach weiter |
| → ← ↓ ↑ | weiter, zurück, abtauchen, hinauf |
| S | Presenter-View mit Notizen und Timer |
| Datei › PDF / PowerPoint / HTML | Exporte |

::: notes
Mit F5 startet die Präsentation im Vollbild; hast du einen zweiten Bildschirm, erscheint die Presenter-View mit Notizen, Timer und dem Baum dort automatisch. Die Optionen dafür stehen am Pfeil neben „Präsentieren“.

Die Ausgaben findest du im Menü Datei: **PDF** (alle Folien, nur der Hauptpfad, Handout mit Notizen), **PowerPoint** mit bearbeitbarem Text und Animationen und eine **einzelne HTML-Datei**, die offline per Doppelklick läuft. Mehr dazu im Thema „Export und Weitergabe“.
:::

## Im Browser ausprobieren {id=online}

- Live-Instanz: **hashmark.onrender.com**
- Präsentation öffentlich, Editor nur mit Passwort

::: notes
Unter `https://hashmark.onrender.com` läuft der Webdienst von Hashmark mit einem Beispiel-Deck. Die Präsentation ist öffentlich; der Editor unter `/editor.html` ist durch ein Passwort geschützt. Wie du den Dienst selbst betreibst, steht im Thema „Editor und App“.
:::

## Aus dem Quelltext arbeiten {id=quelltext optional}

```sh
make setup                     # einmalig: Node.js und Pakete
make dev                       # Beispiel-Deck auf http://localhost:3030
make new DECK=decks/vortrag    # eigenes Deck anlegen
make edit DECK=decks/vortrag   # Editor mit Live-Vorschau
```

::: notes
Hashmark bringt alles mit, auch Node.js: `make setup` lädt ein portables Node nach `vendor/node` und installiert die Pakete. `make dev` startet den Entwicklungsserver mit Hot Reload: Du speicherst die Markdown-Datei, die Folie bleibt stehen und der Inhalt aktualisiert sich. Voraussetzung ist GNU Make; für die Desktop-App zusätzlich Go (ab 1.26). Die Entwicklerdokumentation steht in `CONTRIBUTING.md` im Repository.
:::
