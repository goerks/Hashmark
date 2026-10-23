# Abnahme: Bild-Zoom {layout=title}

Ticket #6 · diese Präsentation zeigt die Neuerung selbst

::: notes
Das ist die Abnahme-Präsentation für Ticket #6 (Bild-Zoom). Alle Folien sind die echte Funktion, nichts ist nachgebaut. Am Ende steht, was ich nicht prüfen konnte.
:::

# So läuft die Abnahme {steps}

- **→** geht weiter, **←** zurück, **F5** Vollbild
- **Z** fährt die Kamera auf ein Bild, **Z**, **Esc** oder ein Klick fährt zurück
- Ein **Klick auf das Bild** wirkt wie Z
- **S** öffnet die Presenter-View: Dort funktioniert Z ebenfalls
- Am Ende: was **nicht** geprüft werden konnte

::: notes
Keine Installation nötig: Die Präsentation läuft im Browser. Für die Presenter-View brauchst du ein zweites Fenster (Taste S).
:::

# Status der Dienste {id=zoom-bild layout=image-right}

![Statusseite mit Fehlermeldung](bilder/status.svg)

- Die Fehlermeldung ist im Bild klein
- **Z** drücken: Die Kamera fährt hinein
- Noch einmal **Z**: zurück

::: notes
**Prüfen:** Drücke Z. Die Kamera fährt in die Folie hinein, das Bild füllt die Bühne, Titel und Text wandern mit aus dem Bild. Z, Esc oder ein Klick fährt zurück. Während die Kamera fährt, bleiben die Bedienelemente stehen. Mit → gehst du weiter, der Zoom ist dann zurückgesetzt.
:::

# Bild mit Schritten {id=zoom-schritte}

::: steps
- Erster Schritt: nur der Text
- Zweiter Schritt: das Bild erscheint
:::

![Dasselbe Bild, erst im zweiten Schritt sichtbar](bilder/status.svg){step=2 width=55%}

::: notes
**Prüfen:** Im ersten Schritt gibt es nichts zu vergrößern, Z tut nichts. Nach dem zweiten Schritt (→) ist das Bild da, und Z fährt hinein.
:::

# Dieses Bild nicht {id=zoom-aus}

![Ausgenommen: kein Zoom](bilder/status.svg){zoom=off width=55%}

::: notes
**Prüfen:** In dieser Präsentation gilt `zoom: true` in der `deck.yaml` für alle Bilder. Dieses Bild ist mit `{zoom=off}` ausgenommen: Z und Klick tun hier nichts.
:::

# Presenter-View {id=presenter}

- **S** öffnet das zweite Fenster
- Dort steht **„Bild: normal · Z vergrößern“**
- **Z** im Presenter fährt im Präsentationsfenster hinein

::: notes
**Prüfen:** Gehe zur Folie „Status der Dienste“, öffne die Presenter-View mit S und drücke dort Z. Das Präsentationsfenster fährt aufs Bild, der Presenter zeigt „Bild: vergrößert · Z zurück“.
:::

# Schreibweise {id=schreibweise}

```md
![Status](bilder/status.svg){zoom}
![Ohne](bilder/logo.svg){zoom=off}
```

```yaml
# deck.yaml: alle Bilder vergrößerbar
zoom: true
```

::: notes
`{zoom}` macht ein Bild vergrößerbar, `zoom: true` in der `deck.yaml` alle Bilder, `{zoom=off}` nimmt eines aus. Das Handbuch beschreibt alles unter „Gestaltung › Bild vergrößern“.
:::

# Nicht geprüft {id=offen}

::: cards cols=2
::: card icon=target title="Stufe 2"
Weiter hineinfahren (+ / −), verschieben, Mausrad, Touchpad, Minikarte und der Zoom für Code und Diagramme sind noch nicht gebaut.
:::
::: card icon=user title="Desktop-App"
Presenter-Fenster der App und Vollbild auf dem Beamer.
:::
::: card icon=check title="Export"
PDF und PowerPoint zeigen das Bild unverändert, der Zoom ist nur in der Präsentation.
:::
::: card icon=star title="Weitere Geräte"
Touch-Bedienung, Linux und macOS.
:::
:::

::: notes
Die Pipeline hat Z, Klick, Esc, Zurücksetzen beim Blättern und die Presenter-Kopplung in einem echten Chrome geprüft. Das sind die Punkte, die ich nicht prüfen konnte.
:::
