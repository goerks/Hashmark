---
name: analyse
description: Hinterfragt ein Ticket und erarbeitet Varianten mit Bewertung, je einem Design-Vorschlag und einer klaren Empfehlung. Läuft vor jeder Umsetzung, die Verhalten, Syntax oder Aussehen festlegt. Claude benutzt es selbst.
---

# /analyse <#ticket>

Entscheidungsgrundlage für den Auftraggeber, bevor Branch und Code entstehen. Regeln: `.claude/rules/git-workflow.md`. Der Auftraggeber bleibt fachlich: Das Ergebnis ist verständlich ohne Quelltext-Kenntnis.

1. **Ticket und Bestand lesen.** Ticket, Handbuch (`docs/`), Regeln (`.claude/rules/`) und den betroffenen Code prüfen: Was gibt es schon, wo hängt die Funktion an (Parser, Render, Runtime, Presenter, Exporte, Desktop, Webdienst)? Vermutungen als solche kennzeichnen, Nachgeprüftes von Angenommenem trennen.
2. **Anforderung hinterfragen:**
   - Welches Problem steckt hinter der Lösung im Ticket? Gibt es einen billigeren oder besseren Weg?
   - Steckt mehr als ein Thema im Ticket? Schnitt in getrennte PRs oder Tickets vorschlagen.
   - Was ist schon heute möglich (Umweg), was widerspricht den harten Regeln (offline, keine CDNs, keine Binärdateien im Repo)?
   - Was fehlt im Ticket, das beim Vortrag trotzdem auffallen würde (Presenter, PDF, PPTX, Handout, Desktop, Webdienst, Barrierefreiheit)?
3. **Varianten:** mindestens zwei, besser drei echte Alternativen. Je Variante: Idee in einem Satz, Syntax oder Bedienung, Vorteile, Nachteile, Folgen für die Exporte.
4. **Bewertung** je Variante nach: Nutzen im Vortrag · Passung zum Baum- und Schrittmodell · Wirkung auf PDF/PPTX/Handout · Bedienung vom Presenter-Fenster aus · Aufwand · Risiko. Ampel oder 1 bis 5, mit Begründung in Worten.
5. **Design-Vorschlag je Variante** als Artifact (HTML, klickbar, im Look der Hashmark-Themes): Folienansicht, bei Bedarf Presenter-Ansicht und Zustände (vorher/nachher, Schritte). Kurz erklären, was man sieht. Nicht ins Repo einchecken.
6. **Empfehlung:** eine Variante, klar begründet, mit dem, was bewusst weggelassen oder in Folgetickets verschoben wird. Offene Entscheidungen als kurze Fragen an den Auftraggeber, jeweils mit eigener Empfehlung.
7. **Ablegen:** Zusammenfassung als Kommentar im Ticket (deutsch, ohne Git-Sprache), Link zum Entwurf dem Auftraggeber nennen. Danach auf die Entscheidung warten. Erst dann `/feature`.
