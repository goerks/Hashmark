# Funktionen in Komponenten {layout=title}

Abnahme Ticket #20 · Bausteine, die rechnen und formatieren, und vier neue eingebaute Komponenten

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

# Neu eingebaut: Pipeline

::: pipeline title="Release 4.2" summary steps
::: stage label="Bauen" state=done time="1:12 min"
:::
::: stage label="Testen" state=run progress=62
:::
::: stage label="Prüfen"
:::
::: stage label="Ausrollen"
:::
:::

::: notes
Prüfen: Mit jedem Schritt erscheint eine Stufe. „Bauen“ ist grün und voll, „Testen“ läuft (62 % Fortschritt, pulsiert im Browser), die übrigen sind leer. Oben rechts steht „25% erledigt“. Das rechnet die Vorlage selbst aus (`share:state:done`).
:::

# Neu eingebaut: Statusautomat

::: states title="Freigabe-Prozess" back="Änderungen nötig"
::: state label="Entwurf" at=1 then=3
:::
::: state label="Prüfung" at=2 then=4
:::
::: state label="Freigabe" at=5
:::
::: state label="Veröffentlicht" at=6
:::
:::

::: notes
Prüfen: Mit → leuchtet nacheinander Entwurf, Prüfung, dann wieder Entwurf (Rücksprung), Prüfung, Freigabe und Veröffentlicht. Es leuchtet immer nur ein Zustand. Unten steht „↩ Änderungen nötig“. Im Lesemodus (`?reader`) leuchtet keiner.
:::

# Neu eingebaut: Zeitplan

::: gantt title="Projektplan 2027" scale=12 now=6 from="Jan" to="Dez" steps
::: task label="Konzept" start=0 length=2 state=done
:::
::: task label="Bau" start=2 length=5 state=done
:::
::: task label="Test" start=6 length=3
:::
::: task label="Rollout" start=9 length=3
:::
:::

::: notes
Prüfen: Die Balken erscheinen nacheinander an der richtigen Stelle der Zeitleiste (Konzept Monat 1 bis 2, Bau 3 bis 7, Test 7 bis 9, Rollout 10 bis 12). Erledigte Balken sind kräftig, offene blasser. Die rote Linie steht in der Mitte (Monat 6). Position und Breite rechnet die Vorlage aus `start`, `length` und `scale`.
:::

# Neu eingebaut: Checkliste

::: checklist title="Go-Live-Vorbereitung" progress steps
::: task label="Daten migrieren" state=done owner=Anna
:::
::: task label="Rechte prüfen" state=done owner=Ben
:::
::: task label="Schulung planen" state=wip owner=Chiara
:::
::: task label="Freigabe holen" owner=Ben
:::
:::

::: notes
Prüfen: Die Aufgaben erscheinen nacheinander. Erledigte haben ein grünes Häkchen und sind durchgestrichen, die in Arbeit zeigt „…“. Unten steht „2 von 4 erledigt“ und der Balken ist halb gefüllt. Beides rechnet die Vorlage selbst (`count:state:done`, `share:state:done`).
:::

# Im Editor ausprobieren

1. Editor öffnen und `components/bars.html` wählen
2. In der Vorlage `{{ value | ` tippen: Die Funktionen werden vorgeschlagen
3. `{{ value | percnt }}` schreiben: Der Fehler erscheint mit Zeile
4. `percent:scale` zurückschreiben: Die Folie „Balken“ zeigt wieder alles

::: notes
Prüfen: Nach dem `|` öffnet sich die Vorschlagsliste mit Erklärung je Funktion (default, upper, lower, truncate, number, percent, date, sum, max, min, image). Eine unbekannte Funktion meldet „Zeile N: unbekannte Funktion „percnt““ samt der erlaubten Namen.
:::

# Nicht geprüft

- Die vier neuen Komponenten in Druckansicht, PDF und PowerPoint
- Statusautomat im Presenter-Fenster
- Vorschläge nach `|` und Fehleranzeige im echten Editor-Fenster
- Webdienst und Desktop-App
- Englische Oberfläche und englisches Handbuch (eigenes Ticket #23)

::: notes
Wer etwas davon sehen will: PDF-Export und PowerPoint-Export der Balken-Folie stichprobenartig ansehen.
:::
