# Gestaltung {id=gestaltung}

::: cards cols=2
::: card icon=target title="Themes"
`minimal`, `dark-tech` oder eigene aus Tokens und CSS
:::
::: card icon=user title="Komponenten"
Eigene Container aus HTML-Vorlagen
:::
::: card icon=check title="Karten" step=1
Kacheln mit Icon und Titel
:::
::: card icon=star title="Figuren" step=2
Bilder mit Sprechblasen und Rahmen
:::
:::

::: notes
Aussehen und Struktur sind getrennt. Ein **Theme** liefert nur Design-Tokens (Farben, Schriften, Abstände) und optional eigenes CSS; die Folien, Diagramme (Mermaid) und der Code (Shiki) übernehmen sie. Eingebaut sind `minimal` und `dark-tech`.

Für Gestaltungselemente gibt es Container: `::: cards` baut Kacheln mit Icon, `::: figure` setzt Sprechblasen (`bubble`), Rahmen (`frame`) und Marker (`pin`) auf ein Bild, `::: table` formatiert Tabellen mit Schritten. Alles lässt sich schrittweise einblenden. Diese Karten erscheinen im Vortrag nacheinander und werden in PowerPoint zu Animationen.
:::

## Themes {id=themes}

```yaml
theme:
  extends: dark-tech
  tokens:
    accent: "#ff6b00"
  css: logo.css
```

::: notes
`theme:` darf ein Name, ein Pfad oder ein Objekt sein. `extends` wählt die Basis, `tokens` überschreibt einzelne Design-Tokens, `layouts` und `css` laden zusätzliche CSS-Dateien, etwa für ein Firmenlogo und die Fußzeile. Relative `url()` werden eingebettet, damit der Export weiter als einzelne Datei funktioniert.

Ein Theme-Ordner (`theme.css` und `layouts/`) lässt sich wiederverwenden. Das Beispiel `examples/theme-demo` zeigt ein Firmen-Theme samt eigener Layouts.
:::

## Komponenten {id=komponenten}

```html
<div class="fact">
  <strong>{{ title }}</strong>
  {{{ body }}}
</div>
```

::: notes
Eine Datei `components/fact.html` macht aus `::: fact title="…"` einen eigenen Baustein. Die Vorlage ist bewusst **logikfrei** (Platzhalter und Schleifen über Kinder, keine Ausdrücke): Das hält Decks lesbar und portabel. Eingebaut sind `timeline`, `process`, `kpis` und `person`.
:::

# Formeln und Diagramme {id=formeln}

$$
E = mc^2 \htmlData{step=1}{{}\quad\text{und}\quad} \htmlData{step=2}{e^{i\pi} + 1 = 0}
$$

::: notes
Formeln schreibst du in LaTeX: `$a^2$` im Satz, `$$ … $$` als eigener Block. Gesetzt werden sie mit KaTeX schon beim Laden des Decks, die Schriften liegen im Programm. Teile einer Formel erscheinen schrittweise mit `\htmlData{step=2}{…}`, wie hier.

Diagramme schreibst du als Mermaid-Code. Die Farben kommen aus dem Theme, mit `look=hand` im Skizzenstil. Fehler in Formeln oder Diagrammen meldet `make check` mit Dateiname und Zeile.
:::
