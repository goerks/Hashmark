# Hashmark {layout=title id=start}

Mächtige Präsentationen aus reinem Markdown.

::: notes
Hashmark macht aus einer oder mehreren Markdown-Dateien eine Präsentation. Es gibt keine Folienliste, sondern einen **Baum**: Jede Überschrift ist ein Knoten. Auf dem Hauptpfad erzählst du weiter, bei Fragen tauchst du ins Detail und kommst von dort zurück.

Diese Seite ist selbst ein Hashmark-Deck. Du liest sie gerade im **Lesemodus**: links der Baum als Inhaltsverzeichnis, daneben Text und Folien. Mit „Präsentieren“ oben oder einem Klick auf eine Folie läuft dasselbe als Vortrag.
:::

# Die Idee {id=idee}

::: steps
- Folien sind linear, Fragen aus dem Publikum nicht
- Details liegen in Backup-Folien am Ende – oder fehlen ganz
- Die Überschriften-Hierarchie **ist** die Struktur
:::

::: notes
Eine Präsentation ist selten linear. Fragen kommen, Zeit wird knapp, und manche Details sind mal gefragt und mal nicht. Klassische Folienwerkzeuge zwingen dazu, alles in eine Reihe zu legen und Details als Backup-Folien an das Ende zu hängen, wo man sie unter Zeitdruck sucht.

Hashmark dreht das um. Du schreibst deine Inhalte als Markdown mit Überschriften. Aus der Gliederung wird ein Baum, den du **vor und während** des Vortrags bedienst: Space läuft den Pfad, ↓ taucht ab, ↑ kommt zurück. Es gibt nur eine Quelle, die auch Text, Versionsverwaltung und Review bekommt wie Code.
:::

## Für wen {id=zielgruppe}

- Entwickler und Architekten, die Vorträge als Text pflegen
- Trainer und Dozenten mit Kursen in mehreren Längen
- Teams, die Präsentationen gemeinsam in Git schreiben

::: notes
Hashmark ist für alle, die ihre Präsentation lieber **schreiben** als zeichnen. Die Quelle ist reiner Text, damit funktionieren Diff, Review und Versionsverwaltung. Eine Präsentation darf mehrere Dateien haben, jede Datei ein Kapitel.

Alles läuft **offline**: keine CDNs, keine Web-Fonts, kein Konto. Die Desktop-App ist ein einzelnes Programm ohne Installer.
:::

# Der Baum {id=baum}

````mermaid
flowchart LR
  A[Idee]:::accent --> B[Architektur] --> C[Demo] --> D[Fazit]
  B -.-> B1[Parser]
  B -.-> B2[Runtime]
  C -.-> C1[Optional]
````

- **→** erzählt auf dem Hauptpfad weiter
- **↓** taucht ins Detail, **↑** kommt zurück

::: notes
Jede Überschrift ist ein Knoten. Die oberste Ebene (`#`) ist der **Hauptpfad**, alles darunter sind **Details**. Mit → gehst du auf der aktuellen Ebene weiter, mit ↓ in den Unterbaum und mit ↑ wieder hinaus, an die Stelle, von der du abgetaucht bist.

Das Diagramm oben ist ein Mermaid-Diagramm, das mit dem Deck gerendert wird. Durchgezogene Pfeile sind der Hauptpfad, gestrichelte sind Details.

Zusätzlich gibt es Space: Es läuft **dem Vortragsplan nach**, also über alle Pfad-Knoten, und überspringt Optionales. Damit bedienst du einen Vortrag mit einer einzigen Taste und nimmst die Abstecher nur, wenn du sie willst.
:::

## Hauptpfad und Details {id=hauptpfad}

```md
# Architektur
## Parser
## Runtime
```

::: notes
Details sind normale Überschriften einer tieferen Ebene. Der Parser legt die oberste Ebene jeder Datei auf Tiefe 1; mit `maxDepth` in der `deck.yaml` bestimmst du, wie tief Überschriften noch Knoten sind (Standard 3). Tiefere Überschriften werden Abschnitte innerhalb der Folie.

Mehrere Dateien lassen sich mit `mount` in der `deck.yaml` zusammenstellen, auch unter einen bestehenden Knoten (`under: "Architektur > Parser"`).
:::

## Ausflug und Rückkehr {id=ausflug optional}

::: steps
- ↓ startet einen **Ausflug** in Optionales
- Space geht die Details der Reihe nach durch
- Am Ende führt Space zur Abzweigung **zurück**
:::

::: notes
Knoten mit dem Flag `{optional}` sind für „bei Zeit oder Fragen“ gedacht. Space überspringt sie. Wer ↓ drückt, beginnt einen **Ausflug**: Space läuft die optionalen Details ab und führt am Ende von selbst zur Abzweigung zurück, damit du den Faden nicht verlierst. Esc bricht den Ausflug ab.

Dieser Abschnitt ist selbst optional: Im Vortrag mit Space wird er übersprungen, im Lesemodus siehst du ihn mit dem Kennzeichen „Optional“.
:::

# Schnellstart {id=schnellstart}

```sh
make setup                     # einmalig: Pakete aus dem Projekt-Cache
make dev                       # Beispiel-Deck auf http://localhost:3030
make new DECK=decks/vortrag    # eigenes Deck anlegen
make edit DECK=decks/vortrag   # Editor mit Live-Vorschau
```

::: notes
Hashmark bringt alles mit, auch Node.js. `make setup` installiert die Pakete aus dem Cache im Projekt, es ist kein Internet nötig. `make dev` startet den Entwicklungsserver mit Hot Reload: Du speicherst die Markdown-Datei, die Folie bleibt stehen und der Inhalt aktualisiert sich.

Wer keine Konsole mag: Die **Desktop-App** (`make app`) öffnet Decks per Dialog, hat Editor, Präsentation und Presenter-View und läuft ohne Installer. Siehe Kapitel „App und Webdienst“.
:::
