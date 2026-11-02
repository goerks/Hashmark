# Layouts und Gestaltung {id=gestaltung}

::: cards cols=2
::: card icon=layers title="Layouts"
23 eingebaute, ein Wort an der Überschrift
:::
::: card icon=card title="Karten"
Kacheln mit Icon und Titel
:::
::: card icon=star title="Figuren" step=1
Bilder mit Sprechblasen und Rahmen
:::
::: card icon=alert title="Hinweiskästen" step=2
Tipp, Wichtig, Achtung wie auf GitHub
:::
:::

::: notes
Struktur und Aussehen sind getrennt. Ein **Layout** ordnet eine Folie, ein **Theme** gibt Farben und Schriften. Für Gestaltungselemente gibt es Container: `::: cards` baut Kacheln, `::: figure` setzt Beschriftungen auf ein Bild, `::: table` formatiert Tabellen, `> [!TIP]` setzt einen Hinweiskasten. Alles bleibt Markdown, nichts wird gezeichnet.

Diese Folie ist selbst ein Beispiel: Die Karten 3 und 4 erscheinen mit den Schritten.
:::

## Layouts {id=layouts}

```md
# Mein Vortrag {layout=title}
## Kernaussage {layout=statement}
## Vorher und nachher {layout=comparison}
```

::: notes
Ein Layout wählst du mit `layout=` an der Überschrift. Die wichtigsten: `title` für den Auftakt, `section` für Kapitel mit Kacheln der Unterknoten, `statement` für eine große Aussage, `quote` für ein Zitat, `two-col` und `three-col` für Spalten, `comparison` für zwei Seiten, `image-left` und `image-right` für Bild und Text, `code-focus` für Code, `agenda` für die Kapitel des Hauptpfads, `banner` für ein Bildband oben. Dazu kommen `contact` (Kontaktfolie mit Foto, Name, Funktion und Details), `kpi` (Kennzahlen als Kacheln), `big-number` (eine große Zahl), `gallery` (Bilder nebeneinander mit Unterschrift), `timeline` (Zeitstrahl aus einer Liste) und `blank` (leere Folie für Demos und Videos). Alle 23 stehen im Teil „Nachschlagen“ unter „Layouts“.

In der `deck.yaml` legst du Layouts je Ebene fest (`layouts: { 1: section }`) oder für das ganze Deck (`layout:`). Eigene Layouts definierst du im Theme, siehe Thema „Themes und Firmen-Look“.
:::

## Kontakt, Kennzahlen und mehr {id=weitere-layouts}

```md
## Kontakt {layout=contact}

![Anna Beispiel](anna.jpg)

**Anna Beispiel**
Leiterin Digitalisierung

- E-Mail: anna@firma.ch
- Telefon: +41 00 000 00 00

## Zahlen 2026 {layout=kpi}

- **42 %** weniger Rückfragen
- **3,2 s** Ladezeit
```

::: notes
Sechs Layouts nehmen dir Gestaltungsarbeit ab, ohne dass du etwas zeichnest. `contact` ist die Kontaktfolie: links das Foto (rund) mit Name und Funktion, rechts die Details. Die erste Zeile unter dem Foto ist der Name, die zweite die Funktion; Listenzeilen der Form „Beschriftung: Wert“ erscheinen rechts mit kleiner Beschriftung.

`kpi` macht aus einer Liste Kennzahl-Kacheln (`- **42 %** Beschriftung`), `big-number` zeigt eine einzige große Zahl (`**38 %**`, darunter Beschriftung und Quelle). `gallery` setzt Bilder gleich hoch nebeneinander und nimmt den Alt-Text als Unterschrift. `timeline` macht aus `- **Q1** Konzept` einen waagerechten Zeitstrahl. `blank` ist eine leere Folie ohne Titel und Fußzeile, etwa für ein Video oder eine Live-Demo; der Titel bleibt für Suche und Übersicht erhalten.

`kpi` und `timeline` gibt es auch als Bausteine (`::: kpis`, `::: timeline`) mit Schritten und Trend. Das Layout ist die kürzere Schreibweise, wenn die ganze Folie nur diese Liste zeigt.
:::

