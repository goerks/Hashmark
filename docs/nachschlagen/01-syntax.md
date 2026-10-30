# Schreibweise {id=syntax}

| Syntax | Bedeutung |
| --- | --- |
| `#` bis `######` | Knoten (Folien) im Baum |
| `---` | Sub-Slide im selben Knoten |
| `::: name` … `:::` | Container |
| `{layout=… id=…}` | Attribute an einer Überschrift |
| `![Bild](datei){…}` | Bild oder Video mit Attributen |
| `$a^2$` / `$$ … $$` | Formel im Satz / als Block |
| `> [!TIP]` | Hinweiskasten |

::: notes
Hashmark ist reines Markdown mit drei Ergänzungen: Container mit `:::` (Pandoc-Schreibweise, gleich viele Doppelpunkte schließen), Attribute in geschweiften Klammern direkt an Überschriften, Bildern und Codeblöcken, und Notizen in `::: notes`. Alles andere (Listen, Tabellen, Links, Code) ist gewöhnliches Markdown.

Die oberste Überschriftenebene jeder Datei wird auf Tiefe 1 gelegt, `maxDepth` in der `deck.yaml` begrenzt die Tiefe der Knoten. Die Tabellen in diesem Teil nennen alles, was Hashmark kennt.
:::

## Attribute an Überschriften {id=attribute}

| Attribut | Wirkung |
| --- | --- |
| `layout=…` | Layout der Folie, siehe „Layouts“ |
| `id=…` | eigene Sprungmarke (sonst aus dem Titel) |
| `.klasse` | CSS-Klasse an der Folie |
| `transition=…` | Übergang zu dieser Folie, siehe „Übergänge“ |
| `effect=…` | Auftritt der Schritte dieser Folie: `fade`, `up`, `left`, `scale`, `wipe`, `highlight`, `dim` (siehe „Effekte für Schritte“) |
| `speed=…` | Tempo des Übergangs zu dieser Folie: `fast`, `normal`, `slow` |
| `duration=5m` | geplante Redezeit (`90s`, `5m`, `1h`) |
| `bg=…` | Hintergrund: Farbe, Verlauf oder Bild |
| `bgdim=0.5` | Hintergrundbild abdunkeln (0 bis 1) |
| `steps` | erste Liste der Folie schrittweise |

---

| Attribut | Wirkung |
| --- | --- |
| `fit` | Inhalt einpassen (`fit=off` schaltet ab) |
| `optional` | Rolle Optional: Space überspringt |
| `appendix` | Rolle Anhang: nur über Suche und Übersicht |
| `plan=…` | Rolle: `path`, `optional` oder `appendix` |
| `banner=bild.jpg` | Bildband (mit `layout=banner`) |
| `bannerh=210` | Höhe des Bildbands in px |
| `bannerpos="50% 30%"` | Ausschnitt des Bildbands |
| `footer=off` | Fußzeile auf dieser Folie ausblenden |

::: notes
Attribute stehen in geschweiften Klammern am Ende der Überschrift, getrennt durch Leerzeichen: `## Demo {layout=two-col transition=zoom duration=3m}`. Werte mit Leerzeichen kommen in Anführungszeichen. Flags wie `steps`, `fit`, `optional` und `appendix` haben keinen Wert. Ein Doppelpunkt in einem Wert geht nicht (er zerreißt den Text), deshalb `ratio=16/9` und `start=5s`.
:::

## Container {id=container-liste}

| Container | Wofür |
| --- | --- |
| `::: columns` | Spalten nebeneinander (`cols=3`, `cols="2:1"`) |
| `::: col` | eine Spalte |
| `::: grid` | Raster (`cols=`, `gap=`) |
| `::: steps` | Liste Punkt für Punkt (`start=`) |
| `::: reveal` | beliebigen Block ab Schritt n (`step=`, `until=`) |
| `::: notes` | Sprechernotizen (`step=`) |
| `::: children` | Kacheln der Unterknoten |
| `::: table` | Tabelle (`widths=`, `steps=rows`, `hl=`) |

---

| Container | Wofür |
| --- | --- |
| `::: cards` | Karten im Raster (`cols=`, `steps`) |
| `::: card` | Karte (`icon=`, `title=`) |
| `::: figure` | Bild mit Beschriftungen (`w=`) |
| `::: bubble` | Sprechblase (`at=`, `w=`, `tail=`) |
| `::: frame` | Rahmen (`at=`, `size=`, `label=`) |
| `::: pin` | nummerierte Markierung (`at=`) |

---

| Komponente | Wofür | Kinder und wichtige Angaben |
| --- | --- | --- |
| `pipeline` | Ablauf mit Status | `::: stage label= state=done\|run\|open progress= time=`; `summary`, `steps` |
| `states` | Statusautomat | `::: state label= at= then=`; `back=` |
| `gantt` | Zeitplan | `::: task label= start= length= state=done\|open`; `scale=`, `now=`, `from=`, `to=` |
| `checklist` | Checkliste | `::: item label= state=done\|wip\|open owner=`; `progress`, `steps` |
| `kpis` | Kennzahlen | `::: kpi value= label= trend=up\|down\|flat delta=` |

::: notes
Fast alle Container kennen `step=` und `until=`. Eingebaute Komponenten kommen dazu: `timeline`, `process`, `kpis`, `person`, `roadmap`, `pyramid`, `matrix`, `versus`, `aside`, `pipeline`, `states`, `gantt` und `checklist`; eigene liegen als HTML-Vorlage im Ordner `components/` (siehe Thema „Themes und Firmen-Look“).
:::

