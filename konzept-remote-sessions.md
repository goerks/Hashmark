# Konzept: Remote-Sessions im Webdienst (Teilen, Bearbeiten, Kommentieren)

Stand: 04.11.2026 · Status: Entwurf zur Entscheidung, noch kein Ticket, kein Code. Rahmen: Render Free, keine Datenbank, Speicher nur im Arbeitsspeicher.

## 1. Ziel

Eine **lokale Präsentation** (Deck-Ordner) wird auf den Webdienst (Render) **hochgeladen und geteilt**. Jede geteilte Präsentation ist eine **Session mit eigener, eindeutiger Adresse**. Dort kann man sie **ansehen, bearbeiten und kommentieren**. Ein **Passwortschutz** kommt später und wird jetzt nur vorbereitet.

Heute: Ein Container zeigt genau **ein** Deck (`DECK_DIR`), öffentlich, Editor ohne Anmeldung. Das ist eine Demo-Instanz, kein Dienst für fremde Präsentationen.

## 2. Bestand (nachgeprüft im Code)

| Baustein | Stand | Folge für das Konzept |
| --- | --- | --- |
| `src/desktop/live-server.ts` | Ein `deckDir`, ein `payload`, ein Satz SSE-Clients, ein File-Watcher, alles im Closure von `startLiveServer` | Muss in **je Session** (Zustand) und **Router** (ein Server) zerlegt werden |
| `src/vite/editor-api.ts` | `editorApi(deckDir)` bereits je Deck instanziierbar; Pfadprüfung `inside()`, Header- und Origin-Schutz | Wiederverwendbar je Session |
| Runtime-Aufrufe | `editor/api.ts` und `deck-source.ts` rufen **absolut** `/__hashmark/…` auf, `plan-store.ts` schon relativ (`./__hashmark/plan`) | Adresse `/s/<id>/…` verlangt relative Aufrufe (kleine Änderung, 2 Stellen) |
| Deck-Dateien (`ASSET_PREFIX`) | Bilder/Videos mit Teilabrufen, pro Deck | Je Session unter deren Präfix. *Zu prüfen:* ob das gerenderte HTML absolute Pfade enthält, sonst `<base href>` |
| Plugins | im Webdienst bereits aus (`HASHMARK_PLUGINS=off`) | Bleibt, ist Voraussetzung für fremde Uploads |
| Kommentare, Sessions, Rollen | **gibt es nicht** | Neu |
| Speicher | Render Free: keine Disk, Neustart nach Schlaf löscht alles | Virtuelles Dateisystem im Arbeitsspeicher, Original lokal (4.3) |

## 3. Varianten

Die Kernfrage ist: **Wo liegt die Wahrheit, wenn lokal und online beide bearbeitet werden?**

### Variante A: Schnappschuss mit Hochladen und Zurückholen *(Empfehlung)*

`hashmark share` lädt den Deck-Ordner hoch (Kopie auf dem Server). Online wird bearbeitet und kommentiert. `hashmark pull` holt Änderungen und Kommentare zurück, `hashmark share --update` schiebt eine neue lokale Fassung nach. Jede Datei hat eine Revision; wurde sie online zwischenzeitlich geändert, zeigt das Werkzeug den Konflikt statt zu überschreiben.

- Vorteile: einfach, offline-fähig, überlebt Neustarts des Dienstes (lokal ist das Original), passt zum heutigen Datei-Modell, kein Echtzeit-Konfliktproblem, wenig Aufwand.
- Nachteile: Abgleich ist ein bewusster Schritt, nicht automatisch.

### Variante B: Live-Sync (lokal ⇄ online, laufend)

Der lokale Ordner wird beobachtet und laufend gespiegelt, Online-Änderungen kommen zurück.

- Vorteile: fühlt sich wie ein gemeinsames Dokument an.
- Nachteile: Konflikte bei gleichzeitigem Tippen brauchen CRDT/OT oder Sperren; deutlich mehr Aufwand und Risiko; Datenverlust bei Fehlern wahrscheinlicher. Baut ohnehin auf A auf (Upload, Revisionen), kann später folgen.

### Variante C: Tunnel zum eigenen Rechner

Der Webdienst reicht Anfragen an die laufende lokale App weiter. Nichts wird hochgeladen.

