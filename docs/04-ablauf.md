# Vortragsplan {id=plan}

| Rolle | Wirkung |
| --- | --- |
| **Pfad** | Space und Clicker laufen hindurch |
| **Optional** | Space überspringt, ↓ startet einen Ausflug |
| **Anhang** | nur über Suche oder Übersicht erreichbar |

::: notes
Nicht jeder Vortrag zeigt alle Folien. Deshalb hat jeder Knoten eine **Rolle**: Pfad, Optional oder Anhang. Der Autor setzt den Standard mit Flags an der Überschrift (`{optional}`, `{appendix}`), ohne Flags ist alles Pfad. Die Rolle gilt für den ganzen Unterbaum.

Der **Vortragende** passt sie in der Presenter-View an (Taste S, dann P): Rolle je Knoten, Vorlagen wie „Bis Ebene 2“ und benannte **Fahrpläne** wie „Kurz“ und „Voll“, die neben dem Deck in `.hashmark/plan.json` liegen. Änderungen gelten sofort in der Präsentation.
:::

## Zeitbudget {id=zeitbudget}

```md
## Architektur {duration=5m}
```

::: notes
`duration=5m` plant Redezeit je Knoten (Blätter; sonst gilt eine Minute je Folie). Die Presenter-View zeigt, ob du im Plan liegst. Die Vorlage **Zeitbudget** wirft Knoten aus dem Pfad, bis die Schätzung in die gewünschten Minuten passt: erst die tiefsten und letzten. Was herausfällt, ist nicht weg, sondern optional und per ↓ erreichbar.

Für das Handout und das PDF gilt dieselbe Auswahl (`make pdf PLAN=path`).
:::

# Presenter-View {id=presenter}

- **S** öffnet sie in einem zweiten Fenster
- Notizen, Timer, Zeitplan und der Baum
- **P** bearbeitet den Vortragsplan

::: notes
Die Presenter-View läuft im zweiten Fenster auf deinem Bildschirm, die Präsentation auf dem Beamer. Beide sind gekoppelt. Du siehst die aktuelle Folie, die nächste, die Sprechernotizen (Schriftgröße einstellbar), Uhr, Timer, den Zeitplan und den Baum, an dem du siehst, wohin du abtauchen kannst.

Mit nur einem Bildschirm zeigt **N** die Notizen unten in der Präsentation. Auf zwei Bildschirmen blendet die App die Bedienhilfen in der Präsentation aus, solange die Presenter-View verbunden ist.
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
Notizen gehören zur Sub-Slide, in der sie stehen. Mit `step=2` gelten sie erst ab einem Schritt; die Presenter-View hebt dann die aktuelle hervor. Im Handout stehen sie neben der richtigen Folie, hier im Lesemodus sind sie der Fließtext.
:::
