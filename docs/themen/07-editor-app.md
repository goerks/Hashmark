# Editor und App {id=editor-app}

- **Editor** mit Live-Vorschau und Vorschlägen
- **Prüfen** findet Tippfehler und volle Folien
- **Desktop-App** ohne Installer, **Webdienst** fürs Team

::: notes
Du schreibst in Hashmark wie in einem Texteditor, siehst aber jede Folie sofort. Der Editor steckt in der Desktop-App und im Webdienst, im Browser startet ihn `make edit`. Daneben kannst du jeden anderen Editor nehmen, zum Beispiel VS Code: Hashmark übernimmt Änderungen an den Dateien von selbst.
:::

## Der Editor {id=editor-details}

| Eingabe | Wirkung |
| --- | --- |
| `/` am Zeilenanfang | Bausteine: Kapitel, Spalten, Code, Diagramm, Notizen |
| `::: ` | Container und eigene Komponenten |
| `{` an der Überschrift | Attribute und Layouts |
| Strg+K | Palette mit allen Befehlen |
| Bild ziehen oder Strg+V | Bild landet in `bilder/` |

::: notes
Links steht der Markdown-Text, rechts die Folie an der Stelle des Cursors. Jede Änderung wird nach einem Moment gespeichert und sofort in der Vorschau gezeigt. Vorschläge erscheinen beim Tippen; unbekannte Layouts oder Attribute sind wellig unterstrichen, ein Klick bietet die Korrektur an („Meintest du …?“). Auf schmalen Bildschirmen und Tablets klappt die Vorschau unter den Text, eine Tastenleiste hilft bei `:::` und Klammern.

Aus dem Editor heraus präsentierst du (F5 in der App) und exportierst (PDF, PPTX, HTML).
:::

## Prüfen {id=pruefen}

```sh
make check DECK=decks/vortrag
```

::: notes
„Prüfen“ geht das ganze Deck durch wie ein Linter: unbekannte Layouts, Attribute und Übergänge, ungültige Angaben an Bildern, Figuren, Diagrammen und Formeln, und **Folien, die überlaufen** (dafür rendert es jede Folie in Edge oder Chrome). Jede Meldung nennt Datei und Zeile. Bei Fehlern endet der Befehl mit Exit 1 und eignet sich so auch für eine CI.
:::

## Desktop-App {id=app}

| Menü | Inhalt |
| --- | --- |
| Datei | Deck öffnen, Neues Deck, Beispiele, Exporte |
| Ansicht | Editor (Strg+1), Präsentation im Fenster (Strg+2) |
| Präsentieren | ab hier (F5), von vorne (Umschalt+F5), Bildschirme |
| Hilfe | Anleitung, Datenordner, Protokoll |

::: notes
Die **Desktop-App** ist ein entpackbarer Ordner mit allem, was sie braucht, auch Node.js: kein Installer, kein Konto, kein Internet. Sie öffnet Decks per Dialog, merkt sich die zuletzt geöffneten, hat den Editor und die Präsentation im Fenster, die Presenter-View auf dem zweiten Bildschirm sowie alle Exporte im Menü Datei. Unter „Präsentieren › Optionen“ wählst du, auf welchem Bildschirm Präsentation und Presenter-View erscheinen.

Windows ist erprobt; Linux und macOS werden gebaut, sind aber noch wenig getestet. Bei Problemen hilft Hilfe › „Protokoll öffnen“, siehe Häufige Fragen.
:::

## Webdienst betreiben {id=webdienst}

| Variable | Bedeutung |
| --- | --- |
| `PORT` | Standard 10000, Render setzt ihn selbst |
| `DECK_DIR` | Deck-Ordner, Standard `/data/deck` |
| `DECK_SEED` | wird beim ersten Start in einen leeren `DECK_DIR` kopiert |

::: notes
Ein einziger Container liefert die Präsentation (`/`, öffentlich) und den Editor (`/editor.html`, ohne Anmeldung). Beide arbeiten auf demselben Deck-Ordner: Änderungen im Editor erscheinen sofort in der Präsentation, es braucht also nur **eine Bereitstellung**. Lokal startest du ihn mit `make serve` oder als Image mit `make image` und `make image-run`.

Das Image läuft auf jedem Container-Dienst: Port aus `PORT`, Health Check `/healthz`, eine Festplatte auf `/data`. Gib die Adresse nur an Menschen weiter, die das Deck ändern dürfen: **Der Editor hat keinen Passwortschutz, wer die Adresse kennt, kann Dateien des Decks ändern.**

**Wichtig:** Ohne Festplatte ist das Dateisystem bei Render flüchtig, Änderungen aus dem Editor gehen bei jedem Neustart verloren (kostenlose Dienste haben keine Festplatte). Mit der Festplatte auf `/data` bleiben sie erhalten. Eine Live-Instanz mit Beispiel-Deck läuft unter `https://hashmark.onrender.com`.
:::
