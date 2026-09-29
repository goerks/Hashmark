# Präsentieren {layout=section duration=4m}

Presenter-View, Notizen, Suche – und neue Layouts für Kernaussagen, Bilder und Hinweise.

::: notes
Hier **S** drücken: Die Presenter-View öffnet sich im zweiten Fenster.
:::

## Presenter-View {layout=two-col}

::: col
::: steps
- **S** öffnet das zweite Fenster
- Aktuelle und nächste Folie, Uhr und Timer
- Notizen – pro Folie und pro Schritt
- Baum: wohin man abtauchen kann
:::
:::

::: col
> [!TIP]
> Nur ein Bildschirm? **N** blendet die Notizen unten ein – ideal zum Üben.

> [!NOTE] Suche
> **Ctrl+K** oder **/** findet jede Folie über Titel und Inhalt.
:::

::: notes
Allgemeine Notiz zu dieser Folie – immer sichtbar.
:::

::: notes step=2
Timer startet mit der ersten Bewegung. Mit `duration` im deck.yaml zeigt er, ob ich im Plan bin.
:::

::: notes step=4
Im Baum links sind die Äste mit ↓ und Anzahl markiert.
:::

## Notizen schreiben

```md {lines="1-3|5-7|9-10"}
::: notes
Gilt für die ganze Folie.
:::

::: notes step=2
Wird hervorgehoben, sobald Schritt 2 läuft.
:::

<!-- notes -->
Alles ab hier ist ebenfalls Notiz.
```

::: notes
Die Zeilen-Hervorhebung dieses Codeblocks ist selbst eine neue Funktion: `lines="1-3|5-7|9-10"`.
:::

## Einfach gesagt {layout=statement bg="linear-gradient(135deg, #0e7490 0%, #1e1b4b 100%)"}

Eine Aussage pro Folie. Groß, mittig, ohne Ablenkung.

## Zitat {layout=quote}

> Die Überschriften-Hierarchie *ist* die Struktur.

— Konzept Strata, 2026

## Bild rechts {layout=image-right}

![Schichten](bilder/schichten.svg)

- Das **erste Bild** wandert in die Bildspalte
- Der Rest steht daneben
- `image-left` spiegelt das Layout

## Hinweiskästen

::: columns cols=3
::: col
> [!NOTE]
> Zum Wissen.

> [!TIP]
> Macht es leichter.
:::
::: col
> [!IMPORTANT]
> Nicht überlesen.

> [!WARNING]
> Kann schiefgehen.
:::
::: col
> [!CAUTION]
> Hat Folgen.

`> [!NOTE]` – wie auf GitHub
:::
:::

## Layouts je Ebene

```yaml {title="deck.yaml"}
layouts:          # Default-Layout je Ebene
  1: section
  2: default
duration: 20m     # Zeitplan für die Presenter-View
```

| Attribut | Wirkung |
| --- | --- |
| `{layout=agenda}` | Kapitel des Hauptpfads, aktuelles markiert |
| `{bg=bild.jpg bgdim=0.5}` | Hintergrund, optional abgedunkelt |
| `{duration=5m}` | Zeitbudget des Kapitels |
| `::: columns cols="2:1"` | feste Spalten bzw. Verhältnis |