## Spalten und Raster {id=spalten}

```md
::: columns cols="2:1"
::: col
Links, doppelt so breit
:::
::: col
Rechts
:::
:::
```

::: notes
Container schreibst du mit `:::` (Pandoc-Schreibweise): Gleich viele Doppelpunkte schließen ihn. `::: columns` setzt Spalten nebeneinander, `cols=3` gibt die Zahl vor, `cols="2:1"` das Verhältnis. `::: grid cols=3 gap=1rem` ordnet beliebige Blöcke in einem Raster.
:::

## Karten {id=karten}

```md
::: cards cols=3 steps
::: card icon=user title="Akteure"
Rollen, Personas, externe Systeme
:::
:::
```

::: notes
`::: cards` ordnet Karten im Raster, `cols=` gibt die Spaltenzahl vor, `steps` blendet sie nacheinander ein. Jede `::: card` hat ein `icon=` und einen `title=`.

Eingebaute Icons: user, users, target, clock, check, x, alert, star, book, gear, link, cloud, flag, list, map, layers, scissors, search, lock, card, bank, phone, bulb, file, code, chart, arrow, ball, sitemap, shield, mail, calendar, coffee, rocket, puzzle, heart. Jeder andere Wert, etwa ein Emoji, erscheint unverändert.
:::

## Figuren mit Beschriftungen {id=figuren}

```md
::: figure w=70
![Kontext](bilder/kontext.svg)

::: frame at="3,36" size="21,24" label="Akteur" step=1
:::

::: bubble at="40,5" w=34 tail=down step=2
Das **System** bleibt eine Blackbox.
:::

::: pin at="80,32" step=3
1
:::
:::
```

::: notes
Eine Figur legt Beschriftungen auf ein Bild, ohne Grafikprogramm: `bubble` ist eine Sprechblase (`tail=` zeigt die Richtung), `frame` ein Rahmen mit Beschriftung, `pin` eine nummerierte Markierung. Positionen sind Prozent der Figur (`at="x,y"`), die Größe `size="b,h"` bzw. `w=`. Mit `step=` erscheinen sie nacheinander. Ohne `::: figure` gelten die Positionen für die ganze Folie.
:::

## Tabellen {id=tabellen}

```md
::: table widths="2:1:1" steps=rows hl="r2c3"
| Werkzeug | Text | Diagramm |
| --- | :---: | :---: |
| Hashmark | ja | ja |
:::
```

::: notes
`::: table` um eine Markdown-Tabelle setzt Spaltenbreiten (`widths`), blendet Zeilen oder Spalten schrittweise ein (`steps=rows` bzw. `steps=cols`) und hebt Zellen hervor (`hl="r2c3,c1"`: Zeile und Spalte, ab 1 gezählt, `r0` ist der Kopf).
:::

## Fertige Bausteine {id=bausteine}

| Baustein | Wofür | Aufbau |
| --- | --- | --- |
| `timeline` | Zeitstrahl | Liste; `vertical`, `steps` |
| `process` | Prozess aus Pfeilen | Liste; `steps` |
| `kpis` | Kennzahlen | Kinder `::: kpi value= label= trend=up\|down\|flat delta=` |
| `person` | Profilkarte | `name=`, `role=`, `photo=`; Text als Beschreibung |
| `roadmap` | Phasen mit „heute“-Linie | Liste; `today="41%"`, `done=2` |
| `pyramid` | Schichten | Liste; `inverted` |
| `matrix` | Vierfelder-Matrix | Liste mit 4 Punkten; `x=`, `y=`, `focus=` |
| `versus` | vorher und nachher | Kinder `::: before` und `::: after` |
| `pipeline` | Ablauf mit Status | Kinder `::: stage label= state=done\|run\|open progress=` |
| `states` | Statusautomat | Kinder `::: state label= at=` |
| `gantt` | Zeitplan | Kinder `::: task label= start= length=` |
| `checklist` | Checkliste mit Fortschritt | Kinder `::: item label= state=done\|wip\|open` |

