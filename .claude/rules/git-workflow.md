# Arbeitsablauf: Ticket, Feature-Branch, Pull Request, Abnahme, Merge

Gilt immer, für jede Änderung. Ausführlich für Menschen: `CONTRIBUTING.md`.

## Rollen

- **Der Auftraggeber** (Produktverantwortliche:r) bleibt **fachlich**: Er schreibt oder bestätigt Aufträge, probiert das Ergebnis aus und gibt es frei. Er hat mit Branches, Commits, Pull Requests und Merges **nichts** zu tun und soll das nie tun müssen.
- **Claude** erledigt den gesamten technischen Ablauf selbstständig: Ticket, Branch, Commits, Push, Pull Request, Merge.

## Ablauf

1. **Auftrag = GitHub-Ticket.** Jede Änderung hat ein Ticket (Vorlage `.github/ISSUE_TEMPLATE/auftrag.md`: Ziel, Umfang, Akzeptanzkriterien, offene Fragen). Nennt der Auftraggeber eine Aufgabe ohne Ticket, legt Claude es zuerst an, sagt die Nummer und fragt bei echten Unklarheiten fachlich nach. Vor dem Anlegen mit `search_issues` auf Dubletten prüfen.
2. **Anforderung hinterfragen und Varianten analysieren** (Skill `/analyse`), bevor Branch und Code entstehen. Pflicht, sobald ein Ticket Verhalten, Syntax oder Aussehen festlegt; bei eindeutigen Fehlern genügt eine Zeile im Ticket. Inhalt:
   - **Hinterfragen:** Welches Problem steckt hinter der gewünschten Lösung? Was gibt es schon (Code und Handbuch prüfen)? Ist das Ticket zu groß oder mischt es Themen? Was fehlt, was sollte raus? Der Auftraggeber erwartet ausdrücklich Widerspruch, wo die beste Lösung anders aussieht.
   - **Mindestens zwei, besser drei Varianten.** Echte Alternativen, keine Ausbaustufen derselben Idee.
   - **Bewertung** nach festen Kriterien: Nutzen im Vortrag, Passung zum Baum- und Schrittmodell, Wirkung auf PDF/PPTX/Handout, Bedienbarkeit vom Presenter-Fenster, Aufwand, Risiko.
   - **Je Variante ein Design-Vorschlag**, den man ansehen kann (Artifact mit Entwurf, klickbar wo es hilft). Ohne Bild keine Variante.
   - **Klare Empfehlung** mit Begründung, und was dafür bewusst weggelassen wird. Schnitt des Tickets vorschlagen, wenn sinnvoll.
   - **Ergebnis ins Ticket** als Kommentar (Text, deutsch) und dem Auftraggeber den Entwurfslink nennen. Der Auftraggeber entscheidet Variante und Umfang. Erst danach geht es weiter.
3. **Feature-Branch von aktuellem `main`.** Namen: `feat/<thema>`, `fix/<thema>`, `docs/<thema>`, `chore/<thema>` (klein, Bindestriche, ohne Umlaute). Gibt die Umgebung einen Branch vor (z. B. `claude/…` in der Cloud), gilt dieser. Nie auf `main` committen oder pushen: Ein Hook (`.claude/hooks/schutz-main.sh`) blockiert Commit/Push auf `main` und Force-Push.
4. **Pull Request sofort öffnen** (Entwurf), mit `Closes #<Nr>` in der Beschreibung. **Ein Thema pro PR.**
5. **Umsetzen**, in kleinen Commits, laufend pushen. Vor der Abnahme: `make test`; bei Änderungen an Decks/Syntax `make check`; bei Doku `make docs`; bei UI im Browser prüfen (Edge headless/CDP). CI (`ci.yml`) muss grün sein.
6. **Abnahme durch den Auftraggeber.** Claude meldet in der Ticketsprache, nicht in Git-Sprache: was neu ist, **wie man es ausprobiert** (3 bis 6 Schritte, mit Beispiel-Deck) und **was nicht getestet werden konnte**. Findet der Auftraggeber etwas, behebt Claude es auf demselben PR und meldet erneut.
7. **Merge nur nach ausdrücklicher Freigabe** („passt“, „abgenommen“, „bitte mergen“ o. Ä.) und grüner CI. Claude führt den PR per **Squash** zusammen, danach schließt sich das Ticket (`Closes #…`). Schweigen, Lob oder eine Zwischenfrage sind keine Freigabe. Danach meldet Claude kurz: „Ticket #… ist umgesetzt und veröffentlicht.“

Ablauf in einem Satz: Ticket → Analyse mit Varianten und Entscheidung → Branch mit PR → Umsetzung → Abnahme durch den Auftraggeber → Merge durch Claude.

## Verhalten gegenüber dem Auftraggeber

- Keine Git-Begriffe, wo es auch fachlich geht: „Die Änderung ist zum Ausprobieren bereit“, nicht „Branch gepusht, PR offen“. Nummern und Links von Tickets dürfen genannt werden.
- Keine Rückfragen zu Branch-Namen, Commits, Pushs, Rebases oder Konflikten. Das entscheidet Claude. Konflikte und rote CI löst Claude selbst oder meldet sie fachlich („Ich brauche eine Entscheidung: …“).
- Rückfragen nur, wenn die Antwort das **Ergebnis** ändert (Verhalten, Namen von Anwenderfunktionen, Umfang).
- Fremde Änderungen im Arbeitsbaum (der Auftraggeber arbeitet parallel im Deck) vorher ansehen und erwähnen, nicht verwerfen.

## Titel und Doku

- **PR-Titel = Changelog-Zeile.** `release-notes.ts` wertet Betreffzeilen aus (siehe `pipeline-release.md`): kurz, deutsch, für Anwender verständlich; Fehlerbehebungen mit `Fix: …`; reines `docs:`/`chore:`/`ci:`/`test:` oder `[skip changelog]` taucht nicht im Changelog auf. Gemergt wird per Squash, dann wird der PR-Titel zur Betreffzeile auf `main`.
- **Doku mitziehen:** Ändert sich Verhalten für Anwender, gehört die Änderung ins Handbuch (`docs/`), nicht ins README. Entwickler-Wissen gehört in `.claude/rules/` bzw. `CONTRIBUTING.md`.
- **Merge nach `main` deployt:** `docker.yml` ruft den Render-Deploy-Hook auf, `pages.yml` veröffentlicht die Doku. Deshalb nichts Ungetestetes und nichts Unfreigegebenes mergen.

## Werkzeuge

- GitHub-Zugriff in der Cloud über die GitHub-MCP-Werkzeuge (`issue_write`, `create_pull_request`, `merge_pull_request` mit `merge_method: squash`). Die Befehlszeile `gh` gibt es dort nicht. Lokal ggf. `./gh.exe` (ignoriert, nie einchecken).
- Vorlagen: Ticket `.github/ISSUE_TEMPLATE/auftrag.md`, PR `.github/pull_request_template.md`.
- Vor jedem Umschreiben der Historie prüfen, ob die Commits schon im Remote liegen. Auf fremden Branches nie umschreiben, Force-Push ist blockiert.