- Vorteile: keine Daten auf dem Server, immer der aktuelle Stand.
- Nachteile: nur erreichbar, solange der Rechner läuft und online ist; Kommentare brauchen trotzdem Speicher auf dem Server; Firmennetze blockieren so etwas oft; widerspricht dem Ziel „eine Session, die man teilt“.

| Kriterium | A Schnappschuss | B Live-Sync | C Tunnel |
| --- | --- | --- | --- |
| Nutzen (Teilen, Bearbeiten, Kommentieren) | gut | sehr gut | mittel (Rechner muss laufen) |
| Passung zum Datei-Modell | sehr gut | mittel | gut |
| Aufwand | niedrig bis mittel | hoch | mittel |
| Risiko (Datenverlust, Sicherheit) | niedrig | hoch | mittel |
| Später Passwort / Rollen | einfach | einfach | schwierig |

**Empfehlung: A.** B ist ein möglicher Ausbau darauf, C wird bewusst nicht verfolgt.

> Hinweis zum Ablauf: Nach `.claude/rules/git-workflow.md` gehört zu jeder Variante ein ansehbarer Design-Entwurf (Artifact). Den erstelle ich, sobald die Richtung feststeht und ein Ticket existiert; für diese Architekturfrage hätten Bilder jetzt wenig Mehrwert.

## 4. Konzept (Variante A)

### 4.1 Adressen

```
https://<dienst>/                       Startseite (Info, später Upload-Formular)
https://<dienst>/s/<id>/                Präsentation   (+ ?reader, ?presenter wie bisher)
https://<dienst>/s/<id>/editor.html     Editor
https://<dienst>/s/<id>/__hashmark/…    Deck, Ereignisse, Datei-API, Kommentare (je Session)
https://<dienst>/api/sessions           Anlegen / Aktualisieren / Löschen (CLI, mit Schlüssel)
```

- `<id>`: **128 Bit zufällig** (22 Zeichen base64url), nicht erratbar. Die Adresse ist selbst das Geheimnis („Wer den Link hat, darf“), es gibt **keine Konten**. Das passt zur bisherigen Entscheidung „keine Anmeldung“.
- Der alte Betrieb (ein Deck unter `/`, für die Live-Instanz und die PR-Vorschau) **bleibt unverändert**; Sessions werden mit `SESSIONS=1` zugeschaltet. Später kann das Einzel-Deck eine Session mit festem Namen werden.

### 4.2 Rollen und Links

Eine Session hat zwei Geheimnisse und damit zwei Links:

| Link | Rolle | Darf |
| --- | --- | --- |
| `/s/<id>/` | **Ansehen** | Präsentation, Lesemodus, Presenter, Kommentare lesen (und schreiben, siehe Frage 2) |
| `/s/<id>/#k=<bearbeiten-token>` | **Bearbeiten** | zusätzlich Editor, Dateien ändern, Kommentare auflösen/löschen |
| Besitzer-Token (nur bei `share`, wird in `~/.hashmark/shares.json` lokal gemerkt) | **Besitzer** | aktualisieren, Links erneuern, Session löschen |

- Das Token steht im **Fragment (`#k=…`)**, wird also nie an den Server als Teil der Adresse geschickt (nicht in Logs, nicht im Referer). Die Seite legt es in `sessionStorage` und sendet es als Header `X-Hashmark-Token`. Auf dem Server liegen nur **Hashes** der Tokens.
- **Vorbereitung Passwort:** Eine einzige Funktion `resolveRole(session, request) → none | view | edit | owner` entscheidet alles. Heute wertet sie Tokens aus; später kommt `meta.access = { mode: 'password', hash }` (scrypt aus Node, keine neue Abhängigkeit) plus Cookie dazu. Keine Route prüft Rechte selbst.

### 4.3 Speicher: virtuelles Dateisystem im Arbeitsspeicher (Render Free)

Auf Render Free gibt es keine Disk, der Dienst schläft nach 15 Minuten ohne Zugriff und verliert dabei alles. Deshalb **keine Datenbank und kein Dateispeicher**, sondern:

```
Map<sessionId, Session>
  Session = { meta, files: Map<pfad, { bytes, rev }>, comments[], lastUsed }
```

