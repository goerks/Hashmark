# Plugin-System und Markmap {layout=title}

Abnahme zu Ticket #56: Erweiterungen melden sich über eine Schnittstelle an, Markmap ist das erste neue Plugin.

::: notes
Prüfen: Diese Folie lädt, die Vorschau zeigt die Abnahme-Präsentation. Weiter mit Pfeil rechts.
:::

# Eine Mindmap aus einer Gliederung

```markmap {height=420}
# Hashmark
- **Kern**
  - Parser
  - Plan
  - Plugins
- Runtime
  - Presenter
  - Editor
- Export
  - PDF
  - PPTX
```

::: notes
Prüfen: Die Karte zeigt neun Knoten in verschiedenen Farben je Ast, die Schrift ist gut lesbar, nichts ragt über den Rand. Die Texte stammen aus dem Markdown direkt darüber im Quelltext (Taste E im Editor oder `?reader`).
:::

# Mehrere oberste Einträge {layout=default}

```markmap {title="Vortrag in drei Teilen" height=400}
- Warum
  - Problem
  - Ziel
- Wie
  - Baum
  - Plan
- Was jetzt
  - Demo
  - Fragen
```

::: notes
Prüfen: Die Mitte heißt „Vortrag in drei Teilen“ (aus `title=`). Ohne `title` stünde dort „Übersicht“.
:::

# Zugeklappt ab Ebene 2 {layout=default}

```markmap {fold=2 height=400}
# Produkt
- Planung
  - Ziele
  - Termine
- Umsetzung
  - Entwurf
  - Bau
- Abnahme
  - Test
  - Freigabe
```

::: notes
Prüfen: Es sind nur die drei Äste Planung, Umsetzung und Abnahme zu sehen, ihre Unterpunkte sind zugeklappt (`fold=2`).
:::

# Mindmap im Lesemodus und im Druck

Öffne `/?reader` zum Nachlesen: Dort steht die Mindmap auch als Liste im Text. Im Druck (Strg+P) erscheint sie als Bild.

::: notes
Prüfen: Im Lesemodus (`/?reader`) ist die Karte sichtbar. In der Druckvorschau (Strg+P) steht sie auf der Seite und ist nicht abgeschnitten.
:::

# Nicht geprüft {layout=default}

- PowerPoint-Export der Mindmap (nur automatisch getestet, nicht in PowerPoint geöffnet)
- Plugins aus dem Deck-Ordner und die Vertrauensabfrage (folgt in Stufe 2)
- Linux und macOS

::: notes
Hier stehen die Punkte, die ich nicht selbst prüfen konnte.
:::
