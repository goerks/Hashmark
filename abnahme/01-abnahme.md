# Abnahme: Komponenten im Editor {layout=title}

Eigene Komponenten bearbeiten und neu anlegen, ohne den Editor zu verlassen. Ticket #17.

::: notes
Diese Präsentation führt die Neuerung selbst vor. Öffne den **Editor** (Adresse der Vorschau, dahinter `/editor.html`) und gehe die Folien der Reihe nach durch. Der Editor zeigt links die Dateien, in der Mitte den Text und rechts diese Präsentation.

Prüfen: Der Editor öffnet ohne Passwort, links stehen die Dateien dieser Präsentation.
:::

## Komponenten in der Dateiliste

::: fact title="Gut zu wissen"
Dieser Rahmen ist eine eigene Komponente. Sie liegt in `components/fact.html`.
:::

::: notes
Prüfen: Im Editor steht links unter „Dateien“ ein eigener Bereich **Komponenten** mit `components/fact.html` und `components/fact.css`. Ein Klick öffnet die Vorlage. Die Gestaltung (`fact.css`) gibt dem Rahmen Farbe und Rand.
:::

## Vorlage ändern, Vorschau folgt

Ändere in `components/fact.css` die Breite des Rands von `6px` auf `14px`. Nach dem Speichern wird der Rahmen auf der Folie davor dicker.

::: notes
Prüfen: Speichern geht mit Strg+S, spätestens nach einer halben Sekunde automatisch. Danach lädt die Vorschau neu. Zur Folie „Komponenten in der Dateiliste“ blättern und den Rand ansehen.
:::

## Platzhalter mit Vorschlägen

In `components/fact.html` hinter `{{` Strg+Leertaste drücken. Es erscheinen `title`, `body` und die anderen Platzhalter.

::: notes
Prüfen: In der Vorlage zwei geschweifte Klammern tippen. Es öffnet sich eine Liste mit `title` (aus dem Kopf der Vorlage), `body`, `items`, `children` und den Blöcken `#if`, `#each`. Tab übernimmt einen Eintrag. Platzhalter sind farbig hinterlegt.
:::

## Fehler sofort sehen

Lösche in `components/fact.html` eine der schließenden Klammern `}}`, zum Beispiel bei `{{ title }}`. Unten erscheint der Hinweis mit der Zeile.

::: notes
Prüfen: Eine Klammer entfernen oder `{{#if title}}` einfügen, ohne `{{/if}}` zu schreiben. Nach kurzer Zeit erscheint eine rote Markierung im Text und unten „⚠ 1 Hinweis“ mit der Zeilennummer, zum Beispiel „Zeile 4: {{#if}} wird nicht geschlossen“. Rückgängig mit Strg+Z, der Hinweis verschwindet.
:::

## Neue Komponente anlegen

1. Links neben „Komponenten“ auf **+ Komponente** klicken.
2. Name `merksatz`, Beschreibung und Attribute eintragen.
3. **Anlegen**: Der Editor öffnet die neue Vorlage.

::: notes
Prüfen: Der Dialog meldet sofort, wenn der Name nicht passt (Großbuchstaben, eingebaute Namen wie `cards`). Nach „Anlegen“ stehen `components/merksatz.html` und `.css` in der Liste, die Vorlage ist geöffnet und enthält einen Kopf mit Beispiel. Legt man denselben Namen noch einmal an, kommt die Meldung „gibt es schon“. Auch möglich: Strg+K und „Neue Komponente“.
:::

## Beispiel in der Vorschau ansehen

Mit der geöffneten Vorlage unten auf **Beispiel in Folie ansehen** klicken. Das Beispiel aus dem Kopf erscheint als neue Folie am Ende, rechts in der Vorschau.

::: notes
Prüfen: Der Knopf steht unten im Editor, solange eine Vorlage offen ist. Er hängt `## Beispiel merksatz` mit dem Beispiel aus dem Kopf an die zuletzt geöffnete Folien-Datei an. Rechts springt die Vorschau auf diese Folie. Wer das nicht behalten will, löscht den Abschnitt wieder.
:::

## Nicht geprüft

- Bedienung am Handy und am Touchscreen
- Desktop-App (Windows) und Webdienst auf Render mit Festplatte
- Handbuch-Seite zum Editor (folgt, wenn die Bedienung steht)

::: notes
Die Oberfläche konnte in der Entwicklungsumgebung nicht im Browser ausprobiert werden, weil dort kein Zugriff auf die Paketquelle besteht. Geprüft sind der Kern und die Datei-Schnittstelle durch Tests, die Oberfläche durch den Bau der Pipeline. Bitte achte besonders auf Aussehen und Bedienung.
:::