- Das **virtuelle Dateisystem (VFS)** ersetzt den Deck-Ordner. `loadDeck` und `editorApi` arbeiten heute auf `fs`; sie bekommen eine kleine Dateisystem-Schnittstelle (`readFile`, `writeFile`, `list`, `stat`), die für lokale Ordner `fs` und online das VFS nutzt. Das ist der größte technische Umbau, und er deckt sich mit „FS-Abstraktion“ aus der Roadmap.
- **Lokal ist die Wahrheit.** Die Online-Kopie ist ein Spiegel und darf jederzeit verschwinden. Jede Datei hat eine Revision (Inhalts-Hash). Der Abgleich vergleicht Revisionen je Datei (wie eine Quellcode-Verwaltung): hochladen, holen, bei Änderung auf beiden Seiten Konflikt.
- **Wiederherstellen unter demselben Link:** Adresse (`<id>`) und Besitzer-Schlüssel entstehen **lokal** beim ersten Teilen und stehen in `~/.hashmark/shares.json`. Kennt der Dienst die Adresse nicht mehr (Neustart), nimmt er sie vom Besitzer mit Schlüssel erneut an (`PUT /api/sessions/<id>`). Die Links der Beteiligten bleiben gültig. Weil die Adressen unratbar sind, ist „wer zuerst kommt“ unkritisch.
- **Verlustgrenze:** Was online geändert oder kommentiert wurde und noch nicht geholt ist, geht beim Neustart verloren. Gegenmaßnahmen: Die Oberfläche zeigt „Online: n Änderungen“ deutlich; offene Browser-Tabs halten eine Kopie des Decks und der eigenen Änderungen (IndexedDB) und könnten die Session später wiederherstellen (nicht im ersten Schnitt); der Besitzer kann `hashmark pull` jederzeit aufrufen.
- **Aufwachen:** Der erste Aufruf nach dem Schlaf dauert bis zu einer Minute. CLI und Oberfläche zeigen „Dienst wird geweckt“ und wiederholen den Aufruf. Ein künstliches Wachhalten ist nicht vorgesehen.
- **Begrenzungen im Speicher:** je Session z. B. 20 MB, insgesamt z. B. 200 MB (Render Free hat 512 MB RAM), Verdrängung der am längsten nicht benutzten Session. Videos werden online nicht gespiegelt oder nur klein erlaubt.

### 4.4 Umbau des Servers

`live-server.ts` wird zerlegt:

- `createSession(dir)` → Objekt mit `payload`, SSE-Clients, `reload()`, `editorApi`, `planApi`, `commentsApi` (= heutiger Zustand im Closure).
- Router: `/s/<id>/…` → Session suchen (Verdrängung nach Speichergrenze, damit viele Sessions den Arbeitsspeicher nicht füllen) → `resolveRole` → Session-Handler.
- Im Mehrbetrieb **kein `fs.watch`**: Das VFS meldet Schreibvorgänge selbst, die Datei-API löst danach `reload()` aus.
- `/api/sessions` (POST/PUT/DELETE) und `/s/<id>/__hashmark/*` sind neue Routen; `/healthz` und `/webseite/` bleiben.
- Die Runtime ruft in Sessions **relativ** auf (`./__hashmark/…`), die Seite bekommt bei Bedarf ein `<base href>` vom Server.

### 4.5 Hochladen: `hashmark share`

```
hashmark share [deck]            lädt hoch → gibt Ansehen-Link und Bearbeiten-Link aus
hashmark share --update          neue lokale Fassung nach online (bricht bei Online-Änderungen ab)
hashmark pull                    holt Änderungen und Kommentare zurück (zeigt Konflikte)
hashmark unshare                 löscht die Session
```

- Übertragen wird nur, was `loadDeck` braucht: Markdown, YAML, Komponenten, Bilder, Videos; **nie** `node_modules`, `.git`, Punktdateien. Ein Archiv (tar.gz, Node-eingebaut) oder Datei-für-Datei per `PUT`.
- Zugang zum **Anlegen** nur mit **Dienst-Schlüssel** (`SHARE_KEY` auf Render, in der CLI per `--key` bzw. `HASHMARK_SHARE_KEY`). Sonst wäre der Dienst ein offener Dateispeicher für jeden.
- Später: Schaltfläche **„Teilen“** in der Desktop-App (nutzt denselben Code) und ein Upload-Formular auf der Startseite (Ordner/ZIP ziehen).

