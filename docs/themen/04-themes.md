# Themes und Firmen-Look {id=themes}

```yaml
theme:
  extends: minimal
  tokens:
    color-accent: "#e30613"
    font-heading: "Georgia, serif"
  layouts: ./theme/layouts
  css: ./theme/brand.css
```

::: notes
Ein **Theme** bestimmt das Aussehen: Farben, Schriften, Abstände und auf Wunsch eigene Layouts. Eingebaut sind `minimal` (hell) und `dark-tech` (dunkel, wie dieses Handbuch). Diagramme (Mermaid), Code-Hervorhebung und Hinweiskästen übernehmen die Farben von selbst.

`theme:` in der `deck.yaml` darf ein Name sein (`theme: dark-tech`), ein Pfad zu einer CSS-Datei oder einem Theme-Ordner, oder ein Block wie oben. Das Beispiel-Deck „Eigenes Theme“ zeigt einen vollständigen Firmen-Look.
:::

## Tokens {id=tokens}

| Token | Wofür |
| --- | --- |
| `color-bg`, `color-fg` | Hintergrund und Text |
| `color-accent` | Akzent: Marker, Linien, Hervorhebung |
| `color-heading`, `color-muted` | Überschriften, Nebentext |
| `color-surface`, `color-border` | Flächen von Karten und Kästen |
| `font-heading`, `font-body`, `font-code` | Schriften |
| `radius` | Rundung der Ecken |

::: notes
Tokens sind die Stellschrauben eines Themes. Unter `tokens:` überschreibst du einzelne davon, ohne CSS zu schreiben; der Name ist der Token ohne die zwei Striche (`color-accent` statt `--color-accent`). Tokens gewinnen immer, auch gegen Zusatz-CSS. Weitere Tokens: `color-success`, `color-warning`, `color-important` und `color-danger` für Hinweiskästen und Diagrammklassen, `space-1` bis `space-4` für Abstände und die `shiki-*`-Farben für Code.

Schriften kommen aus dem System, damit alles offline bleibt. Eine eigene Schrift legst du als Datei in den Theme-Ordner und bindest sie per `@font-face` im Zusatz-CSS ein.
:::

## Eigene Layouts {id=eigene-layouts}

```css
.layout-kpi .content ul {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
```

::: notes
Ein eigenes Layout ist eine CSS-Datei im Ordner unter `layouts:`. Der Selektor `.layout-<name>` zählt, auf der Folie setzt du dann `{layout=kpi}`. Mit `var(--color-accent)` und den anderen Tokens passt sich das Layout jedem Theme an. Unter `css:` legst du weitere Regeln ab, etwa Logo und Fußzeile; eine Datei oder eine Liste.

Ein Theme-Ordner (`theme.css`, `layouts/`, Bilder, Schriften) lässt sich in mehreren Decks wiederverwenden: `extends: ../acme`.
:::

## Komponenten {id=komponenten}

```html
<aside class="fact">
  <div class="fact-title">{{ title }}</div>
  <div class="fact-text">{{{ body }}}</div>
</aside>
```

::: notes
Eine Komponente ist ein eigener Container aus einer HTML-Vorlage. Die Datei `components/fact.html` im Deck- oder Theme-Ordner macht aus `::: fact title="…"` einen Baustein, `fact.css` daneben gestaltet ihn. `{{ title }}` setzt ein Attribut ein, `{{{ body }}}` den Inhalt als Markdown. Die Vorlage ist bewusst **logikfrei** (Platzhalter und Schleifen, keine Ausdrücke), das hält Decks sicher und vorhersehbar. Der Editor schlägt eigene Komponenten nach `::: ` vor.

Eingebaut sind `timeline` (Zeitstrahl), `process` (Prozess), `kpis` (Kennzahlen), `person` (Profilkarte), `roadmap`, `pyramid`, `matrix`, `versus` (vorher und nachher) und `aside` (Randspalte für `two-col-wide`). Das Beispiel-Deck „Komponenten“ zeigt sie alle.
:::
