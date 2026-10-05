# Formeln in Hashmark {layout=title}

Gesetzt mit KaTeX, ohne Browser-Skript: Die Folie enthält fertiges HTML, das auch offline, im PDF und in PowerPoint gut aussieht.

::: notes
Das Deck zeigt die Schreibweise und sinnvolle Beispiele. Alle Formeln stehen als normaler Text in der Markdown-Datei.
:::

# Schreibweise

::: columns cols=2
::: col
## Im Satz und als Block

Im Satz: der Satz des Pythagoras $a^2 + b^2 = c^2$ und die Eulersche Identität $e^{i\pi} + 1 = 0$.

Eigener Block:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$
:::
::: col
## Der Quelltext

```md
Im Satz: $a^2 + b^2 = c^2$

$$
\int_0^1 x^2\,dx = \tfrac{1}{3}
$$
```

Preise wie $5 oder 20 $ sind keine Formeln, `\$` setzt ein Dollarzeichen.
:::
:::

## Regeln

| Schreibweise | Bedeutung |
| --- | --- |
| `$a^2$` | im Satz; kein Leerzeichen innen, keine Ziffer direkt danach |
| `$$ … $$` | eigener Block, auch über mehrere Zeilen |
| ` ```math ` | Block mit `step=2` bzw. `until=3` |
| `\htmlData{step=2}{…}` | Teil einer Formel erscheint ab Schritt 2 |
| `\$` | ein einzelnes Dollarzeichen |

Fehler stehen als roter Quelltext auf der Folie und als Hinweis in `hashmark check`.

## Schritt für Schritt

Teile einer Formel erscheinen nacheinander, im Vortrag mit Pfeil rechts, in PowerPoint als Animation:

$$
f(x) = \htmlData{step=1}{x^2} \htmlData{step=2}{{}+ 3x} \htmlData{step=3}{{}- 5}
$$

::: steps
- Erst der quadratische Teil
- Dann der lineare Teil
- Zuletzt die Konstante
:::
