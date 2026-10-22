---
name: pr
description: Prüft den aktuellen Feature-Branch (Tests, Doku), pusht ihn und öffnet einen Pull Request nach main. Nur auf ausdrücklichen Auftrag.
---

# /pr

Bringt den aktuellen Branch per Pull Request nach `main`. Push und PR wirken nach außen: nur ausführen, wenn der Nutzer es verlangt hat. Regeln: `.claude/rules/git-workflow.md`.

1. **Ausgangslage:** `git status -sb`, `git log --oneline main..HEAD`, `git diff --stat main...HEAD`. Auf `main`? Abbrechen und auf `/feature` verweisen. Uncommittete Änderungen? Nachfragen, ob sie zuerst committet werden sollen.
2. **Prüfen:**
   - `make test` immer (Node: `export PATH="$PWD/vendor/node:$PATH"`, Befehle über `make`).
   - Berührt der Branch `docs/`, `scripts/docs-landing.ts` oder `scripts/build-docs.ts`: `make docs` bauen.
   - Berührt er Decks oder die Syntax: `make check`.
   - Fehlschläge ehrlich berichten und nicht pushen, bis der Nutzer entschieden hat.
3. **Titel:** Eine Zeile, deutsch, für Anwender verständlich, Changelog-tauglich. Fehlerbehebung: `Fix: …`. Reine Doku/Tooling: Präfix `docs:`/`chore:`/`ci:`/`test:` (taucht nicht im Changelog auf).
4. **Beschreibung** nach `.github/pull_request_template.md`: Zusammenfassung, Testplan (was lief, was **nicht** getestet werden konnte), Hinweise für den Review. Mit der Zeile `🤖 Generated with [Claude Code](https://claude.com/claude-code)` enden.
5. **Veröffentlichen:** `git push -u origin <branch>`, dann `gh pr create --base main --title "…" --body "…"`. Den Link der PR nennen. **Nicht mergen**: das macht der Nutzer (Squash).
   - Liegt `gh` nicht im `PATH`, aber als `./gh.exe` im Projektordner (lokal, in der `.gitignore`, nie einchecken), diese Datei benutzen.
   - Ist `gh` gar nicht vorhanden, nach dem Push Titel und Beschreibung ausgeben und den Link `https://github.com/goerks/Hashmark/compare/main...<branch>?expand=1` nennen; der Nutzer legt den PR dort an.
