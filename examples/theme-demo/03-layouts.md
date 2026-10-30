# Eigene Layouts {layout=section}

Ein Layout ist eine CSS-Datei. Der Dateiname ist egal, der Selektor `.layout-<name>` zählt.

## So entsteht ein Layout {fit}

1. Datei in den `layouts`-Ordner legen, z. B. `theme/layouts/kennzahl.css`
2. Darin Regeln für `.layout-kennzahl` schreiben
3. Auf der Folie `{layout=kennzahl}` an die Überschrift setzen

```css {title="theme/layouts/kennzahl.css" lines="1-4|5-9|all"}
.layout-kennzahl .content ul {
  list-style: none; margin: 0; padding: 0;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-3);
}
.layout-kennzahl .content li {
  padding: 28px 24px; background: var(--color-surface);
  border-top: 6px solid var(--color-accent);
}
```

> [!TIP] Tokens statt fester Werte
> Mit `var(--color-accent)` und Co. passt sich das Layout jedem Theme und jedem Token-Override an.

## Beispiel: Layout „kennzahl“ {layout=kennzahl}

- **42 %** weniger Zeit für Folienpflege
- **3 min** bis zur ersten Präsentation
- **0** externe Abhängigkeiten

## Beispiel: Layout „rahmen“ {layout=rahmen}

Gestalte Folien mit **einer** zentralen Aussage: Das Layout setzt sie in einen Kasten mit Akzentkante.

- Jede CSS-Datei im `layouts`-Ordner wird geladen
- Der Selektor `.layout-rahmen` greift für `{layout=rahmen}`

## Was im Layout steckt

Jede Folie ist `section.slide.layout-<name>` mit `header` (Titel) und `.content` (Inhalt). Das reicht für die meisten Layouts:

| Selektor | Bedeutung |
| --- | --- |
| `.layout-x` | die ganze Folie (Flex-Spalte, 1280 × 720) |
| `.layout-x .slide-title` | die Überschrift |
| `.layout-x .content` | der Inhalt unter dem Titel |
| `.slide[data-depth="2"]` | Folie nach Ebene |
