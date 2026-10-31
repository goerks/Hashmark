# Tastatur {id=tastatur}

| Taste | Wirkung |
| --- | --- |
| → / ← | weiter / zurück auf der Ebene (Schritte, Sub-Slides) |
| ↓ / Enter | ins Detail abtauchen |
| ↑ / Esc | auftauchen, zurück zum Elternknoten |
| Space / Shift+Space | dem Vortragsplan nach vor / zurück |
| Bild ab / Bild auf | wie Space (Clicker) |
| Home | zum Anfang |
| T | Vortragsplan aus / an |

---

| Taste | Wirkung |
| --- | --- |
| Strg+K oder / | Suche |
| O oder Strg+Shift+O | Übersicht |
| S / N | Presenter-View / Notizen unten |
| P in der Presenter-View | Vortragsplan bearbeiten |
| B oder . | Bildschirm schwarz |
| F oder F5 | Vollbild |
| H | Navigationshinweise aus / an |
| ? | Hilfe mit allen Tasten |

---

| Taste | Wirkung |
| --- | --- |
| Z | Bild, Code, Diagramm oder Tabelle vergrößern / zurück |
| + / − | tiefer / heraus zoomen, Pfeile verschieben |
| K | Video starten, anhalten, fortsetzen |
| P | Druckansicht und PDF |
| Strg+P | alle Folien drucken |
| Strg+W (App) | Präsentation beenden |
| Wischen (Touch) | links weiter, rechts zurück |

::: notes
Dauerhaft stehen nur ein dünner Fortschrittsbalken, die Position („12 / 31“) und, falls vorhanden, „↓ 3 Details“ auf der Folie. Bei Mausbewegung oder Tastendruck erscheint unten rechts für 3 Sekunden eine Karte mit dem Ziel von Space und einem Steuerkreuz; nicht mögliche Richtungen sind ausgegraut. Auf Touchgeräten bleibt das Steuerkreuz sichtbar. Mit verbundener Presenter-View entfallen alle Hinweise; im PDF steht unten rechts nur die Seitenzahl. Bild ab und Bild auf verhalten sich wie Space, damit Presenter-Fernbedienungen funktionieren. Am Telefon oder Tablet: Antippen eines Bildes, Codeblocks, Diagramms oder einer Tabelle zoomt hinein, zwei Finger spreizen zoomt, ein Finger verschiebt.

**?** zeigt in der Präsentation jederzeit die vollständige Liste.
:::

# Befehle {id=befehle}

| In der App | Wirkung |
| --- | --- |
| Strg+N / Strg+O | Neues Deck / Deck öffnen |
| Strg+1 / Strg+2 | Editor / Präsentation im Fenster |
| F5 / Umschalt+F5 | Präsentieren ab hier / von vorne |
| Strg+Umschalt+P | PDF, alle Folien |
| Strg+Umschalt+X | PowerPoint, alle Folien |
| Strg+Umschalt+E | als HTML-Datei exportieren |

---

| Befehl | Zweck |
| --- | --- |
| `make dev` / `make edit` | Präsentation bzw. Editor mit Live-Vorschau |
| `make check` | Deck prüfen (Layouts, Attribute, Überlauf) |
| `make pdf` / `make pptx` | PDF bzw. PowerPoint |
| `make export` / `make build` | eine HTML-Datei / statische Seite |
| `make serve` | Webdienst mit Editor (Passwort) |
| `make new DECK=…` | neues Deck anlegen |

::: notes
Die Befehle braucht nur, wer aus dem Quelltext arbeitet; in der App stehen dieselben Funktionen im Menü. Alle `make`-Befehle nehmen `DECK=pfad` (Standard: das Beispiel-Deck) und oft `PORT=…`. PDF und PowerPoint kennen `DEPTH=1` (nur Hauptpfad), `STEPS=1` (jeder Schritt einzeln), `PLAN=path` (nach Vortragsplan) und beim PDF `NOTES=1` (Handout).

Dahinter steckt die Befehlszeile `hashmark` mit den Unterbefehlen `dev`, `edit`, `serve`, `build`, `preview`, `export`, `pdf`, `pptx` und `check`; `hashmark --help` nennt alle Optionen. Wie man Hashmark selbst baut, steht in `CONTRIBUTING.md` im Repository.
:::
