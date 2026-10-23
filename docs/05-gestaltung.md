# Gestaltung {id=gestaltung}

::: cards cols=2
::: card icon=target title="Themes"
`minimal`, `dark-tech` oder eigene aus Tokens und CSS
:::
::: card icon=user title="Komponenten"
Eigene Container aus HTML-Vorlagen
:::
::: card icon=check title="Karten" step=1
Kacheln mit Icon und Titel
:::
::: card icon=star title="Figuren" step=2
Bilder mit Sprechblasen und Rahmen
:::
:::

::: notes
Aussehen und Struktur sind getrennt. Ein **Theme** liefert nur Design-Tokens (Farben, Schriften, Abstände) und optional eigenes CSS; die Folien, Diagramme (Mermaid) und der Code (Shiki) übernehmen sie. Eingebaut sind `minimal` und `dark-tech`.

Für Gestaltungselemente gibt es Container: `::: cards` baut Kacheln mit Icon, `::: figure` setzt Sprechblasen (`bubble`), Rahmen (`frame`) und Marker (`pin`) auf ein Bild, `::: table` formatiert Tabellen mit Schritten. Alles lässt sich schrittweise einblenden. Diese Karten erscheinen im Vortrag nacheinander und werden in PowerPoint zu Animationen.
:::

## Themes {id=themes}

```yaml
theme:
  extends: dark-tech
  tokens:
    accent: "#ff6b00"
  css: logo.css
```

::: notes
`theme:` darf ein Name, ein Pfad oder ein Objekt sein. `extends` wählt die Basis, `tokens` überschreibt einzelne Design-Tokens, `layouts` und `css` laden zusätzliche CSS-Dateien, etwa für ein Firmenlogo und die Fußzeile. Relative `url()` werden eingebettet, damit der Export weiter als einzelne Datei funktioniert.

Ein Theme-Ordner (`theme.css` und `layouts/`) lässt sich wiederverwenden. Das Beispiel `examples/theme-demo` zeigt ein Firmen-Theme samt eigener Layouts.
:::

## Komponenten {id=komponenten}

```html
<div class="fact">
  <strong>{{ title }}</strong>
  {{{ body }}}
</div>
```

::: notes
Eine Datei `components/fact.html` macht aus `::: fact title="…"` einen eigenen Baustein. Die Vorlage ist bewusst **logikfrei** (Platzhalter und Schleifen über Kinder, keine Ausdrücke): Das hält Decks lesbar und portabel. Eingebaut sind `timeline`, `process`, `kpis` und `person`.
:::

## Video {id=video}

````md
![Demo](demo.mp4){play=1 start=5s end=50s}
````

::: notes
Ein Video schreibst du wie ein Bild. Die Dateiendung (`.mp4`, `.m4v`, `.webm`, `.ogv`) macht es zum Video. Es steht als **Standbild** auf der Folie, der nächste **Schritt (→)** startet es, **K** hält es an und setzt es fort. Läuft es noch, springt → ans Ende (das letzte Bild bleibt), das nächste → geht weiter. Die Presenter-View zeigt, ob das Video läuft, und gibt K aus dem zweiten Fenster weiter.

Attribute: `play=2` startet erst mit Schritt 2 (`play=0` sofort mit der Folie), `start=` und `end=` schneiden einen Ausschnitt (`12`, `12.5`, `5s`, `1m30s`; ein Doppelpunkt wie `0:05` geht in der Attributklammer nicht), `loop` wiederholt ihn, `muted` schaltet den Ton ab, `poster=bild.png` ersetzt das Standbild. Mit `controls` zeigt das Video die Leiste des Browsers und ist kein Schritt. `width`, `fit`, `pos`, `step` und `until` gelten wie bei Bildern.

Das Video liegt als Datei im Deck-Ordner. Als Format empfehlen wir MP4 (H.264/AAC), das spielen Edge, Chrome, Safari und die Desktop-App unter Windows. WebM ist nicht überall gleich gut unterstützt, vor allem in Safari. Unter Linux und macOS ist die Wiedergabe in der Desktop-App noch nicht erprobt, unter Linux braucht der Webbetrachter vermutlich Systempakete (GStreamer). Videos von Webseiten und Einbettungen gibt es bewusst nicht, Hashmark läuft offline. Für einen Link eignet sich der QR-Code-Block. PDF und PowerPoint zeigen das Standbild.

Im Browser startet ein Video mit Ton erst, nachdem im Präsentationsfenster einmal geklickt oder eine Taste gedrückt wurde. Bis dahin zeigt das Video seine Abspielleiste, ein Klick startet es. In der Desktop-App gilt die Einschränkung nicht.
:::

## Bild vergrößern {id=bild-zoom}

````md
![Status](status.png){zoom}
````

::: notes
Mit `{zoom}` hinter dem Bild lässt es sich in der Präsentation vergrößern: **Z** oder ein Klick auf das Bild fährt die Kamera in die Folie hinein, bis das Bild die Bühne füllt. Titel und Text wandern dabei mit aus dem Bild, so bleibt der Zusammenhang sichtbar. **Z**, **Esc** oder ein Klick fährt zurück, Weiterblättern setzt die Kamera ebenfalls zurück. Die Presenter-View zeigt, ob die Folie ein Bild zum Vergrößern hat, und gibt Z weiter.

In der `deck.yaml` macht `zoom: true` alle Bilder des Decks vergrößerbar, `{zoom=off}` nimmt ein einzelnes Bild aus. Hat die Folie mehrere vergrößerbare Bilder, fährt Z auf das erste sichtbare, ein Klick auf ein bestimmtes Bild auf dieses. Wer die Bewegung nicht mag, stellt im Betriebssystem „Animationen reduzieren“ ein: Dann springt die Kamera ohne Fahrt. PDF, PowerPoint und Handout zeigen das Bild unverändert.

Wer nur mit → durchsteppt (auch aus dem Presenter), muss nicht an Z denken: `{zoomstep=2}` lässt die Kamera bei Schritt 2 von selbst aufs Bild fahren, `{zoomstep=2 zoomuntil=3}` fährt bei Schritt 3 wieder heraus (ohne `zoomuntil` bleibt sie, bis die Folie wechselt). ← kehrt jeden Schritt um. Der Zoom zählt als Schritt der Folie und steht in der Schrittanzeige; Z, Klick und Esc gehen zusätzlich weiter.
:::

# Formeln und Diagramme {id=formeln}

$$
E = mc^2 \htmlData{step=1}{{}\quad\text{und}\quad} \htmlData{step=2}{e^{i\pi} + 1 = 0}
$$

::: notes
Formeln schreibst du in LaTeX: `$a^2$` im Satz, `$$ … $$` als eigener Block. Gesetzt werden sie mit KaTeX schon beim Laden des Decks, die Schriften liegen im Programm. Teile einer Formel erscheinen schrittweise mit `\htmlData{step=2}{…}`, wie hier.

Diagramme schreibst du als Mermaid-Code. Die Farben kommen aus dem Theme, mit `look=hand` im Skizzenstil. Fehler in Formeln oder Diagrammen meldet `make check` mit Dateiname und Zeile.
:::
