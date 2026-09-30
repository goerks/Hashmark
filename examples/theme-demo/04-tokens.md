# Tokens {layout=section}

Tokens sind CSS-Variablen. Sie speisen Folien, Code (Shiki) und Mermaid.

## Die wichtigsten Tokens {layout=two-col}

::: col
- `color-bg`, `color-fg`, `color-heading`, `color-muted`
- `color-accent`: Akzentfarbe
- `color-surface`, `color-surface-2`, `color-border`
- `color-success`, `color-warning`, `color-important`, `color-danger`: Hinweiskästen
:::

::: col
- `font-heading`, `font-body`, `font-code`
- `radius`, `space-1` … `space-4`
- `shiki-*`: Farben im Code
:::

## Schreibweise

In der `deck.yaml` mit oder ohne `--`:

```yaml
tokens:
  color-accent: "#e30613"     # wird zu --color-accent
  --radius: 4px               # auch so
```

> [!WARNING] Werte in Anführungszeichen
> Farben mit `#` gehören in Anführungszeichen, sonst liest YAML sie als Kommentar. Werte mit `{`, `}` oder `;` werden abgelehnt.

## Bilder und Schriften im Theme

Relative `url(…)` in Theme-CSS werden beim Laden eingebettet (Bilder, `woff2`, `woff`, `ttf`, `otf`). Das Theme bleibt dadurch eine einzige Datei im Export.

```css {title="theme/brand.css"}
@font-face {
  font-family: "Acme Sans";
  src: url(fonts/acme-sans.woff2) format("woff2");
}
```

Anschließend `font-heading: "Acme Sans", sans-serif` als Token setzen.
