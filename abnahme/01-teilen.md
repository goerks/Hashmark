# Online teilen und abgleichen {layout=title}

Ticket #87: Eine lokale Präsentation im Webdienst zeigen, bearbeiten und abgleichen.

::: notes
Prüfen: Diese Präsentation läuft in der Vorschau des Pull Requests. Das Teilen selbst braucht einen Dienst mit `SESSIONS=1` und `SHARE_KEY` (siehe „So probierst du es aus“). Die Folien zeigen, was du siehst und worauf du achtest.
:::

# Was neu ist

- Jede geteilte Präsentation hat **eine eigene Adresse** (`/s/…`)
- Zwei Links: **Ansehen** und **Bearbeiten**
- **Lokal bleibt das Original**, online ist eine Kopie
- Abgleich je Datei, nie stilles Überschreiben

::: notes
Prüfen: Im Editor (`make edit`) steht neben „PDF“ und „PPTX“ ein neuer Knopf **Teilen**. Ohne Dienst oder Schlüssel fragt der Dialog nach Adresse und Schlüssel.
:::

# So probierst du es aus

1. Dienst mit `SESSIONS=1` und `SHARE_KEY=geheim` starten (Render: Umgebungsvariablen setzen)
2. Editor lokal öffnen, **Teilen** klicken, Adresse und Schlüssel eintragen
3. **Online teilen**: zwei Links erscheinen
4. Link „Ansehen“ in einem zweiten Fenster öffnen
5. Link „Bearbeiten“ öffnen, dort eine Folie ändern
6. Zurück im lokalen Editor: Chip **Online: 1 Änderung**, **Änderungen holen**

::: notes
Prüfen: Auf der Befehlszeile geht dasselbe mit `hashmark share`, `hashmark pull`, `hashmark push`, `hashmark unshare`. Der erste Aufruf nach längerer Pause kann bis zu einer Minute dauern, weil der kostenlose Render-Dienst schläft. Der Dialog sagt „Dienst wird geweckt“.
:::

# Zustände im Editor {steps}

- **Geteilt · synchron**: lokal und online gleich
- **n lokale Änderungen** (↑): hochladen
- **Online: n Änderungen** (↓): holen
- **Konflikt** (!): je Datei „Lokal behalten“ oder „Online übernehmen“
- **Online-Kopie fehlt** (○): „Online wiederherstellen“, gleicher Link

::: notes
Prüfen: Ändere dieselbe Datei lokal und online, dann zeigt der Chip „Konflikt“, und die Datei in der Dateiliste trägt ein „!“. Nichts wird überschrieben, bevor du wählst.
:::

# Der Dienst vergisst {layout=statement}

Nach einem Neustart ist die Online-Kopie weg. **Hole Online-Änderungen regelmäßig.**

::: notes
Prüfen: Dienst neu starten (Render: Manual Deploy oder warten, bis er schläft). Danach zeigt der Chip „Online-Kopie fehlt“, der Link „Ansehen“ meldet „nicht mehr online“. „Online wiederherstellen“ bringt dieselbe Adresse zurück. Was online geändert und nicht geholt war, ist verloren.
:::

# Nicht geprüft

- Svelte-Build und Oberfläche im Browser (in der Entwicklungsumgebung ohne Zugang zur Paketquelle nicht möglich)
- echter Render-Dienst, Schlafen und Aufwachen
- Desktop-App (Teilen läuft dort über den Sidecar, nicht gestartet)
- Kommentare und Passwortschutz (bewusst nicht Teil dieses Tickets)

::: notes
Prüfen: Alles unter „So probierst du es aus“ ist die eigentliche Abnahme. Gemeldet werden bitte: unklare Texte im Dialog, falsche Zustände im Chip, Verhalten bei langsamer Verbindung.
:::
