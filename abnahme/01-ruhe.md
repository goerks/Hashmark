# Konflikt im Editor {layout=title}

Abnahme zu Ticket #52: Der Editor überschreibt eine Datei nicht mehr, wenn sie inzwischen woanders geändert wurde.

::: notes
Prüfen: Das Neue steckt im Editor, nicht in der Präsentation. Diese Folien erklären, wie du den Konflikt selbst herstellst. Alle Änderungen im Editor der Vorschau gehen beim nächsten Start der Vorschau verloren, es ist ein Testdeck.
:::

# So stellst du einen Konflikt her {layout=default}

1. Öffne `/editor.html` in **zwei Browser-Fenstern nebeneinander** (A und B). Beide zeigen dieselbe Datei.
2. In **B**: Klicke in den Text und **halte eine Buchstabentaste gedrückt**, etwa 5 Sekunden lang. Die Anzeige oben bleibt auf „Ungespeichert“.
3. In **A**, während B noch tippt: tippe ans Ende ein Wort und warte, bis „Gespeichert“ steht.
4. In **B** erscheint oben ein gelber Hinweis: „… wurde inzwischen geändert“, die Anzeige steht auf „Konflikt“.

::: notes
Prüfen: Schritt 4 ist die Neuerung. Vorher hätte B beim nächsten Speichern die Änderung aus A stillschweigend überschrieben. Wenn bei dir kein Hinweis erscheint, halte die Taste in B länger gedrückt und tippe in A gleichzeitig.
:::

# Drei Wege aus dem Konflikt {layout=default}

- **Unterschiede zeigen:** Es erscheint eine Liste mit den Zeilen, die nur in der Datei stehen (− Datei) und nur bei dir (+ Du)
- **Meine Fassung behalten:** Dein Stand ersetzt die Datei, der Hinweis verschwindet, die Anzeige steht wieder auf „Gespeichert“
- **Datei neu laden:** Die Datei ersetzt deinen Stand, deine Änderung ist weg

::: notes
Prüfen: Probiere in B zuerst „Unterschiede zeigen“ und dann „Meine Fassung behalten“. Lade danach A neu (F5): Der Text von B steht in der Datei. Wiederhole den Konflikt und wähle „Datei neu laden“: Der Text von A bleibt, der von B ist weg.
:::

# Während des Konflikts {layout=statement}

Der Editor **speichert nichts**, bis du entschieden hast.

::: notes
Prüfen: Tippe in B weiter, solange der Hinweis offen ist. Die Anzeige bleibt auf „Konflikt“, und die Datei in A ändert sich nicht. Beim Schließen des Tabs warnt der Browser.
:::

# Nicht geprüft {layout=default}

- Konflikte im Desktop-Fenster der App (nur im Browser getestet)
- der Verlauf mit Wiederherstellen (kommt als eigenes Ticket)
- Linux und macOS

::: notes
Hier stehen die Punkte, die ich nicht selbst prüfen konnte.
:::
