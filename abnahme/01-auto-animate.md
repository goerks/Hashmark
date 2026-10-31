# Hashmark {layout=title}

![Logo](logo.svg){morph=logo width=200}

Elemente wandern von Folie zu Folie

::: notes
Prüfen: Mit → gehst du durch die Folien. Auf dieser Folie steht ein großes Logo (`{morph=logo}`) und der Titel in der Mitte. Auf der nächsten Folie wandern beide an ihren neuen Platz. Den Titel brauchst du dafür nicht zu benennen, er wandert von selbst, auch wenn der Text ein anderer ist.
:::

# Architektur {id=kennzahlen}

![Logo](logo.svg){morph=logo width=70}

::: cards cols=3
::: card morph=kunden title="Kunden"
12
:::
::: card morph=quote title="Quote"
94 %
:::
::: card morph=antwort title="Antwort"
3,2 s
:::
:::

::: notes
Prüfen: Beim Wechsel hierher fliegt das Logo klein an seinen neuen Platz und der Titel „Hashmark“ wird zu „Architektur“ in der oberen Ecke. Auf der nächsten Folie ordnen sich die drei Karten neu an. Einstellung: `{morph=logo}` am Bild und `morph=kunden` an der Karte. Den Titel braucht man nicht zu benennen.
:::

# Architektur {id=schwerpunkt}

![Logo](logo.svg){morph=logo width=70}

::: cards cols="2:1"
::: card morph=quote title="Quote"
94 %
:::
::: card morph=kunden title="Kunden"
12
:::
::: card morph=antwort title="Antwort"
3,2 s
:::
:::

::: notes
Prüfen: Mit → wandern die Karten von ihrer alten Stelle an die neue, in neuer Größe. Der Titel bleibt stehen, denn er ist an derselben Stelle (dann gilt der normale Übergang für den Rest). Mit ↓ gelangst du in das Detail zur Karte „Quote“.
:::

## Quote im Detail {id=detail}

::: card morph=quote title="Quote"
94 %
:::

::: notes
Prüfen: Auf dem Weg aus der Kapitelfolie in ihr Detail wird die Karte „Quote“ zur großen Karte. Gleicher Name, `morph=quote`. Mit ↑ geht es zurück, die Karte schrumpft an ihren Platz.
:::

# Code, Schritt 1 {id=code-1}

```ts {morph=code}
function bauen(deck) {
  const baum = lesen(deck)
  return rendern(baum)
}
```

::: notes
Prüfen: Auf der nächsten Folie steht derselbe Code mit einer zusätzlichen Zeile. Einstellung: derselbe Name `{morph=code}` an beiden Code-Blöcken.
:::

# Code, Schritt 2 {id=code-2}

```ts {morph=code}
function bauen(deck) {
  const baum = lesen(deck)
  const plan = planen(baum)
  return rendern(baum, plan)
}
```

::: notes
Prüfen: Beim Wechsel von Schritt 1 rutschen die gleichen Zeilen (`function bauen`, `const baum`) an ihren Platz, die neue Zeile `const plan = …` blendet ein. Die geänderte Zeile `return rendern(baum, plan)` zählt als neu. Mit ← geht es in die andere Richtung.
:::

# Titel bleibt {morph=off id=aus}

Der Titel wandert hier nicht von selbst.

::: notes
Prüfen: Beim Wechsel auf diese Folie bleibt es beim normalen Übergang, der Titel wandert nicht: `{morph=off}` an der Folie. Ohne diese Angabe würde er von seiner alten Stelle hierher fliegen.
:::

# Ohne Bewegung {id=nichts}

Hier steht alles an derselben Stelle wie davor.

::: notes
Prüfen: Beim Wechsel von „Titel bleibt“ hierher ändert sich nichts an der Lage. Dann gilt der normale Übergang, es wandert nichts.
:::

# Nicht geprüft {id=nicht-geprueft}

- Wandern bei „Bewegung reduzieren“: nur Überblenden, bitte im System einschalten und neu laden
- PowerPoint-Export (überblendet) und PDF (unverändert)
- Folien mit `{fit}` oder sehr langen Inhalten: die Lage wird vor dem Einpassen gemessen
- Mermaid-Diagramme wandern nicht

::: notes
Hier steht, was Claude nicht selbst im Browser ausprobieren konnte. Das Wandern selbst wurde nur über die automatischen Tests der Zuordnung geprüft, nicht angesehen.
:::
