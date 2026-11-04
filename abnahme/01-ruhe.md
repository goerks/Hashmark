# Notizen beim Weitergeben {layout=title}

Abnahme zu Ticket #54: Der Export warnt vor Notizen, und der öffentliche Webdienst zeigt sie nicht mehr in der einfachen Ansicht.

::: notes
Prüfen: Diese Folie hat eine Notiz, so wie jede Folie dieser Präsentation. Wenn du sie siehst, bist du im Lesemodus, in der Presenter-View oder im Editor. In der einfachen Ansicht (Adresse ohne Zusatz, Taste N) steht keine Notiz zur Verfügung. Das ist die Neuerung.
:::

# Was ist neu? {layout=default}

- **Export warnt:** `hashmark export` und `hashmark build` nennen, wie viele Folien Notizen haben
- **Schalter `--no-notes`:** Notizen weglassen, zum Weitergeben
- **Desktop-App:** Menü Datei › „Als HTML-Datei ohne Notizen exportieren …“
- **Webdienst:** die einfache Ansicht der Präsentation liefert keine Notizen

::: notes
Prüfen: Die Warnung lautet zum Beispiel „Achtung: 14 Folien haben Notizen, sie stehen lesbar in der Ausgabe (Quelltext und Presenter-View). Zum Weitergeben ohne Notizen: hashmark export --no-notes“. Das lässt sich hier im Webdienst nicht ausprobieren, nur im Terminal oder in der Desktop-App.
:::

# So prüfst du es hier {layout=default}

1. Öffne diese Präsentation **ohne Zusatz** und drücke die Taste **N**: Es erscheinen keine Notizen.
2. Öffne `/?reader`: Die Notizen stehen als Text unter den Folien.
3. Öffne `/?presenter`: Die Presenter-View zeigt die Notiz der aktuellen Folie.

::: notes
Prüfen: Genau diese drei Schritte. Zu Schritt 1: Vor der Änderung hat N hier die Notizen gezeigt. Zu den Schritten 2 und 3: Dort müssen die Notizen weiter da sein, denn Lesemodus und Presenter brauchen sie.
:::

# Wichtig: kein Schutz {layout=statement}

Der Webdienst hat **keine Anmeldung**. Wer die Adresse kennt, kann den Presenter oder den Editor öffnen und sieht die Notizen.

::: notes
Prüfen: Das ist ehrlich gemeint. Die Änderung hält die Notizen aus der einfachen Ansicht, sie schützt sie nicht. Vertrauliche Notizen gehören nicht in einen öffentlichen Webdienst. Das steht auch im Handbuch (Thema Export).
:::

# Nicht geprüft {layout=default}

- das Menü „Als HTML-Datei ohne Notizen exportieren …“ in der Desktop-App (nur kompiliert, kein Fenster)
- `--no-notes` im Terminal von Hand (nur automatisch getestet)
- Linux und macOS

::: notes
Hier stehen die Punkte, die ich nicht selbst prüfen konnte.
:::
