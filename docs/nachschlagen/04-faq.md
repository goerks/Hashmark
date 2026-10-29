# Häufige Fragen {id=faq}

::: notes
Kurze Antworten auf Fragen, die beim Einstieg oft kommen. Jede Frage ist ein eigener Abschnitt, damit du sie in der Suche (Strg+K) findest.
:::

## Brauche ich Internet? {id=faq-offline}

Nein. Hashmark läuft **vollständig offline**.

::: notes
Es gibt keine CDNs und keine Web-Fonts; Mermaid, KaTeX und die Code-Hervorhebung sind eingebaut, Schriften kommen aus dem System. Internet braucht nur, wer Hashmark aus dem Quelltext baut (`make setup` lädt Node.js einmalig). Deine Dateien bleiben bei dir.
:::

## Kann eine KI mir eine Präsentation schreiben? {id=faq-ki}

Ja: Gib ihr die Datei **`hashmark-fuer-ki.md`** mit.

::: notes
Die Datei beschreibt knapp und vollständig, wie ein Deck aufgebaut ist: Ordner, `deck.yaml`, Überschriften als Baum, Attribute, Layouts, Container, Schritte, Medien und Notizen, dazu eine Checkliste und ein Beispiel. Du findest sie im Projekt unter https://github.com/goerks/Hashmark/blob/main/hashmark-fuer-ki.md (Rohfassung: https://raw.githubusercontent.com/goerks/Hashmark/main/hashmark-fuer-ki.md). Gib sie der KI zusammen mit deinem Thema, und prüfe das Ergebnis mit „Prüfen“ (`make check`).
:::

## Kann ich PowerPoint-Dateien importieren? {id=faq-import}

Nein, nur **exportieren**.

::: notes
Hashmark schreibt PowerPoint-Dateien (Text bleibt bearbeitbar, Schritte werden Animationen), liest sie aber nicht. Inhalte aus bestehenden Folien übernimmst du als Text und Bilder von Hand.
:::

## Wie teile ich eine Präsentation? {id=faq-teilen}

Als **PDF**, als **einzelne HTML-Datei** oder als **statische Seite**.

::: notes
Die HTML-Datei (`make export`, in der App Datei › Als HTML-Datei) läuft per Doppelklick ohne Server, samt Presenter-View. Eine statische Seite (`make build`) lässt sich auf jedem Hoster ablegen, zum Beispiel GitHub Pages. Mit dem Webdienst (Docker) kann ein Team dauerhaft an einem Deck arbeiten. Beachte: Export und Build enthalten den ganzen Inhalt samt Sprechernotizen im Klartext.
:::

## Wie halte ich einen Vortrag per Videokonferenz? {id=faq-remote}

Nur das **Präsentationsfenster** teilen, die Presenter-View bleibt privat.

::: notes
In Teams oder Zoom gibst du das Fenster der Präsentation frei, nicht den ganzen Bildschirm. Die Presenter-View (Taste S) mit Notizen und Timer bleibt in einem eigenen Fenster auf deinem Bildschirm. Dass das Publikum der Position live im eigenen Browser folgt, ist noch nicht umgesetzt.
:::

## Können mehrere Personen zusammenarbeiten? {id=faq-team}

Ja, über **Git**: Die Quelle ist reiner Text.

::: notes
Ein Deck besteht aus Markdown-Dateien. Diff, Review und Versionsverwaltung funktionieren wie bei Code; eine Präsentation kann mehrere Dateien haben, etwa eine je Kapitel. Der Webdienst erlaubt zudem das gemeinsame Bearbeiten an einem Ort.
:::

## Was darf ich mit Hashmark tun? {id=faq-lizenz}

Frei nutzen, ändern und weitergeben, **nicht kommerziell**.

::: notes
Hashmark steht unter der PolyForm Noncommercial License 1.0.0. Für kommerzielle Nutzung fragst du vorher an. Der Volltext liegt als Datei `LICENSE` im Repository.
:::

## Die App stürzt ab oder zeigt einen Fehler {id=faq-fehler}

Bitte `crash.log` bzw. `hashmark.log` mitschicken.

::: notes
Die Desktop-App protokolliert in `%APPDATA%\app.hashmark.desktop`. Menü Hilfe › „Protokoll öffnen“ zeigt `hashmark.log`. Stürzt die App ab, zeigt sie beim nächsten Start eine Meldung mit der Fehlerzeile und dem Pfad der Absturzdatei (`crash-<Zeit>.log`). Hänge diese Datei an, wenn du ein Problem auf GitHub meldest.
:::
