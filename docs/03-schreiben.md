# Schreibweise {id=schreiben}

````md
# Architektur {layout=two-col}

Der Kern ist ein **Baum**.

::: columns
::: col
Links
:::
::: col
Rechts
:::
:::
````

::: notes
Du schreibst **reines Markdown**. Eigenes ist sparsam: Container mit `:::` (Pandoc-Schreibweise, gleich viele Doppelpunkte schließen) und Attribute in geschweiften Klammern direkt an der Überschrift.

Ein `---` teilt einen Knoten in mehrere **Sub-Slides**, die in der Nummerierung zu einem Knoten gehören. Notizen schreibst du in `::: notes`, sie erscheinen in der Presenter-View und hier im Lesemodus als Text.
:::

## Container und Attribute {id=container}

| Schreibweise | Wirkung |
| --- | --- |
| `::: columns` / `::: col` | Spalten |
| `::: steps` | Liste Punkt für Punkt |
| `::: cards` | Kacheln mit Icon und Titel |
| `::: figure` | Bild mit Sprechblasen und Rahmen |
| `::: notes` | Sprechernotizen |
| `{layout=… id=… duration=5m}` | Attribute an der Überschrift |

::: notes
Die wichtigsten Container sind in der Tabelle. Attribute stehen in geschweiften Klammern an der Überschrift: `layout=` wählt das Layout, `id=` setzt eine Sprungmarke, `duration=` die geplante Redezeit, `bg=` einen Hintergrund, `transition=` den Übergang. Unbekannte Attribute meldet `make check`.

Im Editor (`make edit` oder die Desktop-App) helfen dir **Vorschläge**: Ein `/` am Zeilenanfang öffnet die Bausteine, `::: ` die Container und `{` die Attribute. Der Linter erkennt Tippfehler und schlägt „Meinst du …?“ vor.
:::

## Layouts {id=layouts}

- `title`, `section`, `default`, `statement`, `quote`
- `two-col`, `three-col`, `comparison`
- `image-left`, `image-right`, `code-focus`, `agenda`

::: notes
Ein Layout ist eine Klasse, die die Folie ordnet. Eingebaut sind unter anderem `title` für den Auftakt, `section` mit Kacheln der Kinder, `statement` für eine große Aussage, `quote`, `two-col`, `three-col`, `comparison`, `image-left` und `image-right` mit Bild und Text sowie `code-focus` für einen Codeblock im Mittelpunkt. `agenda` baut das Inhaltsverzeichnis aus dem Baum.

Du kannst Layouts je Ebene festlegen (`layouts: { 1: section }` in der `deck.yaml`) oder eigene als CSS im Theme definieren.
:::

# Schritte {id=schritte}

::: steps
- Erst das Problem
- Dann die Idee
- Zuletzt das Ergebnis
:::

::: notes
Schritte lassen Inhalte nacheinander erscheinen. Der einfachste Weg ist `::: steps` um eine Liste: Jeder Punkt wird ein Schritt. Mit `{steps}` an der Überschrift wird die erste Liste der Folie automatisch schrittweise.

Im Vortrag geht → einen Schritt weiter, im Lesemodus siehst du den Endzustand. Klick auf die Karte öffnet die Präsentation an dieser Stelle.
:::

## Code und Diagramme {id=code-schritte}

```ts {steps="1|2|3"}
const tree = parse(markdown)
const plan = planFor(tree)
present(tree, plan)
```

::: notes
Codezeilen erscheinen mit `steps="1|2|3"` abschnittsweise: Der erste Abschnitt gilt ab Schritt 1, der zweite ab Schritt 2 und so weiter. Zeilen ohne Schritt bilden das Gerüst. Mit `lines="2-3|5"` werden stattdessen Zeilen **hervorgehoben**, der Rest wird abgedunkelt.

Mermaid-Diagramme wachsen mit einer Zeile `%% step`: Jeder Abschnitt ist eine kumulative Version des Diagramms. Gleiche Schrittnummer heißt immer „gleichzeitig“, auch über Listen, Code und Diagramme hinweg.
:::
