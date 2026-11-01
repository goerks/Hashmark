# Kapitelnummern {layout=title}

Ticket #51 · im Text dieser Datei steht keine einzige Nummer

::: notes
Prüfen: Alle Nummern in dieser Präsentation (Titel der Folien, Inhaltsverzeichnis, Baum links in der Übersicht) kommen von Hashmark. Öffne zum Gegenprüfen die Quelle im Editor: In den Überschriften steht keine Zahl.
:::

# Inhalt {layout=agenda levels=1-2}

::: notes
Prüfen: Das Verzeichnis zeigt alle Kapitel der Ebene 1 und 2 mit Nummer, eingerückt. „Nur für Eingeweihte“ fehlt (toc=off), „Zwischenfolie“ hat keine Nummer (number=off), der Anhang steht ohne Nummer da, und Titelfolie und Inhalt zählen nicht mit.
:::

# So zählt Hashmark

## Aus dem Baum

Die Nummer entsteht aus der Reihenfolge der Überschriften.

- Ebene 1: `1`, `2`, `3`
- Ebene 2: `1.1`, `1.2`

::: notes
Prüfen: Dieses Kapitel hat eine 1, diese Folie die 1.1. Die Nummer steht links vor dem Titel und in der Brotkrumenleiste oben.
:::

## Ohne Lücken

Das nächste Kapitel rückt nach, wenn eines herausgenommen wird.

::: notes
Prüfen: Die nächste Folie („Zwischenfolie“) hat keine Nummer. Die Folie danach heißt trotzdem 1.3, nicht 1.4.
:::

## Zwischenfolie {number=off}

Diese Folie ist mit `{number=off}` von der Nummerierung ausgenommen.

::: notes
Prüfen: Keine Nummer im Titel, im Verzeichnis keine Zahl vor „Zwischenfolie“. Sie bleibt im Verzeichnis sichtbar.
:::

## Wieder dabei

Die Zählung geht ohne Lücke weiter.

::: notes
Prüfen: Diese Folie trägt die Nummer 1.3.
:::

# Ebenen und Ausnahmen

## Von und bis

```yaml
numbering: { from: 1, to: 2 }
```

Die Deck-Datei legt fest, von welcher bis zu welcher Ebene gezählt wird. Ebene 3 bleibt hier ohne Nummer.

::: notes
Prüfen: Öffne die Übersicht (Taste O). Die Folie „Dritte Ebene“ unter dieser hat keine Nummer. Wer die Zählung bis Ebene 3 will, schreibt `to: 3`. Ab Ebene 2 (`from: 2`) zählt die zweite Ebene durchlaufend durchs ganze Deck, dazu gibt es ein Beispiel im Handbuch.
:::

### Dritte Ebene

Keine Nummer, weil `to: 2` gilt.

::: notes
Prüfen: Keine Nummer im Titel.
:::

## Nur im Verzeichnis ausblenden

`{toc=off}` lässt ein Kapitel im Verzeichnis weg, es behält seine Nummer.

::: notes
Prüfen: Das nächste Kapitel hat die Nummer 3, im Verzeichnis auf Folie 2 steht es nicht.
:::

# Nur für Eingeweihte {toc=off}

## Versteckt im Verzeichnis

Dieses Kapitel hat die Nummer 3, steht aber nicht im Inhaltsverzeichnis.

::: notes
Prüfen: Titel mit Nummer 3.1. Im Verzeichnis fehlt das ganze Kapitel samt Unterkapiteln.
:::

# Anhang {appendix}

## Quellen

Der Anhang bekommt keine Nummer.

::: notes
Prüfen: Keine Nummer im Titel. Im Verzeichnis steht „Anhang“ ohne Zahl. Mit `appendix: true` in `numbering:` würde er mitgezählt.
:::

# Nicht geprüft {layout=statement}

::: notes
Nicht geprüft: Die automatischen Tests (Vitest, `make test`) und der Svelte-Bau liefen in der Entwicklungsumgebung nicht, die Zählung und das Verzeichnis wurden nur mit einem Node-Skript geprüft. Nicht angesehen: PowerPoint-Export mit Nummern im Titel, PDF-Lesezeichen, Lesemodus (`?reader`), Presenter-Fenster, Editor-Gliederung mit blassen Nummern, Auto-Animate zwischen nummerierten Titeln, ein Verzeichnis mit sehr vielen Einträgen. `from: 2`, `appendix: true` und `titles: false` sind im Handbuch (Gestaltung, Kapitelnummern) beschrieben und per Test abgedeckt, aber hier nicht vorgeführt.
:::
