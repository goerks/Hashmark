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
- Die Datei-API prüft im Webbetrieb weiter den Header `X-Hashmark-Editor` und dass `Origin` zum `Host` passt (Basic-Zugangsdaten gehen sonst auch von fremden Seiten mit). `/__hashmark/app` bleibt localhost-only.
- Das Image installiert online per `npm ci` (der Vendor-Cache enthält nur Windows-Binärdateien) und baut die Runtime beim Bauen vor. Läuft als root, weil Render-Festplatten root gehören.
- Image: `make image` baut es lokal. Lokal gibt es kein Docker: das Image wurde nicht gebaut, nur `hashmark serve` ist getestet.
- `docker.yml` legt das Image bei jedem Push auf `main` ab und ruft danach den Render-Deploy-Hook auf (Secret `RENDER_DEPLOY_HOOK_URL`). Das heißt: **jeder Merge auf `main` deployt die Live-Instanz.**
