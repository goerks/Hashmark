# Mounts

`deck.yaml` hängt diese Datei unter **Architektur › Parser**. Die Überschriften werden automatisch verschoben: `#` wird hier zu Ebene 3.

```yaml
mount:
  - file: details/parser.md
    under: "Architektur > Parser"
```

# Direktiven

::: columns
::: col
### Attribute
`## Backend {layout=two-col id=backend}`
:::
::: col
### Container
`::: columns` / `::: col` / `::: notes` / `::: children`
:::
:::

#### Tiefer als maxDepth

Diese Überschrift liegt unterhalb von `maxDepth: 3` und ist deshalb ein Abschnitt innerhalb der Folie.

# Hot Reload

Speichern im Editor – die Folie bleibt stehen, der Inhalt aktualisiert sich.