::: notes
Fertige Bausteine sind Container, die aus wenigen Angaben eine fertige Grafik machen. Du schreibst nur den Inhalt, Aussehen und Rechnen übernimmt Hashmark. Die Bausteine übernehmen Farben und Schrift des Themes. Im Editor tippst du `/` und den Namen (zum Beispiel `/pipeline`), dann steht ein fertiges Beispiel im Text, das du anpasst. Mit `steps` erscheinen die Einträge nacheinander. Das Beispiel-Deck „Komponenten“ zeigt alle. Eigene Bausteine baust du selbst, siehe „Themes und Firmen-Look“.
:::

### Pipeline {id=pipeline}

```md
::: pipeline title="Release 4.2" summary steps
::: stage label="Bauen" state=done time="1:12 min"
:::
::: stage label="Testen" state=run progress=62
:::
::: stage label="Ausrollen"
:::
:::
```

::: notes
Eine Pipeline zeigt einen Ablauf in Stufen. `state=done` ist erledigt (grün, voll), `state=run` läuft (mit `progress=` in Prozent, Standard 50, pulsiert in der Präsentation), ohne Status ist die Stufe offen. `time=` ist ein freier Text wie eine Dauer. Mit `summary` steht oben rechts der Anteil der erledigten Stufen, den Hashmark selbst ausrechnet. Mit `steps` erscheint jede Stufe in ihrem Schritt.
:::

### Statusautomat {id=statusautomat}

```md
::: states title="Freigabe" back="Änderungen nötig"
::: state label="Entwurf" at=1 then=3
:::
::: state label="Prüfung" at=2 then=4
:::
::: state label="Freigabe" at=5
:::
:::
```

::: notes
Die Zustände stehen nebeneinander. `at=2` heißt: Im zweiten Schritt leuchtet dieser Zustand. `then=4` lässt ihn in einem späteren Schritt noch einmal leuchten, so erzählst du einen Rücksprung (Entwurf, Prüfung, zurück zum Entwurf, wieder Prüfung, Freigabe). `back=` schreibt eine Beschriftung für den Rückweg unter die Reihe. Es leuchtet immer nur ein Zustand pro Schritt. Im PDF und im Lesemodus leuchtet keiner.
:::

### Zeitplan {id=zeitplan}

```md
::: gantt title="Projektplan 2027" scale=12 now=6 from="Jan" to="Dez" steps
::: task label="Konzept" start=0 length=2 state=done
:::
::: task label="Bau" start=2 length=5
:::
:::
```

::: notes
`scale=` ist die Länge der Zeitleiste in beliebigen Einheiten (Standard 12, etwa Monate oder Wochen). Jede Aufgabe hat `start=` (ab 0) und `length=`, Position und Breite rechnet Hashmark daraus aus. `now=` setzt eine rote „heute“-Linie, `from=` und `to=` beschriften die Enden. `state=done` macht den Balken kräftig, offene sind blasser.
:::

### Checkliste {id=checkliste}

```md
::: checklist title="Go-Live" progress steps
::: item label="Daten migrieren" state=done owner=Anna
:::
::: item label="Schulung planen" state=wip owner=Ben
:::
::: item label="Freigabe holen"
:::
:::
```

::: notes
`state=done` setzt ein Häkchen und streicht den Eintrag durch, `state=wip` zeigt „in Arbeit“, ohne Status ist er offen. `owner=` nennt, wer sich kümmert. Mit `progress` steht unten ein Balken und „n von m erledigt“, beides zählt Hashmark selbst. Mit `steps` erscheinen die Einträge nacheinander.
:::

## Hinweiskästen {id=hinweise}

> [!TIP]
> Mit `{fit}` passt eine volle Folie auf die Bühne.

> [!WARNING]
> Ein Doppelpunkt in einem Attribut zerreißt den Wert.

::: notes
Hinweiskästen schreibst du wie auf GitHub: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` oder `> [!CAUTION]`, danach optional ein eigener Titel (`> [!TIP] Kurz gesagt`). Die Farben kommen aus dem Theme.
:::

## Bilder, Bildband und Hintergrund {id=bilder}

```md
![](foto.jpg){fit=cover ratio=16/9 pos="50% 20%"}

