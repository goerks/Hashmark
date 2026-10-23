# Abnahme: Video in Folien {layout=title}

Ticket #4 · diese Präsentation zeigt die Neuerung selbst

::: notes
Das ist die Abnahme-Präsentation für Ticket #4. Sie läuft in der Vorschau, die zu diesem Pull Request gehört. Alles, was du hier siehst, ist die echte Funktion: Videos, K, die Presenter-View. Am Ende steht, was ich nicht prüfen konnte.
:::

# So läuft die Abnahme {steps}

- **→** geht weiter, **←** zurück, **F5** Vollbild
- Das Video startet mit dem **nächsten Schritt**
- **K** hält es an und setzt es fort
- **S** öffnet die Presenter-View mit Zustand des Videos
- Am Ende: was **nicht** geprüft werden konnte

::: notes
Keine Installation nötig: Die Präsentation läuft im Browser. Für den Presenter brauchst du ein zweites Fenster (Taste S).
:::

# Video starten {id=video-starten}

![Demo: Dev-Server und PDF](medien/demo.webm){width=70%}

::: notes
**Prüfen:** Die Folie zeigt zuerst ein Standbild. Drücke **→**: Das Video startet. Drücke **K**: Es hält an. Noch einmal **K**: Es läuft weiter. Läuft es noch, springt **→** ans Ende, das letzte Bild bleibt. Das nächste **→** geht zur nächsten Folie.
:::

---

![Nur ein Ausschnitt, in Schleife](medien/demo.webm){start=1.4 end=5 loop muted width=60%}

::: notes
**Prüfen:** Dieser Ausschnitt beginnt bei 1,4 s und endet bei 5 s, dann beginnt er von vorn, ohne Ton. Geschrieben als `{start=1.4 end=5 loop muted}`.
:::

---

![Mit Abspielleiste des Browsers](medien/demo.webm){controls width=60%}

::: notes
**Prüfen:** Mit `controls` zeigt das Video die Leiste des Browsers. Es ist kein Schritt, Start und Pause laufen per Mausklick.
:::

# Presenter-View {id=presenter}

- **S** öffnet das zweite Fenster
- Dort steht **„Video: ▶ läuft 0:12 / 0:45“**
- **K** wirkt auch im Presenter-Fenster

::: notes
**Prüfen:** Gehe zur Folie „Video starten“, öffne die Presenter-View mit S und drücke dort → und K. Das Video im Präsentationsfenster folgt. Im Browser startet ein Video mit Ton erst, nachdem du im Präsentationsfenster einmal geklickt hast.
:::

# Schreibweise {id=schreibweise}

```md
![Demo](medien/demo.webm){play=1 start=5s end=50s loop muted}
![Mit Leiste](medien/demo.webm){controls}
```

::: notes
`play=2` startet erst mit Schritt 2, `play=0` sofort mit der Folie. `start` und `end` in Sekunden oder mit Einheit (`5s`, `1m30s`), ein Doppelpunkt wie `0:05` geht in der Attributklammer nicht. Das Handbuch beschreibt alles unter „Gestaltung › Video“.
:::

# Nicht geprüft {id=offen}

::: cards cols=2
::: card icon=target title="MP4 (H.264)"
Hier läuft ein WebM. Bitte mit eigenem MP4 in der Desktop-App prüfen.
:::
::: card icon=user title="Desktop-App"
Autoplay-Einstellung, Presenter-Fenster, Hinweis beim HTML-Export.
:::
::: card icon=check title="Export"
PDF und PowerPoint zeigen das Standbild. Nicht durchgespielt.
:::
::: card icon=star title="Linux und macOS"
Nicht erprobt.
:::
:::

::: notes
Das sind die Punkte, die ich nicht selbst prüfen konnte. Die Pipeline hat Standbild, Start, K, Zurücksetzen, Überspringen, Ausschnitt, Schleife, Abspielleiste, Vorspulen und die Presenter-Kopplung in einem echten Chrome geprüft.
:::
