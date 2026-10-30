# Effekte für Schritte {layout=title}

Teil 2: Wie erscheinen die Schritte auf einer Folie?

::: notes
Prüfen: Auf jeder der folgenden Folien mit → Schritt für Schritt vorgehen und auf den Auftritt achten. Einstellung: `effect=` an der Folie, an einem Container oder im Deck (`motion: effect:`). Ohne Angabe bleibt es beim Einblenden (`fade`) wie bisher.
:::

# Hochschweben {steps effect=up id=effekt-up}

- Erst das Problem
- Dann die Idee
- Zuletzt das Ergebnis

::: notes
Prüfen: Mit → schwebt jeder Punkt leicht von unten an seinen Platz und wird dabei sichtbar. Mit ← geht er ohne Weg wieder weg. Einstellung: `## Hochschweben {steps effect=up}`.
:::

# Von links {steps effect=left id=effekt-left}

- Erst das Problem
- Dann die Idee
- Zuletzt das Ergebnis

::: notes
Prüfen: Jeder Punkt gleitet von links an seinen Platz. Der Weg muss sichtbar sein, nicht nur ein Einblenden am Rand. Einstellung: `{steps effect=left}`.
:::

# Aufwachsen {steps effect=scale id=effekt-scale}

- Erst das Problem
- Dann die Idee
- Zuletzt das Ergebnis

::: notes
Prüfen: Jeder Punkt wächst aus der linken Ecke auf seine volle Größe. Einstellung: `{steps effect=scale}`.
:::

# Hervorheben {steps effect=highlight id=effekt-highlight}

- Erst das Problem
- Dann die Idee
- Zuletzt das Ergebnis

::: notes
Prüfen: Der neue Punkt leuchtet, solange er der aktuelle Schritt ist. Beim nächsten Schritt geht das Leuchten auf den nächsten Punkt über. Einstellung: `{steps effect=highlight}`.
:::

# Abdunkeln {steps effect=dim id=effekt-dim}

- Erst das Problem
- Dann die Idee
- Zuletzt das Ergebnis

::: notes
Prüfen: Alles Frühere wird leiser, nur der aktuelle Punkt strahlt voll. Der Blick bleibt am neuen Punkt. Einstellung: `{steps effect=dim}`.
:::

# Gestaffelte Karten {id=effekt-stagger}

::: cards cols=3 stagger effect=up
::: card step=1 title="Kunden"
12
:::
::: card step=1 title="Quote"
94 %
:::
::: card step=1 title="Antwort"
3,2 s
:::
:::

::: cards cols=3 effect=up
::: card step=2 title="Ohne"
Alle zugleich
:::
::: card step=2 title="Staffelung"
Alle zugleich
:::
::: card step=2 title="Vergleich"
Alle zugleich
:::
:::

::: notes
Prüfen: Mit → erscheint die obere Reihe als kleine Welle von links nach rechts (80 ms Abstand). Mit dem nächsten → kommt die untere Reihe, bei der alle drei zugleich erscheinen. Einstellung: `::: cards stagger effect=up` mit `step=1` an jeder Karte.
:::

# Mit Verzögerung {id=effekt-delay}

Erst der Satz.

::: reveal step=1 effect=up delay=800ms
> [!TIP]
> Und fast eine Sekunde später dieser Hinweis, obwohl es derselbe Schritt ist.
:::

::: notes
Prüfen: Mit → erscheint der Hinweis erst nach etwa 0,8 Sekunden. Einstellung: `::: reveal step=1 effect=up delay=800ms`.
:::

# Container schlägt Folie {steps effect=up id=effekt-vorrang}

::: steps effect=scale
- Dieser Punkt wächst auf (Container)
- Dieser auch
:::

::: notes
Prüfen: Die Folie sagt `effect=up`, der Container `effect=scale`. Die Punkte müssen aufwachsen, nicht hochschweben: Das Nächstliegende gilt.
:::

# Nicht geprüft {id=nicht-geprueft}

- Wirkung im PowerPoint-Export und im PDF: bleibt unverändert (Einblenden bzw. Endzustand) und wurde nicht neu geprüft
- Eigene Themes, die später `--motion-duration` setzen
- Touch-Wischgesten am Tablet
- Effekte in Code-Zeilen, Tabellenzeilen und Diagrammen: nur Listen, Karten und Blöcke sind vorgeführt

::: notes
Hier steht, was Claude nicht selbst im Browser ausprobieren konnte.
:::
