# Vortrag und Presenter {id=vortrag}

- **S** öffnet die Presenter-View im zweiten Fenster
- Notizen, Timer, Zeitplan und der Baum
- **P** bearbeitet den Vortragsplan

::: notes
Im Vortrag siehst du mehr als dein Publikum. Die Presenter-View läuft auf deinem Bildschirm, die Präsentation auf dem Beamer, beide sind gekoppelt. Der Vortragsplan legt fest, was Space zeigt und was nur auf Nachfrage kommt; ein Zeitbudget kürzt den Plan, wenn die Zeit knapp ist.
:::

## Presenter-View {id=presenter}

- aktuelle und nächste Folie, mit Schritt
- Notizen in großer Schrift, **A−** und **A+**
- Uhr, Timer und „voraus“ oder „zurück“ gegen den Plan

::: notes
Die Presenter-View zeigt die aktuelle Folie, die nächste (oder den nächsten Schritt), die Sprechernotizen (Schriftgröße einstellbar), Uhr, Timer, den Zeitplan und den Baum, an dem du siehst, wohin du abtauchen kannst. Ein Klick in den Baum springt dorthin. In der Desktop-App erscheint sie mit F5 auf dem zweiten Bildschirm von selbst, im Browser öffnet **S** sie in einem eigenen Fenster.

Mit nur einem Bildschirm zeigt **N** die Notizen unten in der Präsentation, zum Üben. Auf zwei Bildschirmen blendet die Präsentation ihre Bedienhilfen aus, solange die Presenter-View verbunden ist. Clicker und Fernbedienungen funktionieren: Bild ab und Bild auf verhalten sich wie Space. **B** oder **.** schaltet den Beamer schwarz.
:::

## Notizen {id=notizen}

```md
::: notes
Das sage ich zur Folie.
:::

::: notes step=2
Das sage ich ab Schritt 2.
:::
```

::: notes
Notizen gehören zur Sub-Slide, in der sie stehen. Mit `step=2` gelten sie erst ab einem Schritt; die Presenter-View hebt dann die aktuelle hervor. Im Handout stehen sie neben der richtigen Folie, im Lesemodus sind sie der Fließtext, so wie in diesem Handbuch.
:::

## Vortragsplan {id=plan}

| Rolle | Wirkung |
| --- | --- |
| **Pfad** | Space und Clicker laufen hindurch |
| **Optional** | Space überspringt, ↓ startet einen Ausflug |
| **Anhang** | nur über Suche oder Übersicht erreichbar |

::: notes
Nicht jeder Vortrag zeigt alle Folien. Deshalb hat jeder Knoten eine **Rolle**: Pfad, Optional oder Anhang. Als Autor setzt du den Standard mit Flags an der Überschrift (`{optional}`, `{appendix}` oder `{plan=…}`), ohne Flags ist alles Pfad. Die Rolle gilt für den ganzen Unterbaum.

Im Vortrag passt du sie in der Presenter-View an (Taste S, dann P): Rolle je Knoten, Vorlagen wie „Bis Ebene 2“ und die Zeitsumme. Änderungen gelten sofort in der Präsentation. **T** schaltet den Plan aus, dann läuft Space durch alles.
:::

## Zeitbudget {id=zeitbudget}

```md
## Architektur {duration=5m}
```

::: notes
`duration=5m` plant Redezeit je Knoten; ohne Angabe zählt eine Minute je Folie. An einem Kapitel gilt die Dauer für das ganze Kapitel samt Details. `duration: 25m` in der `deck.yaml` ist die geplante Gesamtdauer: Die Presenter-View zeigt, ob du im Plan liegst.

Die Vorlage **Zeitbudget** im Plan wirft Knoten aus dem Pfad, bis die Schätzung in die gewünschten Minuten passt: erst die tiefsten und letzten. Was herausfällt, ist nicht weg, sondern optional und per ↓ erreichbar.
:::

## Fahrpläne {id=fahrplaene}

- Ein Deck, mehrere Fassungen: **Kurz**, **Voll**, **Workshop**
- gespeichert neben dem Deck in `.hashmark/plan.json`
- gilt auch für PDF und Handout

::: notes
Ein **Fahrplan** ist ein benannter Vortragsplan. Lege in der Presenter-View (P) zum Beispiel „Kurz“ mit 20 Minuten und „Voll“ mit 60 an und wechsle vor dem Vortrag. Die Fahrpläne liegen als Datei neben dem Deck und lassen sich mit dem Deck weitergeben. Wo das Deck keine Datei schreiben darf (statische Seite, Webdienst ohne Anmeldung), merkt sich der Browser den Plan.

Das PDF und das Handout richten sich mit der Auswahl „Vortragsplan“ nach dem aktiven Plan (`make pdf PLAN=path`).
:::

## Per Videokonferenz {id=remote}

Nur das **Präsentationsfenster** teilen, die Presenter-View bleibt privat.

::: notes
In Teams oder Zoom gibst du das Fenster der Präsentation frei, nicht den ganzen Bildschirm. Die Presenter-View mit Notizen und Timer bleibt in einem eigenen Fenster auf deinem Bildschirm.
:::
