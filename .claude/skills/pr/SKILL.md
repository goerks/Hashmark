---
name: pr
description: Macht den Pull-Request fertig zur Abnahme: prüft (Tests, Doku), pusht, setzt Beschreibung und Abnahmehinweis. Claude benutzt es selbst, mergt aber nie ohne ausdrückliche Freigabe des Auftraggebers.
---

# /pr

Bringt die Arbeit am aktuellen Ticket in einen abnahmefähigen Zustand. Regeln: `.claude/rules/git-workflow.md`. Der Auftraggeber ruft das nicht auf. Er bekommt am Ende nur eine fachliche Abnahmemeldung.

1. **Ausgangslage:** `git status -sb`, `git log --oneline main..HEAD`, `git diff --stat main...HEAD`. Auf `main`? Abbrechen und `/feature` ausführen. Uncommittete Änderungen committen (deutsche Betreffzeile).
2. **Prüfen:**
   - `make test` immer (Node: `export PATH="$PWD/vendor/node:$PATH"`, Befehle über `make`).
   - Berührt die Änderung `docs/`, `scripts/docs-landing.ts` oder `scripts/build-docs.ts`: `make docs`.
   - Berührt sie Decks oder die Syntax: `make check`.
   - UI-Änderungen im Browser ansehen (Edge headless/CDP).
   - Fehlschläge selbst beheben. Nicht pushen, solange Tests rot sind, außer es wird fachlich entschieden.
3. **Push:** `git push -u origin <branch>` (bei Netzfehlern bis zu vier Wiederholungen mit 2/4/8/16 s Pause).
4. **PR aktualisieren** (Titel, Beschreibung nach `.github/pull_request_template.md`, `Closes #<Nr>`), per GitHub-MCP (`create_pull_request` bzw. `update_pull_request`, in Cloud-Umgebungen gibt es kein `gh`). Titel = Changelog-Zeile (deutsch, für Anwender verständlich, `Fix: …` bei Fehlern, Präfix `docs:`/`chore:`/`ci:`/`test:` für Reines). Den PR aus dem Entwurf nehmen. Die CI muss grün sein.
5. **Abnahme-Präsentation** in `abnahme/` schreiben bzw. aktualisieren (Regeln: `.claude/rules/git-workflow.md`, Schritt 6), pushen und warten, bis die Pipeline die Vorschau angelegt hat (Kommentar im PR). **Abnahme melden**, ohne Git-Begriffe, mit der Adresse der Vorschau:
   - Was ist neu (Ticket #…).
   - **So probierst du es aus** (3 bis 6 Schritte, Beispiel-Deck nennen).
   - **Nicht getestet:** was Claude nicht prüfen konnte.
6. **Nicht mergen**, bevor der Auftraggeber ausdrücklich freigibt. Dann `abnahme/` auf den Ruhezustand zurücksetzen und pushen, danach: Squash-Merge über `merge_pull_request` (`merge_method: squash`), Ticket prüfen (geschlossen), kurz melden. Bei Änderungswünschen auf demselben PR weiterarbeiten und erneut abnehmen lassen.
