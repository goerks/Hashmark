# Baum und Navigation {id=navigation}

| Taste | Wirkung |
| --- | --- |
| → / ← | weiter / zurück auf der Ebene |
| ↓ / ↑ | ins Detail / zurück |
| Space | dem Vortragsplan nach |
| Strg+K | Folie suchen |
| O | Übersicht des Baums |

::: notes
Eine Hashmark-Präsentation ist ein Baum aus Überschriften. Du erzählst den Hauptpfad und entscheidest im Vortrag, wo du ins Detail gehst. Unten rechts zeigt ein **Steuerkreuz** auf jeder Folie, welche Richtungen möglich sind; nicht mögliche sind ausgegraut. **H** blendet es aus.

In diesem Kapitel: wie Überschriften zu Knoten werden, wie Ausflüge funktionieren, wie du eine Folie teilst, wie du mehrere Dateien zusammenstellst und wie du im Vortrag springst.
:::

## Hauptpfad und Details {id=hauptpfad}

```md
# Architektur
## Parser
## Runtime
```

::: notes
Details sind normale Überschriften einer tieferen Ebene. Der Parser legt die oberste Ebene jeder Datei auf Tiefe 1; mit `maxDepth` in der `deck.yaml` bestimmst du, wie tief Überschriften noch Knoten sind (Standard 3). Tiefere Überschriften werden Abschnitte innerhalb der Folie.

→ geht auf der aktuellen Ebene weiter, also von „Parser“ zu „Runtime“. ↓ taucht in den Unterbaum, ↑ kehrt an die Stelle zurück, von der du abgetaucht bist.
:::

## Ausflug und Rückkehr {id=ausflug optional}

::: steps
- ↓ startet einen **Ausflug** in Optionales
- Space geht die Details der Reihe nach durch
- Am Ende führt Space zur Abzweigung **zurück**
:::

::: notes
Knoten mit dem Flag `{optional}` sind für „bei Zeit oder Fragen“ gedacht. Space überspringt sie. Wer ↓ drückt, beginnt einen **Ausflug**: Space läuft die optionalen Details ab und führt am Ende von selbst zur Abzweigung zurück, damit du den Faden nicht verlierst. Esc bricht den Ausflug ab.

Dieser Abschnitt ist selbst optional: Im Vortrag mit Space wird er übersprungen, im Lesemodus siehst du ihn mit dem Kennzeichen „Optional“. Wie du Rollen und Zeitbudget planst, steht im Thema „Vortrag und Presenter“.
:::

## Sub-Slides {id=sub-slides}

```md
## Ergebnis

Erste Ansicht

---

Zweite Ansicht, gleicher Knoten
```

::: notes
Ein `---` teilt einen Knoten in mehrere **Sub-Slides**. Sie gehören in der Nummerierung und im Baum zu einem Knoten; → blättert durch sie hindurch. Notizen gehören zu der Sub-Slide, in der sie stehen.
:::

## Mehrere Dateien {id=dateien}

```yaml
mount:
  - file: 01-einleitung.md
  - file: 02-architektur.md
  - file: details/backend.md
    under: "Architektur > Backend"
```

::: notes
Ein Deck ist ein Ordner mit Markdown-Dateien. Ohne `mount` in der `deck.yaml` nimmt Hashmark alle `.md`-Dateien in alphabetischer Reihenfolge, jede Datei ein Kapitel. Mit `mount` legst du die Reihenfolge fest und hängst eine Datei auch unter einen bestehenden Knoten (`under`, Titel mit `>` getrennt). Dieses Handbuch ist so aufgebaut: die Teile in einer Datei, die Kapitel jeweils darunter.
:::

## Springen und suchen {id=suche}

- **Strg+K** oder **/** sucht nach Titel und Text
- **O** zeigt den ganzen Baum als Übersicht
- **Home** führt zum Anfang

::: notes
Die Suche findet Folien nach Titel und Text der Folie; Enter springt hin. Die Übersicht (O oder Strg+Shift+O) zeigt alle Knoten als Miniaturen, ein Klick springt. Ein Sprung auf einen Knoten abseits des Pfads ist ein Ausflug mit einer Folie: Space führt danach zurück.

Mit **T** schaltest du den Vortragsplan aus, dann läuft Space wieder durch alles.
:::

## Links auf eine Folie {id=deep-links}

```md
Siehe [die Architektur](#architektur).
```

::: notes
Jeder Knoten hat eine Adresse: die `id` aus der Überschrift (`{id=architektur}`) oder sonst den Titel in Kleinbuchstaben mit Bindestrichen. `…/#architektur` öffnet die Präsentation an dieser Stelle, `#architektur:2` auf der zweiten Sub-Slide. Ein Link im Text springt in der Präsentation, im PDF ist er ein klickbarer Querverweis.

Mit `?reader` hinter der Adresse öffnet sich der Lesemodus, wie bei diesem Handbuch.
:::
