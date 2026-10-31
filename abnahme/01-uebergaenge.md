# Übergangsfamilie {layout=title}

Abnahme zu Ticket #31: Wie wechseln die Folien?

::: notes
Prüfen: Diese Präsentation führt die Übergänge selbst vor. Mit → gehst du durch die Folien, mit ← zurück, mit ↓ in ein Detail (wo eines da ist) und mit ↑ wieder heraus. Die meisten Folien laufen mit `speed=slow`, damit man den Übergang gut sieht. Den Deck-Standard prüfst du am Ende selbst im Editor.
:::

# Tiefe bei ↓ und ↑ {id=tiefe}

Drücke ↓: Das Detail kommt von unten über dieses Kapitel.

::: notes
Prüfen: Mit ↓ tritt dieses Kapitel leicht zurück und dunkelt ab, das Detail schiebt sich von unten darüber. Mit ↑ geht das Detail nach unten weg, und das Kapitel kommt nach vorn. Einstellung: keine, das ist der neue Standard bei ↓ und ↑ (`transition=depth`). Der frühere Zoom bleibt mit `transition=zoom`.
:::

## Das Detail {id=tiefe-detail}

Hier bist du eine Ebene tiefer. Mit ↑ geht es zurück.

::: notes
Prüfen: Mit ↑ kehrt sich der Übergang um.
:::

# push {transition=push speed=slow id=push}

Die neue Folie schiebt die alte weg, in Richtung der Taste.

::: notes
Prüfen: Mit → und ← seitlich, mit ↓ (auf der nächsten Ebene) und ↑ senkrecht. Einstellung: `# push {transition=push}`.
:::

## push, senkrecht {transition=push speed=slow id=push-detail}

Mit ↓ geschoben, mit ↑ zurück.

# blur {transition=blur speed=slow id=blur}

Weiches Verschwimmen von einer Folie in die nächste.

::: notes
Prüfen: Die alte Folie wird unscharf und blendet in die neue über. Ruhig, gut für einen Themenwechsel.
:::

# cover {transition=cover speed=slow id=cover}

Die neue Folie legt sich über die alte.

::: notes
Prüfen: Die alte Folie bleibt fast stehen und dunkelt ab, die neue schiebt sich mit Schatten darüber.
:::

# reveal {transition=reveal speed=slow id=reveal}

Die alte Folie zieht weg, die neue liegt schon darunter.

::: notes
Prüfen: Die alte Folie fährt in Richtung der Taste hinaus, darunter wird die neue größer und heller.
:::

# iris {transition=iris speed=slow id=iris}

Ein Kreis öffnet sich von der Seite der Taste.

::: notes
Prüfen: Bei → öffnet sich der Kreis von der rechten Seite, bei ← von links. Die alte Folie tritt dabei leicht zurück.
:::

# curtain {transition=curtain speed=slow id=curtain}

Die alte Folie öffnet sich von der Mitte.

::: notes
Prüfen: In der Mitte der alten Folie öffnet sich ein Spalt, der breiter wird, bis die neue Folie ganz da ist. Bei ↓ und ↑ öffnet sich der Spalt waagerecht. Anders als in der Vorschau fahren nicht zwei Hälften mit dem Inhalt weg, der Inhalt bleibt stehen und wird von der Mitte aus weggeschnitten.
:::

# diagonal {transition=diagonal speed=slow id=diagonal}

Die neue Folie baut sich als Welle aus Kacheln auf.

::: notes
Prüfen: Von einer Ecke aus wachsen die Kacheln der neuen Folie als Welle zur gegenüberliegenden Ecke. Die Ecke hängt von der Taste ab. Die Kacheln sind undurchsichtig, der alte Text darf nicht durchscheinen.
:::

# mosaic {transition=mosaic speed=slow id=mosaic}

Kacheln setzen die neue Folie in zufälliger Reihenfolge zusammen.

::: notes
Prüfen: Wie `diagonal`, aber in zufälliger Reihenfolge. Die Reihenfolge ist immer gleich.
:::

# blinds {transition=blinds speed=slow id=blinds}

Streifen öffnen sich nacheinander.

::: notes
Prüfen: Bei → und ← öffnen sich senkrechte Streifen, bei ↓ und ↑ waagerechte. Jeder Streifen öffnet sich von seiner Mitte.
:::

## blinds, waagerecht {transition=blinds speed=slow id=blinds-detail}

Mit ↓ öffnen sich waagerechte Streifen.

# zoom (der frühere Standard) {transition=zoom speed=slow id=zoom}

Wer den Zoom aus der Tiefe mag, schreibt `transition=zoom`.

::: notes
Prüfen: Mit ↓ auf der nächsten Ebene fährt das Detail aus der Tiefe, wie bisher.
:::

## zoom, Detail {transition=zoom speed=slow id=zoom-detail}

Mit ↑ fliegt es nach vorn weg.

# Schnell und reduziert {transition=iris speed=fast id=schnell}

Dieselbe Iris, aber mit `speed=fast`.

::: notes
Prüfen: Diese Folie öffnet sich in einem Viertel der Zeit. Schalte im System „Bewegung reduzieren“ ein und lade neu: Dann gibt es bei allen Übergängen nur ein kurzes Überblenden.
:::

# Deck-Standard und Nicht geprüft {id=nicht-geprueft}

- Deck-Standard `motion: { transition: push }`: im Editor (`/editor.html`) in die `deck.yaml` schreiben und neu laden, dann schieben alle Folien ohne eigene Angabe
- PowerPoint-Export: jeder Übergang wird durch einen ähnlichen von PowerPoint ersetzt, nicht neu geprüft
- Touch-Wischgesten am Tablet

::: notes
Hier steht, was Claude nicht selbst im Browser ausprobieren konnte. Die Übergänge selbst wurden nur über die automatischen Tests geprüft, nicht angesehen.
:::