## Titel {layout=banner banner=foto.jpg bannerh=210}
## Aufbruch {bg=berg.jpg bgdim=0.5}
```

::: notes
Bilder liegen im Deck-Ordner (Ordner `bilder/` ist üblich). Attribute direkt hinter dem Bild schneiden zu: `fit=cover`, `contain` oder `fill`, `pos=` wählt den Ausschnitt, `ratio=16/9` das Seitenverhältnis (mit Schrägstrich, ein Doppelpunkt geht nicht), `width=` und `height=` die Größe.

Das Layout `banner` legt ein Bild als **Band** an den oberen Rand (`banner=`, Höhe `bannerh=` in px, Ausschnitt `bannerpos=`). `bg=` setzt einen **Hintergrund** aus Farbe, Verlauf oder Bild, `bgdim=0.5` dunkelt ein Bild ab. Bilder außerhalb des Deck-Ordners werden eingebettet, mit `embedImages: true` in der `deck.yaml` alle. Alle Optionen stehen im Teil „Nachschlagen“ unter „Bilder und Video“.
:::

## Fußzeile und Folienzahl {id=fusszeile}

```yaml
footer: Hashmark · Handbuch
slideNumber: "{n} / {total}"
```

::: notes
In der `deck.yaml` setzt `footer` eine Fußzeile auf jede Folie, `slideNumber` die Folienzahl (`true` = nur die Zahl, sonst eine Vorlage mit `{n}` und `{total}`). Nummeriert wird in Baumreihenfolge. `{footer=off}` an der Überschrift blendet die Fußzeile auf einer Folie aus; Titel-, Kapitel- und Statement-Folien zeigen sie ohnehin nicht.
:::

## Kapitelnummern und Inhaltsverzeichnis {id=kapitelnummern}

```yaml
numbering: { from: 1, to: 2 }
```

```md
# Inhalt {layout=agenda levels=1-2}

# Markt
## Trends
## Wettbewerb {number=off}
```

::: notes
Du schreibst keine Nummern in die Überschriften. Mit `numbering:` in der `deck.yaml` zählt Hashmark die Kapitel selbst: `from` und `to` legen fest, von welcher bis zu welcher Ebene gezählt wird (Standard 1 bis 2). Ebene 1 wird `1`, `2`, `3`, Ebene 2 `1.1`, `1.2`. Beginnst du bei `from: 2`, zählt diese Ebene durchlaufend über das ganze Deck. Die Nummer steht im Folientitel, im Verzeichnis, im Lesemodus, in Übersicht, Suche und Presenter-Baum, im PDF und in PowerPoint. Sie wird beim Laden berechnet: Verschiebst du ein Kapitel, zählt Hashmark neu, die Sprungadressen bleiben gleich.

Titelfolie, Agenda und Anhang bekommen keine Nummer (`appendix: true` zählt den Anhang mit). Einzelne Kapitel nimmst du mit `{number=off}` samt Unterkapiteln heraus, es entsteht keine Lücke. `{number=on}` holt ein Kapitel zurück. `titles: false` zeigt die Nummern nur im Verzeichnis und in den Listen, der Folientitel bleibt unverändert.

Das Inhaltsverzeichnis ist die Agenda-Folie mit `levels=1-2`: Sie zeigt alle Kapitel dieser Ebenen, eingerückt und mit Nummer. `{toc=off}` lässt ein Kapitel samt Unterkapiteln weg. Ab etwa 16 Einträgen wird die Folie sehr voll, `hashmark check` warnt dann.
:::

## Volle Folien einpassen {id=fit}

```md
## Viel Inhalt {fit}
```

::: notes
`{fit}` verkleinert den Inhalt einer Folie, bis alles passt, höchstens auf 70 Prozent. `{fit=off}` schaltet es für eine Folie ab. Ob Folien überlaufen, prüft „Prüfen“ (`make check`) für das ganze Deck, siehe Thema „Editor und App“.
:::
