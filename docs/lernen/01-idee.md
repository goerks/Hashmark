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

## Der Baum {id=baum}

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

Zusätzlich gibt es Space: Es läuft **dem Vortragsplan nach**, also über alle Pfad-Knoten, und überspringt Optionales. Damit bedienst du einen Vortrag mit einer einzigen Taste und nimmst die Abstecher nur, wenn du sie willst. Wie du den Baum schreibst und bedienst, steht im Thema „Baum und Navigation“.
:::
