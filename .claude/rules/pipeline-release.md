---
paths:
  - ".github/**"
  - "release-notes/**"
  - "scripts/release-notes.ts"
  - "scripts/build-docs.ts"
  - "scripts/docs-landing.ts"
---

# Pipeline, Release und Dokumentations-Seiten

- **GitHub Actions (`.github/workflows/`):**
  - `ci.yml`: Vitest, Go-Hülle für 6 Ziele, Image-Probebau; bei Push auf `main` und bei jedem Pull Request.
  - `ci.yml`, Job `probe` (nur Pull Requests): Windows-Paket (`probe-windows`) und HTML-Datei des Beispiel-Decks mit Videoordner (`probe-html-demo`) als Artifacts (7 Tage), damit der Auftraggeber ohne Git ausprobieren kann (Actions › Lauf › Artifacts). Das Paket trägt die Version `pr<Nummer>.<Hash>`.
  - `release.yml`: bei einem Tag `v*`; 6 Standalone-Pakete → GitHub-Release mit Notizen aus `scripts/release-notes.ts` → `pages`.
  - `pages.yml`: GitHub Pages (auch per `workflow_call`).
  - `docker.yml`: Image nach ghcr.io bei Push auf `main`, danach Render-Deploy-Hook.
  - `docker.yml`, Jobs `preview` und `preview-cleanup` (nur PRs aus diesem Repository): Image `ghcr.io/<repo>:pr-<Nummer>-<commit>`, danach bei Render eine Vorschau-Instanz **desselben** Dienstes (API `POST /v1/services/{id}/preview`, Einstellungen des Dienstes, nur das Image-Tag ist anders; Secrets `RENDER_API_KEY`, `RENDER_SERVICE_ID`, ohne sie nur Bau). Frühere Vorschauen des PR werden vor dem Anlegen entfernt, beim Schließen gelöscht (Render löscht Image-Vorschauen nicht selbst). Die Vorschau zeigt die Abnahme-Präsentation (`abnahme/`, Image mit `--build-arg SEED=abnahme SEED_RESET=1`, `DECK_SEED_RESET` ersetzt den Deck-Ordner bei jedem Start). Die Adresse steht als Kommentar im PR. Live-Instanz und `latest` bleiben unberührt. Die Antwort der API ist nicht gegen die Doku geprüft (Doku von hier nicht erreichbar): bei Fehlern das Protokoll des Jobs lesen.
  - CI installiert online per `npm ci` (nicht aus `vendor/`).
- **Commit-Betreffzeilen sind der Changelog:** Fehlerbehebungen mit `Fix: …` beginnen oder „behoben“/„Fehler“ nennen, dann landen sie unter „Behobene Fehler“, alles andere unter „Neue Funktionen“. Reines `docs:`/`chore:`/`ci:`/`test:` oder `[skip changelog]` taucht nicht auf. Dafür kurze, für Anwender verständliche Betreffzeilen schreiben. Bei Squash-Merge zählt der **PR-Titel**.
- **Release-Notizen** (`release-notes/v<version>.md`) werden vor jedem Tag-Push gemeinsam mit dem Nutzer durchgesehen (Claude schlägt vor, der Nutzer gibt frei).
- **Dokumentation (statische Seiten):** `make docs` baut Handbuch (`docs/`, ein Deck mit Lesemodus), alle Beispiele und die Startseite (`scripts/docs-landing.ts`) nach `public/`. Die Startseite liest die Quelltexte der Live-Beispiele aus dem Handbuch (`scripts/build-docs.ts`), sie können nicht abweichen. Die Download-Karten brauchen `HASHMARK_PROJECT_URL`; `pages.yml` setzt sie selbst.
- **Git:** Remote ist GitHub (`goerks/Hashmark`). Das Repo ist klein, weil `vendor/` (Node, npm-Cache, ca. 125 MB) nicht eingecheckt ist (GitHub-Limit: 100 MB pro Datei).
- **Regel:** keine großen Binärdateien ins Repo, auch keine Build-Ergebnisse (`dist-go/`, `export/` sind ignoriert). Es werden **nie Installer** erzeugt, die App ist immer standalone.
