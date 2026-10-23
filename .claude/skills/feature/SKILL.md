---
name: feature
description: Startet die Arbeit an einem Ticket: Branch von aktuellem main und Entwurfs-Pull-Request. Claude benutzt es selbst, der Auftraggeber muss es nicht aufrufen. Aufruf mit /feature <Ticketnummer oder Thema>.
---

# /feature <#ticket | thema>

Startet Arbeit immer auf einem eigenen Branch mit Ticket und Entwurfs-PR. Regeln: `.claude/rules/git-workflow.md`. Der Auftraggeber bleibt fachlich: nichts davon verlangt eine Entscheidung von ihm.

1. **Ticket klären.** Mit Nummer: Ticket lesen (`issue_read`). Ohne Ticket: zuerst eins nach `.github/ISSUE_TEMPLATE/auftrag.md` anlegen (vorher `search_issues` auf Dubletten) und die Nummer nennen.
2. **Art und Namen bestimmen:** `feat` (neue Funktion), `fix` (Fehler), `docs` (nur Doku), `chore` (Aufräumen, Tooling). Name klein, mit Bindestrichen, ohne Umlaute: `feat/video-und-bildzoom`. Gibt die Umgebung einen Branch vor, diesen nehmen.
3. **Arbeitsbaum ansehen:** `git status -sb`. Fremde Änderungen (der Auftraggeber arbeitet parallel im Deck) nie verwerfen, kurz erwähnen.
4. **Branch anlegen:** von aktuellem `main` (`git fetch origin main`, `git checkout -b <branch> origin/main`). Gehören schon Commits auf dem Branch zum Thema, bleiben sie.
5. **Entwurfs-PR öffnen**, sobald es einen ersten Commit gibt: Titel = Changelog-Zeile, Beschreibung nach Vorlage mit `Closes #<Nr>`. Danach umsetzen (siehe `/pr` für den Abschluss).
6. **Meldung an den Auftraggeber:** ein Satz in Ticketsprache („Ich arbeite an #4“), keine Branch-Namen nötig.
