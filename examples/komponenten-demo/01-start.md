# Eigene Komponenten {layout=title}

Eigene Container aus HTML-Vorlagen, ohne die Folien-Quelle zu verlassen.

# So funktioniert es

Eine Datei `components/timeline.html` macht aus `::: timeline` einen Zeitstrahl. Die Folie bleibt reines Markdown:

```md
::: timeline title="Roadmap" steps
- **Q1** Plugin-API
- **Q2** Theme v2
- **Q3** Animationen
:::
```

## Zeitstrahl

::: timeline title="Roadmap 2027" steps
- **Q1** Plugin-API
- **Q2** Theme v2
- **Q3** Animationen
- **Q4** Outliner
:::

## Zeitstrahl senkrecht

::: timeline vertical
- **Idee** Vorlage in `components/` anlegen
- **Nutzen** Container im Markdown schreiben
- **Fertig** Hot Reload zeigt das Ergebnis
:::

## Profilkarte

::: person name="Anna Beispiel" role="Product Owner" photo=anna.svg
Verantwortet das Backlog und die **Priorisierung**.
:::

::: notes
Die Karte nutzt den Rumpf als Beschreibung. Das Bild kommt per `photo=anna.svg`: Pfade in Attributen löst `{{ photo|image }}` wie normale Bilder auf.
:::
