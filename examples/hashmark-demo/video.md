# Video

![Demo: Dev-Server und PDF](medien/demo.webm){width=70%}

::: notes
Das Video steht als Standbild auf der Folie. Der **nächste Schritt (→)** startet es, **K** hält es an und setzt es fort. Läuft es noch, springt → ans Ende, das nächste → geht weiter. In der Presenter-View steht, ob das Video läuft und wie weit es ist.
:::

## Ausschnitt und Schleife

![Nur der Mittelteil, in Schleife](medien/demo.webm){start=1.4 end=5 loop muted width=60%}

::: notes
`start=` und `end=` schneiden einen Ausschnitt (Sekunden, `0:05` oder `1:02:03`). Mit `loop` beginnt er von vorn, mit `muted` läuft er ohne Ton, `play=0` startet ihn sofort mit der Folie.
:::

## Mit Abspielleiste

![Mit Leiste des Browsers](medien/demo.webm){controls width=60%}

::: notes
Mit `controls` zeigt das Video die Leiste des Browsers und ist kein Schritt: Start und Pause per Mausklick.
:::
