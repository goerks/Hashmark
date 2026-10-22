---
name: feature
description: Legt für ein neues Thema einen Feature-Branch von aktuellem main an (feat/fix/docs/chore). Aufruf mit /feature <thema>.
---

# /feature <thema>

Startet Arbeit immer auf einem eigenen Branch. Regeln: `.claude/rules/git-workflow.md`.

1. **Thema und Art bestimmen.** Aus dem Argument den Namen ableiten: Art `feat` (neue Funktion), `fix` (Fehler), `docs` (nur Doku), `chore` (Aufräumen, Tooling). Name klein, mit Bindestrichen, ohne Umlaute: `docs/readme-schaufenster`. Fehlt das Argument, kurz nachfragen.
2. **Arbeitsbaum ansehen:** `git status -sb`. Liegen unversionierte oder geänderte Dateien vor, dem Nutzer sagen, was es ist, und fragen, ob sie mit auf den neuen Branch sollen. Nichts verwerfen.
3. **Branch anlegen:**
   - Auf `main`: `git pull --ff-only` (falls ein Remote erreichbar ist), dann `git checkout -b <art>/<thema>`.
   - Auf einem anderen Branch: nachfragen, ob er der Ausgangspunkt sein soll oder von `main` abgezweigt wird.
4. **Ergebnis melden:** Branchname und Ausgangspunkt in einer Zeile. Noch nichts committen oder pushen.
