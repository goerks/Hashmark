# Architektur {layout=two-col}

::: col
Der Kern ist ein framework-unabhängiger **Deck-Baum** als JSON.

- Parser: remark + Direktiven
- Plugins: Shiki, Mermaid
- Runtime: Svelte 5, Vite
:::

::: col
```mermaid
flowchart TB
  src[Markdown-Dateien] --> parser[Parser]
  parser --> tree[(Deck-Baum)]
  tree --> rt[Runtime]
  rt --> out[Präsentation]
```
:::

## Parser {layout=section}

Aus 1..n Dateien entsteht ein Baum. Diese Folie hat Kinder aus einer eigenen Datei.

## Runtime

![Schichten](bilder/schichten.svg)

## Gesamtbild {layout=default}

::: columns cols="1:1"
::: col
::: steps
- **Quellen:** Markdown, `deck.yaml`, Bilder
- **Kern:** Parser → Baum → Renderer
- **Server:** Vite-Plugin, JSON, Hot Reload
- **Client:** Svelte-App, Navigator, Themes
- **Ausgabe:** Vollbild, Presenter, PDF
:::
:::

::: col
![Architektur von Strata](bilder/strata-architektur.drawio.svg){steps=layers}
:::
:::

::: notes
Jeder Punkt links deckt die passende Ebene im draw.io-Diagramm rechts auf. Gleiche Schrittnummer = gleichzeitig.
:::

## Datenmodell {layout=default}

```ts {title="core/types.ts" lines="2-4|all"}
interface DeckNode {
  id: string            // Slug-Pfad, z. B. "architektur/parser"
  title: string
  depth: number
  attrs: Record<string, string>
  slides: Slide[]       // Sub-Slides (durch ---)
  children: DeckNode[]
}
```
