# Hashmark {layout=title}

![Logo](logo.svg){morph=logo class=logo-gross}

Mächtige Präsentationen aus reinem Markdown

::: notes
Prüfen: Das ist dasselbe Beispiel wie in der Vorschau. Mit → gehst du durch die Folien, mit ← zurück. Hier steht das große Logo oben und der Titel in der Mitte. Auf der nächsten Folie wandern beide: das Logo klein nach oben rechts, der Titel in die Ecke oben links, dabei wird er zu „Architektur“.
:::

# Architektur {id=kennzahlen}

![Logo](logo.svg){morph=logo class=logo-ecke}

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
Prüfen: Logo und Titel sind an ihren neuen Platz gewandert. Mit → ordnen sich die drei Karten neu an. Eingestellt ist das mit `{morph=logo}` am Bild und `morph=kunden`, `morph=quote`, `morph=antwort` an den Karten. Der Titel braucht keinen Namen.
:::

# Architektur {id=schwerpunkt}

![Logo](logo.svg){morph=logo class=logo-ecke}

::: columns class=raster
::: col
::: card morph=quote title="Quote"
94 %
:::
:::
::: col
::: card morph=kunden title="Kunden"
12
:::
::: card morph=antwort title="Antwort"
3,2 s
:::
:::
:::

*Drücke ↓: Die Karte „Quote“ wird zum Detail.*

::: notes
Prüfen: Die Karten sind an ihre neue Stelle gewandert: „Quote“ links groß, die anderen zwei untereinander rechts. Der Titel bleibt stehen. Jetzt das Eintauchen testen: ↓ führt in das Detail zur Karte „Quote“, ↑ wieder heraus. Direkt zum Detail geht die Adresse mit `#schwerpunkt/detail` am Ende, zum Nachlesen `/?reader`.
:::

## Quote im Detail {id=detail}

::: card morph=quote title="Quote" class=riesig
94 %
:::

::: notes
Prüfen: Die Karte „Quote“ ist auf dem Weg ins Detail zur großen Karte geworden (gleicher Name, `morph=quote`). Mit ↑ schrumpft sie zurück an ihren Platz auf der Folie „Schwerpunkt“. Mit → geht es von hier nicht weiter, das Detail gehört zu „Schwerpunkt“.
:::

# Code {id=code-1}

```ts {morph=code}
function bauen(deck) {
  const baum = lesen(deck)
  return rendern(baum)
}
```

::: notes
Prüfen: Auf der nächsten Folie steht derselbe Code mit einer neuen Zeile. Beide Blöcke tragen denselben Namen: `{morph=code}`.
:::

# Code {id=code-2}

```ts {morph=code}
function bauen(deck) {
  const baum = lesen(deck)
  const plan = planen(baum)
  return rendern(baum, plan)
}
```

::: notes
Prüfen: Die gleichen Zeilen (`function bauen`, `const baum`) rutschen an ihren neuen Platz, die neue Zeile `const plan = …` blendet ein. Die geänderte Zeile `return rendern(baum, plan)` zählt als neu. Mit ← geht es in die andere Richtung.
:::

# Nicht geprüft {id=nicht-geprueft}

- Bei „Bewegung reduzieren“ im System gibt es nur Überblenden
- PowerPoint (überblendet nur) und PDF (unverändert)
- Folien mit `{fit}`, ein Logo ohne Namen (wandert nicht) und Touch

::: notes
Hier steht, was Claude nicht selbst im Browser ausprobieren konnte. Das Wandern wurde nur über die automatischen Tests der Zuordnung geprüft, nicht angesehen.
:::
