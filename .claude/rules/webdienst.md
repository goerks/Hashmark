---
paths:
  - "src/cli/serve.ts"
  - "src/desktop/live-server.ts"
  - "Dockerfile"
  - "docker/**"
  - ".github/workflows/docker.yml"
---

# Webdienst (`hashmark serve`, Docker/Render)

- Ein Prozess, ein Container: `live-server.ts` mit Option `web` liefert die Präsentation öffentlich und `/editor.html` plus Datei-API nur mit HTTP-Basic-Passwort (`EDITOR_PASSWORD`, ohne Passwort gibt es keinen Editor). `/healthz` für Render. Live-Instanz: https://hashmark.onrender.com
- **Editor ohne Passwort:** `EDITOR_OPEN=1` (Option `web.editorOpen`) öffnet `/editor.html` und die Datei-API ohne Anmeldung, auch wenn `EDITOR_PASSWORD` gesetzt ist. Standard ist aus. Das Image setzt es nur über `--build-arg EDITOR_OPEN=1`, und das tut `docker.yml` (Job `preview`) für die Vorschau eines Pull Requests, deren Deck bei jedem Start zurückgesetzt wird. Auf der Live-Instanz bleibt das Passwort, bis dort bewusst die Umgebungsvariable `EDITOR_OPEN=1` gesetzt wird.
- Die Datei-API prüft im Webbetrieb weiter den Header `X-Hashmark-Editor` und dass `Origin` zum `Host` passt (Basic-Zugangsdaten gehen sonst auch von fremden Seiten mit). `/__hashmark/app` bleibt localhost-only.
- Das Image installiert online per `npm ci` (der Vendor-Cache enthält nur Windows-Binärdateien) und baut die Runtime beim Bauen vor. Läuft als root, weil Render-Festplatten root gehören.
- Image: `make image` baut es lokal. Lokal gibt es kein Docker: das Image wurde nicht gebaut, nur `hashmark serve` ist getestet.
- **Webseite in der Vorschau:** Mit `SITE_DIR` (Option `web.siteDir`) liefert der Webdienst eine fertig gebaute Webseite (`make docs`) öffentlich unter `/webseite/` aus. Das Image füllt den Ordner nur in der Vorschau eines Pull Requests: Die Dockerfile-Stufe `webseite` ist leer, `docker.yml` (Job `preview`) baut die Seite mit Bildern und ersetzt die Stufe per `build-contexts`. Ein leerer Ordner (Live-Instanz) schaltet die Route ab.
- Dateien des Decks (auch Videos) liefert `live-server.ts` mit Teilabrufen (`serve-file.ts`), Vorspulen im Video geht also auch im Webdienst.
- `docker.yml` legt das Image bei jedem Push auf `main` ab und ruft danach den Render-Deploy-Hook auf (Secret `RENDER_DEPLOY_HOOK_URL`). Das heißt: **jeder Merge auf `main` deployt die Live-Instanz.**
