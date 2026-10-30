# Konfiguration {layout=section}

Ein `theme:`-Block in der `deck.yaml` genügt. Alle Teile sind optional.

## Der theme-Block

```yaml {title="deck.yaml"}
theme:
  extends: minimal            # Basis
  tokens:                     # Design-Tokens überschreiben
    color-accent: "#e30613"
    radius: 4px
  layouts: ./theme/layouts    # Ordner mit Layout-CSS
  css: ./theme/brand.css      # Zusatz-CSS (Logo, Fußzeile)
```

Die Kurzform bleibt gültig: `theme: dark-tech` oder `theme: ./eigenes.css`.

## Die vier Schlüssel {layout=two-col}

::: col
::: steps
- **`extends`:** Basis. `minimal`, `dark-tech`, eine CSS-Datei oder ein Theme-Ordner
- **`tokens`:** überschreibt einzelne Design-Tokens
- **`layouts`:** Ordner mit `*.css`, je Datei ein eigenes Layout
- **`css`:** weitere CSS-Dateien (eine oder eine Liste)
:::
:::

::: col
> [!NOTE] Reihenfolge
> Zuerst die Basis, dann `layouts`, dann `css`, **zuletzt `tokens`**. Ein Token gewinnt also immer, auch gegen Zusatz-CSS mit `:root`.
:::

## Theme als Ordner

Wer ein Theme wiederverwenden will, legt es als Ordner ab und zeigt mit `extends` darauf:

```text
acme/
  theme.css          # Tokens und Basisstile (Pflicht)
  layouts/
    kennzahl.css          # → {layout=kennzahl}
  logo.svg           # in theme.css per url(logo.svg)
```

```yaml {title="deck.yaml"}
theme:
  extends: ../themes/acme   # Ordner statt Name
  tokens:
    color-accent: "#0a7d4f"  # pro Deck nachjustieren
```

## Änderungen live sehen

- `make dev DECK=examples/theme-demo` bzw. der Editor laden Theme-Dateien neu, sobald du speicherst
- Liegt das Theme **außerhalb** des Deck-Ordners, wird es trotzdem beobachtet
- Fehlende Dateien oder ungültige Tokens erscheinen als Hinweis im Terminal, die Präsentation läuft weiter
