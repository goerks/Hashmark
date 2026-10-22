# Git-Workflow: Feature-Branch und Pull Request

Gilt immer, für jede Änderung. Ausführlich für Menschen: `CONTRIBUTING.md`.

- **Nie direkt auf `main` committen oder pushen.** Jede Änderung entsteht auf einem Branch und kommt per Pull Request nach `main`. Ein Hook (`.claude/hooks/schutz-main.sh`) blockiert Commit/Push auf `main` und Force-Push.
- **Branch-Namen:** `feat/<thema>`, `fix/<thema>`, `docs/<thema>`, `chore/<thema>` (klein, mit Bindestrichen). Skill `/feature <thema>` legt ihn von aktuellem `main` an.
- **Ein Thema pro PR.** Lieber mehrere kleine als ein großer.
- **PR-Titel = Changelog-Zeile.** `release-notes.ts` wertet Betreffzeilen aus (siehe `pipeline-release.md`): kurz, deutsch, für Anwender verständlich; Fehlerbehebungen mit `Fix: …`; Reines `docs:`/`chore:`/`ci:`/`test:` oder `[skip changelog]` taucht nicht im Changelog auf. Gemergt wird per **Squash**, dann wird der PR-Titel zur Betreffzeile auf `main`.
- **Vor dem PR:** `make test`; bei Änderungen an Decks/Syntax zusätzlich `make check`; bei UI-Änderungen im Browser prüfen (Edge headless/CDP) und in der PR-Beschreibung ehrlich sagen, was **nicht** getestet werden konnte. Bei Doku-Änderungen `make docs` bauen.
- **Doku mitziehen:** Ändert sich Verhalten für Anwender, gehört die Änderung ins Handbuch (`docs/`), nicht ins README. Entwickler-Wissen gehört in `.claude/rules/` bzw. `CONTRIBUTING.md`.
- **Wann Claude aktiv wird:**
  - Branch anlegen und im Branch committen: auf Zuruf des Nutzers (z. B. „commit“). Ein „commit“ gilt nur für die **bereits vorhandenen** Änderungen, nie für Arbeit, die danach entsteht.
  - `git push` und PR öffnen (`/pr`) wirken nach außen: nur nach ausdrücklichem Auftrag. Merge macht der Nutzer.
  - Vor jedem Umschreiben der Historie prüfen, ob die Commits schon im Remote liegen.
- **Merge nach `main` deployt:** `docker.yml` ruft den Render-Deploy-Hook auf, `pages.yml` veröffentlicht die Doku. Deshalb nichts Ungetestetes mergen.
- **Fremde Änderungen im Arbeitsbaum** (der Nutzer arbeitet parallel im Deck) vorher ansehen und erwähnen, nicht verwerfen.
