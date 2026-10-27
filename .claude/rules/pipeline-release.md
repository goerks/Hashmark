---
paths:
  - ".github/**"
  - "release-notes/**"
  - "scripts/release-notes.ts"
  - "scripts/build-docs.ts"
  - "scripts/docs-landing.ts"
  - "scripts/docs-features.ts"
  - "scripts/docs-site.ts"
  - "scripts/make-screenshots.ts"
  - "docs/**"
---

# Pipeline, Release und Dokumentations-Seiten

- **GitHub Actions (`.github/workflows/`):**
  - `ci.yml`: Vitest, Go-Hülle für 6 Ziele, Image-Probebau; bei Push auf `main` und bei jedem Pull Request.
  - `ci.yml`, Job `probe` (nur Pull Requests): Windows-Paket (`probe-windows`) und HTML-Datei des Beispiel-Decks mit Videoordner (`probe-html-demo`) als Artifacts (7 Tage), damit der Auftraggeber ohne Git ausprobieren kann (Actions › Lauf › Artifacts). Das Paket trägt die Version `pr<Nummer>.<Hash>`.
  - `ci.yml`, Job `editor-tour` (nur Pull Requests aus diesem Repository, `continue-on-error`): `scripts/editor-tour.ts` spielt den echten Editor mit einer Kopie von `abnahme/` durch (Edge/Chrome über CDP) und fotografiert jeden Schritt. Die Bilder liegen als Artifact `editor-tour` und auf dem Zweig `ci-galerie` (jeder Lauf löscht ihn und legt ihn neu an, er wird nie gemergt; so holt Claude die Bilder ab, weil Artifacts aus der Cloud-Umgebung nicht erreichbar sind). Der Rundgang gehört zum jeweils offenen Ticket: bei einem neuen Ticket mit sichtbarer Bedienung das Skript anpassen.
  - `release.yml`: bei einem Tag `v*`; 6 Standalone-Pakete → GitHub-Release mit Notizen aus `scripts/release-notes.ts` → `pages`.
  - `pages.yml`: GitHub Pages (auch per `workflow_call`).
  - `docker.yml`: Image nach ghcr.io bei Push auf `main`, danach Render-Deploy-Hook.
  - `docker.yml`, Jobs `preview` und `preview-cleanup` (nur PRs aus diesem Repository): Image `ghcr.io/<repo>:pr-<Nummer>-<commit>`, danach bei Render eine Vorschau-Instanz **desselben** Dienstes (API `POST /v1/services/{id}/preview`, Einstellungen des Dienstes, nur das Image-Tag ist anders; Secrets `RENDER_API_KEY`, `RENDER_SERVICE_ID`, ohne sie nur Bau). Frühere Vorschauen des PR werden vor dem Anlegen entfernt, beim Schließen gelöscht (Render löscht Image-Vorschauen nicht selbst). Die Vorschau zeigt die Abnahme-Präsentation (`abnahme/`, Image mit `--build-arg SEED=abnahme SEED_RESET=1`, `DECK_SEED_RESET` ersetzt den Deck-Ordner bei jedem Start) und unter `/webseite/` die komplette Webseite dieses Stands (vor dem Image gebaut, mit Bildern, per `build-contexts: webseite=…`, siehe `webdienst.md`). Die Adresse steht als Kommentar im PR. Live-Instanz und `latest` bleiben unberührt. Die Antwort der API ist nicht gegen die Doku geprüft (Doku von hier nicht erreichbar): bei Fehlern das Protokoll des Jobs lesen.
  - CI installiert online per `npm ci` (nicht aus `vendor/`).
- **Commit-Betreffzeilen sind der Changelog:** Fehlerbehebungen mit `Fix: …` beginnen oder „behoben“/„Fehler“ nennen, dann landen sie unter „Behobene Fehler“, alles andere unter „Neue Funktionen“. Reines `docs:`/`chore:`/`ci:`/`test:` oder `[skip changelog]` taucht nicht auf. Dafür kurze, für Anwender verständliche Betreffzeilen schreiben. Bei Squash-Merge zählt der **PR-Titel**.
- **Release-Notizen** (`release-notes/v<version>.md`) werden vor jedem Tag-Push gemeinsam mit dem Nutzer durchgesehen (Claude schlägt vor, der Nutzer gibt frei).
- **Dokumentation (statische Seiten):** `make docs` baut Handbuch (`docs/`, ein Deck mit Lesemodus), alle Beispiele, die Startseite (`scripts/docs-landing.ts`) und die acht Funktionsseiten `funktionen/<id>/` (`scripts/docs-features.ts`, Gerüst und Stil in `scripts/docs-site.ts`) nach `public/`. Die Startseite liest die Quelltexte der Live-Beispiele aus dem Handbuch (`scripts/build-docs.ts`), sie können nicht abweichen. Die Download-Karten brauchen `HASHMARK_PROJECT_URL`; `pages.yml` setzt sie selbst.
  - **Handbuch-Aufbau:** drei Teile in `docs/00-start.md` (Lernen, Themen, Nachschlagen), die Kapitel hängen per `mount … under:` darunter. **Knoten-IDs sind Pfade** (`themen/schritte/code-schritte`): Links auf das Handbuch (`?reader#…`, `?card#…`) immer mit dem ganzen Pfad. Die Themen heißen wie die Rubriken in `FEATURES` (Test). Die Tabellen in `docs/nachschlagen/01-syntax.md` müssen alle Layouts, Attribute, Container und Übergänge aus `src/core/vocab.ts` nennen (Test): Wer dort etwas ergänzt, ergänzt die Tabelle.
  - **Funktionsseiten:** `FEATURES` hält Texte, Bilder, eingebettete Folien und Handbuch-Verweise; `cardSteps` (build-docs.ts) prüft beim Bau und im Test, dass jede Folie und jeder Verweis existiert.
  - **Bilder:** `SHOTS` (docs-features.ts) ist die Liste der Aufnahmen. `scripts/make-screenshots.ts --out <dir>` nimmt alle auf (Folien per `?card`, Lesemodus, Druckansicht, Übersicht per Taste O, Presenter-View, Editor über `hashmark edit`), `build-docs.ts` nimmt sie über `HASHMARK_SHOTS` mit. `pages.yml` und der CI-Job `docs` tun das bei jedem Bau, die Bilder liegen also **nicht** im Repository. Ohne `--out` nimmt das Skript nur die vier Bilder der README nach `assets/screenshots` auf. Fehlt ein Bild, zeigt die Seite die echte Folie (`fallbackUrl`).
  - **CI-Job `docs`:** baut die Webseite wie Pages; bei Pull Requests als Download `probe-webseite` mit `Webseite ansehen.cmd` (PowerShell-Server `scripts/webseite-ansehen.ps1`, die Iframes brauchen einen Server).
- **Git:** Remote ist GitHub (`goerks/Hashmark`). Das Repo ist klein, weil `vendor/` (Node, npm-Cache, ca. 125 MB) nicht eingecheckt ist (GitHub-Limit: 100 MB pro Datei).
- **Regel:** keine großen Binärdateien ins Repo, auch keine Build-Ergebnisse (`dist-go/`, `export/` sind ignoriert). Es werden **nie Installer** erzeugt, die App ist immer standalone.
