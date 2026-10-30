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

## Volle Folien einpassen {id=fit}

```md
## Viel Inhalt {fit}
```

::: notes
`{fit}` verkleinert den Inhalt einer Folie, bis alles passt, höchstens auf 70 Prozent. `{fit=off}` schaltet es für eine Folie ab. Ob Folien überlaufen, prüft „Prüfen“ (`make check`) für das ganze Deck, siehe Thema „Editor und App“.
:::