## Layouts {id=layouts-liste}

| Layout | Wofür |
| --- | --- |
| `title` | Titelfolie, groß und mittig |
| `section` | Kapitelfolie mit Kacheln der Unterknoten |
| `default` | Überschrift und Inhalt (Standard) |
| `statement` | Kernaussage, groß und mittig |
| `quote` | Zitat |
| `agenda` | Agenda aus den Kapiteln, aktuelles markiert |

---

| Layout | Wofür |
| --- | --- |
| `two-col` | zwei Spalten |
| `three-col` | drei Spalten |
| `two-col-wide` | Text links, schmale Randspalte rechts |
| `comparison` | Gegenüberstellung |
| `split` | links Farbfläche mit Titel, rechts der Inhalt |
| `code-focus` | Code im Mittelpunkt |

---

| Layout | Wofür |
| --- | --- |
| `image-left` | Bild links, Text rechts |
| `image-right` | Bild rechts, Text links |
| `image-full` | Bild füllt die Folie (`bg=`), Titel darüber |
| `banner` | Bildband oben (`banner=`), Inhalt darunter |
| `diagram` | kleiner Titel, das Diagramm füllt den Rest |

---

| Layout | Wofür |
| --- | --- |
| `contact` | Kontakt: links Foto mit Name und Funktion, rechts die Details |
| `kpi` | Kennzahlen als Kacheln, aus einer Liste `- **42 %** Text` |
| `big-number` | eine große Zahl `**38 %**` mit Beschriftung |
| `gallery` | Bilder nebeneinander, der Alt-Text ist die Unterschrift |
| `timeline` | Zeitstrahl aus einer Liste `- **Q1** Text` |
| `blank` | leere Folie ohne Titel und Fußzeile, der Inhalt füllt alles |

::: notes
Layouts setzt du mit `{layout=…}` an der Überschrift, je Ebene in der `deck.yaml` (`layouts: { 1: section, 2: default }`) oder für das ganze Deck (`layout: default`). Eigene Layouts kommen aus dem Theme (`.layout-<name>`).
:::

## Übergänge {id=uebergaenge-liste}

| Übergang | Wirkung |
| --- | --- |
| `slide` | schiebt seitlich |
| `zoom` | fährt hinein bzw. heraus |
| `fade` | blendet über |
| `none` | ohne Bewegung |

::: notes
Ohne `transition=` richtet sich der Übergang nach der Richtung: seitlich schieben bei → und ←, zoomen bei ↓ und ↑, überblenden bei Sprüngen. Der Übergang gilt für den Wechsel zu der Folie, an der er steht. Das Tempo stellst du mit `speed=` ein (`fast` 190 ms, `normal` 380 ms, `slow` 760 ms), fürs ganze Deck mit `motion: speed:` in der `deck.yaml`.
:::

## Bilder und Video {id=bild-attribute}

| Attribut | Wirkung |
| --- | --- |
| `width=60%`, `height=200` | Größe |
| `fit=cover` | `cover`, `contain` oder `fill` |
| `pos="50% 20%"`, `ratio=16/9` | Ausschnitt, Seitenverhältnis |
| `step=2`, `until=3` | erscheint ab Schritt 2, verschwindet ab 3 |
| `zoom`, `zoom=off` | mit Z vergrößerbar bzw. ausgenommen |
| `zoomstep=2`, `zoomuntil=3` | Kamera fährt bei Schritt 2 hin, bei 3 zurück |
| `steps=ids`, `layers`, `groups` | SVG, draw.io, Excalidraw schrittweise |

---

| Attribut (Video) | Wirkung |
| --- | --- |
| `play=1` | startet mit Schritt 1 (`play=0` sofort) |
| `start=5s`, `end=1m30s` | Ausschnitt |
| `loop`, `muted` | wiederholen, ohne Ton |
| `poster=bild.png` | eigenes Standbild |
| `controls` | Abspielleiste, kein Schritt |

::: notes
Attribute stehen direkt hinter dem Bild: `![Plan](plan.png){width=60% step=1}`. `.klasse` hängt eine CSS-Klasse an. Bei Excalidraw legt `order="3,1,2+4"` die Reihenfolge der Gruppen fest. Videos erkennt Hashmark an der Endung `.mp4`, `.m4v`, `.webm` oder `.ogv`. Bilder außerhalb des Deck-Ordners werden eingebettet; Referenz-Bilder (`![Logo][logo]` mit `[logo]: data:…` am Dateiende) gehen auch.
:::

## Codeblöcke {id=code-attribute}

| Codeblock | Attribute |
| --- | --- |
| jede Sprache | `title=`, `steps="…"`, `lines="…"` |
| `mermaid` | `look=hand`, `height=520`, `align=left` |
| `math` | `step=`, `until=` |
| `qr` | `size=220`, `label="…"` |

::: notes
Attribute stehen in geschweiften Klammern hinter der Sprache: ` ```ts {title="plan.ts" steps="1,2|3"} `. `steps` blendet Zeilen ein, `lines` hebt sie hervor. Abschnitte trennt ein senkrechter Strich (`steps="1|2|3"`, `lines="2-3|5|all"`), mehrere Zeilen in einem Abschnitt ein Komma oder ein Bereich (`1,6` oder `2-3`), `all` hebt alles auf. Mermaid-Diagramme wachsen mit Zeilen `%% step`.
:::