### 4.6 Bearbeiten (mehrere Personen)

- Datei-API bekommt **Revisionen**: Lesen liefert einen Hash, Schreiben sendet `If-Match`. Bei Abweichung `409`, der Editor zeigt „Datei wurde inzwischen geändert“ mit Übernehmen/Neu laden. Heute gilt „letzter gewinnt“, das ist bei mehreren Personen nicht vertretbar.
- Ändert jemand etwas, kommt `deck` per SSE bei allen (gibt es schon).
- Später (nicht jetzt): Anzeige „X bearbeitet gerade …“.

### 4.7 Kommentieren

- **Anker:** Folien-Kennung (Knoten im Baum) + Position der Folie + optional zitierter Text. Weil sich Folien beim Bearbeiten verschieben, bleibt das Zitat die Rückfallebene; nicht mehr zuordenbare Kommentare landen unter „Ohne Folie“ statt zu verschwinden. *(Annahme, noch gegen die tatsächliche Stabilität der Knoten-IDs zu prüfen.)*
- **Inhalt:** Name (freier Text, in `localStorage` gemerkt, keine Anmeldung), Text, Zeit, Status offen/erledigt, Antworten.
- **Bedienung:** Kommentar-Leiste in Präsentation, Lesemodus und Presenter-Ansicht, Zähler am Baum (NavOverview), live per SSE. In Druck/PDF/PPTX **nicht** enthalten (optional später als Handout-Anhang).
- Kommentare liegen in der Session im Arbeitsspeicher (neben dem VFS, nicht im Deck) und werden mit `pull` als `kommentare.md` zurückgegeben. Mit Größen- und Mengenbegrenzung.

### 4.8 Sicherheit (wird mit Fremd-Uploads ernst)

1. **Fremder Inhalt auf einer Herkunft:** Komponenten (`components/*.html`) und Deck-HTML einer Session laufen auf derselben Adresse wie alle anderen. Ein böses Deck könnte Bearbeiten-Tokens anderer Sessions aus `sessionStorage` des Browsers lesen. Gegenmittel: (a) je Session **eigene Subdomain** (`<id>.dienst…`, Wildcard-Domain nötig) oder (b) Inhalte so bereinigen/einsperren (CSP, Sandbox), dass kein Skript läuft. *Muss vor Umsetzung geklärt werden*, hat Einfluss auf Adressform (Frage 4).
2. **Pfade:** `<id>` streng prüfen (`^[A-Za-z0-9_-]{22}$`), `inside()` bleibt Pflicht, Archive ohne `..`, Symlinks, absolute Pfade.
3. **Begrenzungen:** Größe je Session (z. B. 50 MB), Anzahl Sessions, Anfragen je Minute (Hochladen, Kommentare), Platten-Budget.
4. **Lebensdauer:** keine feste Dauer. Eine Session lebt, bis der Dienst schläft oder neu startet. Der Besitzer kann sie mit `unshare` jederzeit entfernen.
5. Plugins bleiben aus; Header- und Origin-Schutz der Datei-API bleiben.

### 4.9 Betrieb auf Render Free

- Eine Instanz, alles im Arbeitsspeicher, **keine Disk**. Der Dienst schläft nach 15 Minuten ohne Zugriff und startet beim nächsten Aufruf neu (bis zu einer Minute).
- Neue Umgebung: `SESSIONS=1`, `SHARE_KEY`, `SESSION_MAX_MB`, `SESSIONS_MAX_MB`. Kein `DATA_DIR`.
- Dockerfile ändert sich kaum. `webdienst.md` und Handbuch (Abschnitt „Teilen“) werden mitgezogen. `hashmark-fuer-ki.md` bleibt unberührt.

### 4.10 Oberfläche (Entwurf zur Entscheidung)

Drei Varianten sind als klickbarer Entwurf ausgearbeitet: https://claude.ai/artifact/Gn33US7purMRATwxKAUQiQ

