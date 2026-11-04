---
paths:
  - "src/cli/serve.ts"
  - "src/cli/share.ts"
  - "src/share/**"
  - "src/desktop/live-server.ts"
  - "Dockerfile"
  - "docker/**"
  - ".github/workflows/docker.yml"
---

# Webdienst (`hashmark serve`, Docker/Render)

- Ein Prozess, ein Container: `live-server.ts` mit Option `web` liefert die Präsentation öffentlich und `/editor.html` plus Datei-API **ohne jede Anmeldung** (bewusste Entscheidung des Auftraggebers, es gibt kein `EDITOR_PASSWORD` mehr; wer die Adresse kennt, kann das Deck ändern). `/healthz` für Render. Live-Instanz: https://hashmark.onrender.com
- Die Datei-API prüft im Webbetrieb weiter den Header `X-Hashmark-Editor` und dass `Origin` zum `Host` passt (ohne Anmeldung ist das der einzige Schutz davor, dass fremde Webseiten im Browser eines Besuchers die Datei-API ansprechen). `/__hashmark/app` bleibt localhost-only.
- Das Image installiert online per `npm ci` (der Vendor-Cache enthält nur Windows-Binärdateien) und baut die Runtime beim Bauen vor. Läuft als root, weil Render-Festplatten root gehören.
- Image: `make image` baut es lokal. Lokal gibt es kein Docker: das Image wurde nicht gebaut, nur `hashmark serve` ist getestet.
- **Webseite in der Vorschau:** Mit `SITE_DIR` (Option `web.siteDir`) liefert der Webdienst eine fertig gebaute Webseite (`make docs`) öffentlich unter `/webseite/` aus. Das Image füllt den Ordner nur in der Vorschau eines Pull Requests: Die Dockerfile-Stufe `webseite` ist leer, `docker.yml` (Job `preview`) baut die Seite mit Bildern und ersetzt die Stufe per `build-contexts`. Ein leerer Ordner (Live-Instanz) schaltet die Route ab.
- Dateien des Decks (auch Videos) liefert `live-server.ts` mit Teilabrufen (`serve-file.ts`), Vorspulen im Video geht also auch im Webdienst.
- `docker.yml` legt das Image bei jedem Push auf `main` ab und ruft danach den Render-Deploy-Hook auf (Secret `RENDER_DEPLOY_HOOK_URL`). Das heißt: **jeder Merge auf `main` deployt die Live-Instanz.**

## Teilen: Sessions (Ticket #87, `src/share/`)

Konzept und Entscheidungen: `konzept-remote-sessions.md`. Der Dienst ist auf **Render Free** gedacht: keine Disk, schläft nach 15 Minuten, Neustart löscht alles. Darum gilt **lokal ist das Original, online ein flüchtiger Spiegel**.

- **Einschalten:** `SESSIONS=1` (+ `SHARE_KEY`, optional `SESSIONS_DIR`, `SESSION_MAX_MB`, `SESSIONS_MAX_MB`). Ohne `SHARE_KEY` lässt sich nichts anlegen (503). Das Einzel-Deck unter `/` läuft unverändert daneben (PR-Vorschau braucht es).
- **Speicher:** `SessionStore` (`sessions.ts`) legt je Session einen Ordner unter `os.tmpdir()/hashmark-sessions/<id>/deck` an (flüchtig, deshalb funktionieren `loadDeck`, Datei-API und Dateiauslieferung unverändert; kein eigenes virtuelles Dateisystem). Grenzen je Session, insgesamt und für die Anzahl; die am längsten ungenutzte Session weicht. Anlegen höchstens 20 je Stunde und Absender.
- **Zugang ohne Konten:** `<id>` (22 Zeichen, 128 Bit) = Ansehen; Bearbeiten-Token (`#k=…` im Link zu `editor.html`, Fragment, nie am Server) = Datei-API des Online-Editors; Besitzer-Token = Abgleich per `/api/sessions/*`. Id und Token entstehen **lokal** (`~/.hashmark/share.json`, `HASHMARK_HOME`), der Dienst speichert nur Hashes. So stellt `PUT /api/sessions/<id>` (mit Dienst-Schlüssel) nach einem Neustart dieselbe Adresse wieder her.
- **Router** (`live-server.ts`): `createHost` kapselt Zustand je Deck (Deck-JSON, Ereignisse, Datei-API), einer für `/`, einer je Session (höchstens 20 gleichzeitig im Speicher). Für Sessions wird `req.url` auf den Pfad im Deck umgeschrieben (die Datei-API kennt nur `/__hashmark/…`). Lesen (`deck.json`, `theme.css`, `events`, `plan` GET) darf jeder mit der Adresse, alles andere unter `/__hashmark/` braucht das Bearbeiten-Token. `/__hashmark/pptx` ist online gesperrt (würde das Deck des Dienstes rendern). Sessions werden nicht per `fs.watch` beobachtet, die Schnittstellen laden selbst neu.
- **Fremde Inhalte auf einer Herkunft:** Markdown darf rohes HTML enthalten (`allowDangerousHtml`). Session-Seiten bekommen darum eine **CSP mit Nonce** (nur Skripte der Runtime, kein Inline-Skript aus dem Deck, keine fremden Verbindungen), `Referrer-Policy: no-referrer`; `deck-assets/` bekommt `sandbox` und `nosniff`. Das Token liegt in `sessionStorage` und ist so für Deck-Inhalt nicht lesbar. Wird die CSP gelockert (z. B. `unsafe-inline`), ist dieser Schutz weg. Subdomain je Session wäre die härtere Lösung, ist nicht gebaut.
- **Runtime online:** `src/runtime/session.ts` (`window.__HASHMARK_SESSION__` setzt der Server, `apiBase()`, Token aus `#k=`); `deck-source.ts`, `editor/api.ts`, `plan-store.ts` und `live-plugin.ts` nutzen die Basisadresse. Neue Aufrufe an `/__hashmark/…` müssen `apiBase()` und `authHeaders()` nehmen.
- **Lokal** (`client.ts`): Abgleich je Datei mit drei Ständen (lokal, online, letzter Abgleich) → `up`/`down`/`conflict`/`gone`; nie stilles Überschreiben (`If-Match`). Der Browser spricht nur mit dem lokalen Server (`/__hashmark/share/*`, `share/api.ts`, nur `hashmark edit` und Desktop-App mit `share: true`), der mit dem Dienst; Schlüssel und Token verlassen den Rechner nie Richtung Seite. CLI: `hashmark share | push | pull | resolve | unshare` (`src/cli/share.ts`). Editor: Statuschip, Dialog `ShareDialog.svelte`, Marker in der Dateiliste.
- **Offen** (Folgetickets): Kommentare, Passwortschutz, Teilen-Reiter in der Seitenleiste, Upload im Browser, Wiederherstellen aus offenen Browser-Tabs.
- Tests: `tests/share.test.ts` (Regeln, Store, Vergleich, Client gegen den Dienst), `tests/share-server.test.ts` (Router, Rollen, CSP, Neuladen).
