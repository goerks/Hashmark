# Tempo der Übergänge {layout=title}

Abnahme zu Ticket #25: Wie schnell wechseln die Folien, und wie erscheinen die Schritte?

::: notes
Prüfen: Diese Präsentation führt die Neuerung selbst vor. Mit → gehst du durch die Folien und siehst den Unterschied zwischen normal, schnell und langsam. Mit ↓ tauchst du in ein Detail. Das Standardtempo im ganzen Deck ist `normal` (`abnahme/deck.yaml`).
:::

# Normal (so wie bisher) {id=normal}

Diese Folie ist mit **380 ms** zu dir geschoben worden. Genau so schnell war es schon vorher.

::: notes
Prüfen: Es soll sich nichts anders anfühlen als vor der Änderung. Einstellung: keine, das ist der Standard.
:::

# Schnell {speed=fast id=schnell}

Diese Folie ist in **190 ms** gekommen. Gut für Zwischenfolien.

::: notes
Prüfen: Gehe von der vorigen Folie mit → hierher und zurück mit ←. Der Wechsel hierher soll deutlich flotter sein. Einstellung: `# Schnell {speed=fast}`.
:::

# Langsam {speed=slow id=langsam}

Diese Folie ist in **760 ms** gekommen. Gut für einen großen Auftritt.

::: notes
Prüfen: Gehe mit → hierher. Die Folie soll ruhig und spürbar langsamer einschieben. Einstellung: `# Langsam {speed=slow}`.
:::

## Detail, langsam hineingezoomt {speed=slow transition=zoom id=detail}

Mit ↓ kommt das Detail ruhig aus der Tiefe. Mit ↑ geht es wieder zurück.

::: notes
Prüfen: Auf der Folie „Langsam“ ↓ drücken. Das Detail fährt in etwa 0,8 Sekunden aus der Tiefe herein. Danach ↑: Der Rückweg zu „Langsam“ läuft im Tempo von „Langsam“.
:::

# Schritte im gleichen Tempo {speed=slow steps id=schritte}

- Erst das Problem
- Dann die Idee
- Zuletzt das Ergebnis

::: notes
Prüfen: Mit → die Punkte nacheinander einblenden. Bei `speed=slow` blenden sie sichtbar langsamer ein als auf einer normalen Folie.
:::

# Bewegung reduzieren {id=reduziert}

Hast du im System „Bewegung reduzieren“ eingeschaltet, überblendet Hashmark nur kurz (120 ms), ohne Schieben und Zoomen.

::: notes
Prüfen: In den Systemeinstellungen „Bewegung reduzieren“ (Windows: Animationseffekte aus; macOS: Bewegung reduzieren) einschalten, Seite neu laden und mit → und ↓ durch die Folien gehen. Es darf nur noch ein sanftes Ineinanderblenden zu sehen sein.
:::
