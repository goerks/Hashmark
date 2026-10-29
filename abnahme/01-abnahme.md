# Funktionen in Komponenten {layout=title}

Abnahme Ticket #20 · eigene Bausteine, die rechnen und formatieren

::: notes
Prüfen: Die Präsentation selbst benutzt die neuen Funktionen. Jede Folie zeigt eine Funktion mit der echten Komponente. Navigation: → weiter, ↓ ins Detail, `?reader` zum Nachlesen.
:::

# Balken, die selbst rechnen

::: bars title="Umsatz nach Region" scale=100 unit=" Mio." updated="2026-10-29" steps total
::: bar value=72 label="Nord"
:::
::: bar value="48,5" label="Süd" state=warn
:::
::: bar value=95 label="West"
:::
:::

::: notes
Prüfen: Die Balken sind unterschiedlich lang (72 %, 49 % und 95 % der Breite, die Zahlen daneben lauten 72,0, 48,5 und 95,0 Mio.). Mit jedem Schritt erscheint ein Balken. „Süd“ ist orange (`state=warn`). Unten stehen die Summe „215,5 Mio.“ und „Stand: 29. Oktober 2026“.

Im Markdown steht nur die Zahl. Die Vorlage `components/bars.html` rechnet die Balkenlänge mit `{{ value | percent:scale }}` und die Summe mit `{{ children | sum:value | number:1 }}`.
:::

## Was die Funktionen machen

::: figures number="1234,56" date="2026-10-29" text="Hashmark"
:::

::: notes
Prüfen: `number:1` ergibt 1.234,6 (deutsch), mit `"en"` 1,234.6. `percent:5000:1` ergibt 24.7%. `date:long` ergibt „29. Oktober 2026“, `date:short:"en"` ergibt 10/29/2026. `upper` ergibt HASHMARK, `truncate:4` ergibt „Has…“, und bei `default:"–"` steht der Ersatzwert, weil das Attribut fehlt.
:::

## Standardwerte und Vergleiche

::: bars title="Ohne Angaben: Skala und Einheit kommen aus dem Kopf der Vorlage"
::: bar value=30 label="A"
:::
::: bar value=60 label="B" state=warn
:::
:::

::: notes
Prüfen: Hier fehlen `scale` und `unit`. Die Balken sind trotzdem richtig lang (30 % und 60 %), weil der Kopf der Vorlage `scale: "100"` als Standard setzt (`defaults`). „B“ ist orange, weil `{{#if state is warn}}` zutrifft.
:::

## Im Editor ausprobieren

1. Editor öffnen und `components/bars.html` wählen
2. In der Vorlage `{{ value | ` tippen: Die Funktionen werden vorgeschlagen
3. `{{ value | percnt }}` schreiben: Der Fehler erscheint mit Zeile
4. `percent:scale` zurückschreiben: Die Folie „Balken“ zeigt wieder alles

::: notes
Prüfen: Nach dem `|` öffnet sich die Vorschlagsliste mit Erklärung je Funktion (default, upper, lower, truncate, number, percent, date, sum, max, min, image). Eine unbekannte Funktion meldet „Zeile N: unbekannte Funktion „percnt““ samt der erlaubten Namen.
:::

## Nicht geprüft

- Die automatischen Tests liefen in meiner Umgebung nicht (kein Zugang zur Paketquelle), sie laufen erst in der Pipeline
- Vorschläge nach `|` und Fehleranzeige im echten Editor-Fenster
- PDF- und PowerPoint-Export mit der Komponente
- Webdienst und Desktop-App
- Englische Oberfläche und englisches Handbuch (eigenes Ticket #23)

::: notes
Wer etwas davon sehen will: PDF-Export und PowerPoint-Export der Balken-Folie stichprobenartig ansehen.
:::
