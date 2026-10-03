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

::: fact title="Eingebaut oder eigen"
`timeline`, `process`, `kpis` und `person` bringt Hashmark mit. Eigene Komponenten liegen im Deck-Ordner `components/` oder im Theme-Ordner und überschreiben die eingebauten.
:::

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

## Prozess

::: process steps
- **Planen** Ziele klären
- **Bauen** Umsetzen
- **Prüfen** Testen
- **Liefern** Ausrollen
:::

## Kennzahlen

::: kpis steps
::: kpi value="87 %" label="Zufriedenheit" trend=up delta="+4 %"
:::
::: kpi value="1,2 s" label="Antwortzeit" trend=down delta="-0,3 s"
Median der letzten 30 Tage
:::
::: kpi value="42" label="Teams"
:::
:::

## Profilkarte

::: person name="Anna Beispiel" role="Product Owner" photo=anna.svg
Verantwortet das Backlog und die **Priorisierung**.
:::

::: notes
Die Karte nutzt den Rumpf als Beschreibung. Das Bild kommt per `photo=anna.svg`: Pfade in Attributen löst `{{ photo|image }}` wie normale Bilder auf.
:::

## Eigene Komponente

::: fact title="Merksatz aus components/fact.html"
Diese Komponente gehört nur zu diesem Deck. Der Editor schlägt sie nach `::: ` vor und kennt ihre Attribute.
:::