| Variante | Idee | Bewertung |
| --- | --- | --- |
| **A Dialog** | Statuschip und Knopf „Teilen“ in der Kopfzeile des Editors, Fenster mit Links und „Abgleichen“ | klein, passt zu PDF/Präsentieren **(Empfehlung)** |
| **B Seitenleiste** | Reiter „Teilen“ neben „Dateien“, je Datei Status und Einzelaktion, Aktivität | mehr Kontrolle, mehr Aufwand, später als Ausbau |
| **C Automatisch** | nur Chip, Abgleich im Hintergrund, Konflikte als Leiste | auf Render Free zu riskant (stille Überschreibungen) |

Gemeinsam in allen Varianten: Marker je Datei in der Dateiliste (↑ lokal neuer, ↓ online neuer, ! Konflikt, ○ nur lokal), Zustände „Dienst wird geweckt“ und „Online-Kopie fehlt, wiederherstellen“, Aktionen in der Palette (Strg+K), Kommentarknopf in der Navigationspille der Präsentation, Kommentare im Lesemodus, Zuschauer und neue Kommentare in der Presenter-Kopfzeile, Online-Editor für Gäste ohne Knopf „Teilen“. In der Desktop-App spricht der lokale Node-Prozess mit dem Dienst (neue Aktionen `share` und `sync`), die Seite nie direkt.

## 5. Umsetzung in Schnitten (je ein Ticket / PR)

1. **Sessions-Kern:** Dateisystem-Schnittstelle und VFS, Zerlegung des Live-Servers, `/s/<id>/`, Speicher, relative Aufrufe in der Runtime, `/api/sessions`, `hashmark share/unshare`, Tests (Pfad-Ausbruch, Isolation zweier Sessions). Danach ist „Hochladen und ansehen“ nutzbar.
2. **Bearbeiten und Rollen:** Tokens, `resolveRole`, Revisionen/Konflikte im Editor, `share --update`, `pull`.
3. **Kommentare:** Speicher, API, Oberfläche (Folie, Lesemodus, Presenter), Rückgabe per `pull`.
4. **Bequemlichkeit:** „Teilen“ in der Desktop-App, Upload-Formular im Browser, Ablauf/Aufräumen, Quoten.
5. **Später:** Passwortschutz (`meta.access`, Cookie), Anzeige „wer ist da“, ggf. Live-Sync (Variante B).

Schnitt 1 hängt an Entscheidung zu Sicherheit (4.8, Punkt 1), die anderen bauen aufeinander auf.

## 6. Fragen an den Auftraggeber (jeweils mit Empfehlung)

1. **Wer darf hochladen?** Empfehlung: nur mit Dienst-Schlüssel (Team/Bekannte), kein offener Upload. Offen wäre später möglich, braucht dann stärkere Begrenzungen.
2. **Wer darf kommentieren?** Empfehlung: zwei Links, „Ansehen & kommentieren“ und „Bearbeiten“. Alternative: reiner Ansehen-Link ohne Kommentare plus dritter Link.
3. **Verlust akzeptieren?** Online-Änderungen, die nicht geholt wurden, gehen beim Neustart verloren. Empfehlung: ja, mit deutlicher Anzeige „Online: n Änderungen“. Alternative wäre eine bezahlte Instanz mit Disk.
4. **Adressform:** Empfehlung: Pfad `/s/<id>/` zum Start (einfach, ein Zertifikat) und die Fremd-Inhalte per Sandbox/CSP einsperren. Wildcard-Subdomain nur, wenn Teilen mit **unbekannten** Personen vorgesehen ist.
5. **Oberfläche:** Variante A mit den Datei-Markern aus B? Empfehlung: ja, B später.
7. **Rückweg:** Reicht bewusster Abgleich mit Konfliktanzeige für den Anfang? Empfehlung: ja, kein Live-Sync.
6. **Altbestand:** Soll die Live-Instanz weiter ein öffentliches Demo-Deck unter `/` zeigen? Empfehlung: ja, solange es die PR-Vorschau braucht.

## 7. Bewusst weggelassen

Benutzerkonten und Anmeldung, Live-Zusammenarbeit im Echtzeit-Takt (CRDT), Datenbank, dauerhafter Speicher auf dem Dienst, mehrere Instanzen, Kommentare im PDF/PPTX, Benachrichtigungen per E-Mail.
