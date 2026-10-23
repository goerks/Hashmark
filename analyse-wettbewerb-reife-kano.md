# Hashmark: Wettbewerb, Reifegrad, Kano-Merkmale

Stand: 23.10.2026 · Version 0.2.0 · Grundlage: Quellcode, Regeln in `.claude/rules/`, Handbuch, Roadmap und Tests des Repositorys.

**Wie belastbar ist das?**

- Die Aussagen zu Hashmark stammen aus dem Code und der Doku. Die Testsuite (rund 190 Vitest-Fälle) wurde hier **nicht ausgeführt**, weil in der Umgebung Node 22 statt 24 liegt und `vendor/` fehlt. Der Reifegrad beruht also auf Code, Tests im Repo und Doku, nicht auf einem Lauf.
- Die Aussagen zur Konkurrenz stammen aus meinem Wissen (bis Mitte 2026), nicht aus einer Live-Recherche. Vor einer Veröffentlichung bitte stichprobenartig prüfen, vor allem Versionen und Preise.

---

## 1. Vergleich mit der Konkurrenz

### Wer konkurriert womit?

| Gruppe | Tools | Was sie mit Hashmark teilen |
| --- | --- | --- |
| **Direkt:** Markdown → Slides | reveal.js (+ Quarto), Marp, Slidev, Pandoc/Beamer, Deckset, Obsidian „Advanced Slides“ | Quelle ist Text, Git-tauglich, Export als HTML/PDF |
| **Indirekt: nicht-linear** | Prezi, PowerPoint „Zoom“/Abschnitte, Miro/Mural-Präsentationen, Obsidian Canvas | Man will nicht an eine Folienreihenfolge gebunden sein |
| **Indirekt: Standard und KI** | PowerPoint, Keynote, Google Slides, Canva, Gamma, Pitch, Beautiful.ai | Die Zielgruppe landet am Ende doch dort, auch als Austauschformat |

### Was Hashmark besser kann

| Stärke | Warum das zählt | Wer es nicht hat |
| --- | --- | --- |
| **Navigierbarer Baum als Kernmodell** (→ weiter, ↓ Detail, ↑ zurück) | Details liegen unter ihrem Kapitel. Backup-Folien am Ende und „Suchen unter Druck“ entfallen. Das Modell steckt im Datenmodell, nicht nur in einem Plugin. | reveal.js hat vertikale Folien (nur 2 Ebenen, ohne Plan). Marp und Slidev sind linear. Prezi ist räumlich, aber kein Text. |
| **Vortragsplan mit Zeitbudget** (Pfad, Optional, Anhang, Ausflug, benannte Fahrpläne, PDF folgt dem Plan) | Live entscheiden, ohne die Quelle zu ändern. Leertaste führt nach einem Abstecher von selbst zurück. | Niemand. Auch PowerPoint kennt nur „ausgeblendete Folie“ und „benutzerdefinierte Show“. |
| **Presenter-View mit Baum, Timer, Plan** | Zeigt, was unter der aktuellen Folie liegt. Funktioniert auch im Single-File-Export. | reveal.js hat Notizen und Timer, aber keinen Baum. Marp hat keine Presenter-View. |
| **Bearbeitbarer PPTX-Export mit Animationen** | Firmen verlangen oft eine PowerPoint-Datei. Schritte werden zu Animationen, Text bleibt Text. | Marp hat PPTX, aber meist als Bild-Folien. Slidev und reveal.js haben keinen echten Export. |
| **Offline, ohne Installer, ohne Konto** (kleine Go-Hülle, keine CDNs) | Passt zu Firmen- und Hochsicherheitsumgebungen. Ein Ordner, doppelklicken. | Slidev und Quarto brauchen Node bzw. Python/Quarto-Installation. Online-Tools brauchen Konto. |
| **Eigener Editor, der nur Markdown schreibt** (Autocomplete, Linter, Palette, Live-Vorschau mit Sync) | Der Einstieg ist niedriger als bei „VS Code + Plugin“. Hashmark-Syntax wird erklärt und geprüft. | Marp und Slidev leben von VS Code. reveal.js hat keinen. |
| **`hashmark check`** (Layouts, Attribute, Überlauf aller Folien per Browser) | Qualitätssicherung in CI. Erkennt Überlauf, bevor man auf der Bühne steht. | Kein Mitbewerber prüft den Überlauf automatisch. |
| **Gestaltungsbausteine ohne HTML** (Karten, Figuren mit Sprechblasen, Tabellen mit Schritten, Komponenten wie timeline, kpis, pyramid) | „Hübsch“ ohne CSS-Wissen. Komponenten sind logikfreie HTML-Vorlagen und damit sicher. | Marp braucht CSS. Slidev braucht Vue. |
| **Technische Inhalte** (Shiki mit Zeilen-Schritten, Mermaid mit Schritten, KaTeX mit Teilformeln, Excalidraw/draw.io-Ebenen als Schritte) | Schritt-für-Schritt-Aufbau von Diagrammen und Code ist ein Kernbedarf technischer Vorträge. | Slidev hat Ähnliches, reveal.js braucht Handarbeit. |
| **Lese- und Handout-Modus** (Baum als Inhaltsverzeichnis, Notizen als Fließtext) | Das Handbuch ist selbst ein Deck. Ein Dokument aus derselben Quelle. | Quarto kann das, aber nicht mit Baumnavigation. |

### Was Hashmark klar schlechter kann

| Schwäche | Wirkung | Wer es besser macht |
| --- | --- | --- |
| **Lizenz: PolyForm Noncommercial** | Firmen dürfen es nicht einsetzen, Beiträge und Plugins sind unattraktiv. Das ist die größte Hürde für ein Ökosystem. | reveal.js, Marp, Slidev: MIT |
| **Kein Plugin-/Erweiterungs-API** | Neue Diagrammsprachen und Komponenten nur im Kern. Komponenten sind bewusst logikfrei. | Slidev (Vue, Addons), reveal.js (Plugins) |
| **Kein Ökosystem** (Version 0.2.0, ein Autor, deutsche Doku und UI, 2 Themes, 4 Beispiele) | Keine Theme-Galerie, keine Community, kaum Suchtreffer, keine Vorlagen. | Alle direkten Konkurrenten |
| **Nur 2 Themes** (`minimal`, `dark-tech`), kein Hell/Dunkel-Umschalter, kein Corporate-Import | Für Firmenvorträge fehlt Logo, Fußzeile aus Vorlage, Markenfarben. Der PPTX-Export erzeugt nur ein Layout statt Folienmaster. | Marp und Slidev haben viele Themes. PowerPoint sowieso. |
| **Animationen** (nur Schritte und räumliche Übergänge; kein Auto-Animate, Magic Move, Zoom aus Kachel) | Wirkt gegen Keynote, Slidev („Magic Move“) und Prezi weniger beeindruckend. | Slidev, Keynote, Prezi |
| **Live-Funktionen fehlen** (Publikum folgt, Handy als Fernbedienung, Zeichnen/Laser, Umfragen) | Bei Remote-Vorträgen bleibt nur „Fenster teilen“. | Slidev (Drawing, Recording), Pitch, Google Slides |
| **Barrierefreiheit** (kein Alt-Text-Check, kein Kontrast-Check, Lesereihenfolge ungeprüft) | Für Behörden und große Firmen oft Pflicht. | PowerPoint (Prüfer) |
| **Linux und macOS sind ungetestet** (kompiliert, nie gelaufen), Paket nur für Windows | Die Aussage „Standalone für Windows, Linux, macOS“ im README ist ein Versprechen, das nicht belegt ist. | Alle Web-Tools |
| **Abhängigkeit von Edge/Chrome** für PDF, PPTX und Überlaufprüfung, Node ≥ 24 für CLI | Auf Servern und in CI nötig, auf Zielrechnern nicht immer da. | Marp (PDF über Chrome ebenfalls), Quarto |
| **Kein Import** (PPTX, Marp, reveal) | Migration von Bestandsfolien nur von Hand. | Pandoc, Gamma (PPTX-Import) |
| **Keine Includes, kein Video/Embed, kein Bild-Zoom** | Typische Vortragsinhalte (Demo-Video, Code aus dem Repo) gehen nur umständlich. | Slidev, reveal.js, Quarto |
| **Keine KI-Unterstützung** | Gamma, Canva, Pitch erzeugen Decks aus einem Prompt. | Gamma, Canva, Pitch |
| **Zusammenarbeit nur über Git** (Webdienst mit einem gemeinsamen Passwort, kein Mehrbenutzer-Editor) | Fachabteilungen ohne Git bleiben außen vor. | Google Slides, Pitch |

### Einordnung in einem Satz

Hashmark ist bei **Erzählstruktur und Live-Steuerung** (Baum, Plan, Presenter) Spitze, bei **Breite** (Themes, Animation, Ökosystem, Live-Funktionen, Barrierefreiheit) deutlich hinter reveal.js, Slidev und PowerPoint, und die **Lizenz** bremst alles, was Verbreitung braucht.

---

## 2. Features und Reifegrad

Bewertung: **A** = ausgereift (Tests, Doku, mehrfach im Einsatz), **B** = nutzbar, mit bekannten Lücken, **C** = Grundlage da, überarbeiten oder ausbauen, **D** = fehlt oder nicht belegt.
Der Belegtext nennt Tests und Fundstellen. „Test“ meint Vitest-Fälle im Repo (`tests/…`).

### Kern: Inhalte und Struktur

| Feature | Stufe | Beleg und Anmerkung |
| --- | --- | --- |
| Markdown → Baum, Mehrdateien, `under`-Mounts, `deck.yaml` | **A** | `parse.ts`, `deck.ts`; 57 Tests in `core.test.ts` |
| Überschriften-Attribute, Container-Syntax (`:::`), Sub-Slides (`---`) | **A** | `syntax.ts`; Fallstricke dokumentiert |
| Navigator (next/prev/up/down, Deep-Links, Hot-Reload-Relocate) | **A** | reine State-Machine, `navigator.ts` |
| Vortragsplan (Pfad/Optional/Anhang, Ausflug, Fahrpläne, Zeitbudget) | **A** | 35 Tests in `plan.test.ts`; Offen: Priorität je Knoten, Fahrplan-Auswahl beim Start |
| Schritte (Listen, Code-Zeilen, Mermaid-Versionen, SVG-Ids, `reveal`) | **A** | Mehrere Wege, einheitliche Nummerierung |
| Suche (Strg+K, unscharf, Umlaute gefaltet), Übersicht | **A** | `search.ts` |
| Layouts (17 eingebaute, je Ebene vorgebbar) | **B** | Vielfalt gut; Layouts bei Überlauf nur per Auto-Fit abgefangen |
| Gestaltungsbausteine (cards, figure, table, aside, 9 Komponenten) | **B** | 18 Tests in `gestaltung.test.ts`; Komponenten logikfrei (Grenze bewusst) |
| Komponenten-System (eigene HTML-Vorlagen) | **B** | Sicher und getestet, aber ohne Logik und ohne Paketierung |
| Formeln (KaTeX) mit Schritten | **A** | 14 Tests; offline gebündelt |
| Diagramme (Mermaid, Themenfarben, Schritte, `look=hand`) | **B** | Rendert erst im Client; nur Mermaid (andere Sprachen fehlen) |
| Excalidraw/draw.io-Import als Schritte | **B** | 12 Tests; Format-abhängig (Szene in `<metadata>`) |
| Bilder, QR-Codes, Hintergründe, Bildband | **B** | Kein Zoom, kein Video, kein Embed |
| Hinweiskästen (`> [!NOTE]`), Notizen pro Folie und Schritt | **A** | |

### Präsentieren

| Feature | Stufe | Beleg und Anmerkung |
| --- | --- | --- |
| Präsentation (Vollbild, Übergänge slide/zoom/fade/none) | **A** | `reduced-motion` laut Roadmap noch Pflichtpunkt, im Code zu prüfen |
| Presenter-View (Notizen, Timer, Zeitplan, Mini-Baum, Plan-Panel) | **A** | `presenter-link.ts` (BroadcastChannel / postMessage), auch `file://` |
| Zwei Bildschirme, Monitorwahl | **B** | Windows getestet; Linux/macOS nie gelaufen |
| Lesemodus / Handbuch-Ansicht | **A** | `?reader`, `CardView` |
| Notiz-Overlay (N), Bedienhilfen | **B** | |

### Editor

| Feature | Stufe | Beleg und Anmerkung |
| --- | --- | --- |
| CodeMirror 6, Vorschau mit Zeilen-Sync, Gliederung | **B** | Gliederung nur lesend |
| Autocomplete, Linter, Formatleiste, Palette (Strg+K) | **B** | `complete.ts`, `lint.ts` rein und getestet; Tablet-Tastenleiste vorhanden |
| Inspector, Formular für `deck.yaml` | **D** | Geplant (Stufe 1 des Editor-Ausbaus), nicht vorhanden |
| Outliner (Drag & Drop, Ebene höher/tiefer, dateiübergreifend) | **D** | Geplant (Roadmap Stufe 5) |
| Undo über Dateien, Autosave, Konfliktbehandlung | **C** | Nicht belegt; bei Webdienst mit mehreren Nutzern kritisch |

### Gestaltung und Themes

| Feature | Stufe | Beleg und Anmerkung |
| --- | --- | --- |
| Theme v2 (`extends`, Tokens, Layouts, CSS, Theme-Ordner) | **B** | Beispiel `theme-demo`; Ketten zwischen Theme-Ordnern fehlen |
| Eingebaute Themes | **C** | Nur `minimal`, `dark-tech`; kein Hell/Dunkel, kein Corporate |
| Auto-Fit, Überlaufanzeige | **B** | Fit skaliert bis 0,7; Miniatur-Hinweis im Presenter fehlt |
| Fußzeile, Folienzahl | **B** | |

### Ausgabe

| Feature | Stufe | Beleg und Anmerkung |
| --- | --- | --- |
| PDF (Tiefe, Schritte, Handout, Lesezeichen, Plan) | **B** | Braucht Edge/Chrome; Handout nur 1 Folie je Seite |
| Single-File-HTML, statischer Build | **A** | Funktioniert offline samt Presenter |
| PPTX-Export (Text, Listen, Code, Tabellen, Animationen) | **B** | 11 Tests; Pipeline über Browser-Extraktion, heuristisch; Diagramme und Dekoration als Bild, ein einziges Layout, keine Folienmaster, Kacheln nicht als Formen |
| `hashmark check` (statisch + Überlauf) | **A** | In CI nutzbar |

### Plattform und Betrieb

| Feature | Stufe | Beleg und Anmerkung |
| --- | --- | --- |
| Desktop-App Windows (Go-Hülle + Node-Sidecar, E2E headless) | **B** | Absturzprotokoll, Kaltstart-Optimierung; 12 Tests plus App-E2E; Stolpersteine mit WebView2/Antivirus dokumentiert |
| Desktop-App Linux/macOS | **C** | Nur kompiliert; Paketierung nur Windows |
| Webdienst (`hashmark serve`, Docker, Render) | **B** | Ein Passwort, Image lokal nie gebaut (nur in CI); jeder Merge auf `main` deployt die Live-Instanz |
| CI/Release (Tests, 6 Zielplattformen kompiliert, Pages, Docker, Release-Notizen) | **A** | Mit Tests der Release-Notizen |
| Handbuch als Hashmark-Deck, Beispielgalerie, Startseite | **A** | `docs.test.ts` |
| Barrierefreiheit | **D** | Nur Roadmap |
| Internationalisierung der Oberfläche | **D** | Alles deutsch (bewusst, aber begrenzt die Reichweite) |
| Plugin-API | **D** | Nur Roadmap |

### Zusammenfassung

- **Ausgereift (A):** Baum, Navigator, Vortragsplan, Schritte, Presenter-View, Suche, Formeln, Single-File-Export, `hashmark check`, CI und Doku.
- **Verbessern (B):** PPTX-Export, Layout-/Bausteinvielfalt, Themes v2, PDF/Handout, Editor-Assistenz, Windows-App, Webdienst.
- **Überarbeiten oder bauen (C/D):** Themes (Anzahl, Hell/Dunkel, Corporate), Editor-Inspector und Outliner, Linux/macOS, Mehrbenutzer im Webdienst, Barrierefreiheit, Plugin-API, Animation, Live-Funktionen.

**Auffälligkeiten beim Lesen**

- `roadmap.md` führt „Editor-Inspector/Autocomplete/Diagnose, Auto-Fit“ in Stufe 2. Autocomplete, Diagnose und Auto-Fit gibt es, der **Inspector fehlt**. Die Roadmap sollte das abbilden.
- Die README verspricht Standalone-Apps für Linux und macOS. Laut `desktop-go.md` und Roadmap sind sie nie gelaufen. Entweder testen oder das Versprechen abschwächen.
- Die Testabdeckung der Runtime-Seite (Svelte, Presenter, Editor) ist dünn: Die Tests prüfen den Kern, die UI wird per E2E-Skript (`app-e2e.ts`, Windows) und von Hand per CDP geprüft.

---

## 3. Finalize und Kano-Merkmale für die nächsten Tickets

Die Liste hat vier Kategorien. Die erste (**Finalize**) liegt vor Kano: Sie enthält nur, was Hashmark schon **zusagt, aber nicht ganz einlöst**. Danach folgen die neuen Merkmale nach Kano. Die Finalize-Punkte gehören zuerst erledigt, weil sie das Vertrauen in das Bestehende betreffen. Neue Funktionen, die darauf aufbauen, kommen danach.

**Was zählt als „Versprechen“?** Eine Zusage in der README, im Handbuch, in einem Kommentar oder ein ✅ in der Roadmap, das ein „Offen:“ nach sich zieht, oder eine Zusage, die sich im Code nicht belegen lässt. Die Quelle steht je Zeile.

- **Finalize:** Zugesagt, aber unvollständig oder ungeprüft. Kein Kano-Merkmal, sondern Schuld aus dem Bestand.
- **Basismerkmal:** Wird erwartet. Fehlt es, ärgert es. Vorhanden fällt es nicht auf.
- **Leistungsmerkmal:** Mehr davon ist besser, proportional zur Zufriedenheit.
- **Begeisterungsmerkmal:** Wird nicht erwartet, überrascht positiv, begründet eine Empfehlung.

Aufwand: **S** (Tage), **M** (1–3 Wochen), **L** (mehr), grob vom Code her geschätzt, nicht belastbar.

### Finalize: Zusagen einlösen

| ID | Titel | Zusage und Lücke | Quelle | Aufw. |
| --- | --- | --- | --- | --- |
| F1 | **Linux und macOS prüfen und Zusage anpassen** | Die README wirbt mit „Standalone-App für Windows, Linux und macOS“. Menü, Vollbild und Monitorwahl sind nur kompiliert und nie gelaufen. Das Handbuch sagt dagegen „noch wenig getestet“. Ziel: Headless-E2E je System in CI, bis dahin die README ehrlich formulieren. | README, `desktop-go.md`, Handbuch „App“ | M |
| F2 | **Pakete für Linux/macOS je System prüfen** | Der Release baut alle sechs Ziele mit `--online`, aber das Paket braucht je System ein eigenes Node und native npm-Pakete. Ob ein entpacktes Paket startet, ist nirgends geprüft (Rauchtest nach dem Packen). | Roadmap „Desktop-App“, `release.yml` | M |
| F3 | **`prefers-reduced-motion` in Präsentation und Übergängen** | Die Roadmap nennt es „Pflicht“. Im Code kommt die Abfrage nur im Editor-CSS vor, nicht in `src/runtime` für Übergänge und Schritte. | Roadmap „Animationen“ | S |
| F4 | **Vortragsplan: Priorität je Knoten und Fahrplan-Auswahl beim Start** | Beides steht unter „Offen“ des als fertig markierten Vortragsplans. Ohne Priorität wirft das Zeitbudget Knoten nur nach Reihenfolge raus. | Roadmap „Presenter-Modus“ | M |
| F5 | **Auto-Fit und Prüfung vervollständigen** | Offen: Miniatur-Hinweis bei Überlauf im Presenter, Prüfungen für Notizen und Schritte in `hashmark check`. | Roadmap „Layouts und Styles“ | S |
| F6 | **Theme v2: Hell/Dunkel und Ketten zwischen Theme-Ordnern** | Offen: Hell/Dunkel-Varianten, `extends` zwischen Theme-Ordnern. Die Roadmap verspricht außerdem Taste T für Hell/Dunkel (T ist heute für „alle Knoten“ belegt). | Roadmap „Themes“ | M |
| F7 | **Druck: Handout 2/3/6 pro Seite, Titelseite mit Baum, Gliederung als Text, `{print=false}`** | In der Roadmap als „Ergänzungen“ zum fast fertigen Druck genannt. `{print=false}` habe ich im Code nicht gefunden. Heute nur eine Folie pro Seite. | Roadmap „Druck“ | M |
| F8 | **PPTX: Lücken der Animationen schließen** | Offen: Gruppen innerhalb von SVG, Tabellenspalten, Codezeilen abdunkeln, andere Effekte als Einblenden. | Roadmap „Wettbewerbsbacklog 1“ | M |
| F9 | **PPTX: Folienmaster und Layouts aus dem Theme, Formen statt Hintergrundbild** | Der Export erzeugt ein einziges Layout mit Titel-Platzhalter. Kacheln, Karten und Rahmen liegen im Hintergrundbild, SVG ist ein Bild. Das schmälert „bearbeitbares PowerPoint“ (README). | Roadmap, README | L |
| F10 | **PPTX: fehlende Schriften erkennen und warnen** | Cascadia → Consolas ist abgedeckt, Web-Schriften nicht. Die Datei kann auf dem Zielrechner anders aussehen, ohne Hinweis. | Roadmap „Wettbewerbsbacklog 1“ | S |
| F11 | **Editor-Inspector** | Roadmap Stufe 2 führt „Inspector/Autocomplete/Diagnose“. Autocomplete und Diagnose gibt es, der Inspector (Layout, Übergang, Id, Klassen, `duration`) fehlt, ebenso das Formular für `deck.yaml`. | Roadmap „Editor“, Stufe 2 | M |
| F12 | **Formeln: `macros:` in der `deck.yaml`** | Die Roadmap nennt es offen. Im Code ist `macros: {}` fest leer (`math.ts`). | Roadmap „Wettbewerbsbacklog 3“ | S |
| F13 | **Publikum folgt live** | Das Handbuch sagt ausdrücklich „noch nicht umgesetzt“. Die Roadmap führt es unter Stufe 6 und unter Live-Funktionen. Es ist die größte offene Zusage der FAQ. | FAQ „Videokonferenz“, Roadmap | L |
| F14 | **Roadmap und Doku bereinigen** | Die Roadmap nennt das Layout `diagram` offen, es existiert aber (`vocab.ts`). Der Inspector steht unter „Stufe 2“ ohne Hinweis, dass er fehlt. Die Roadmap hat zwei „Stände“ (29.09. und später). Ziel: eine ehrliche Statusliste je Zeile. | `roadmap.md` | S |
| F15 | **UI-Tests in CI (Playwright-Smoke)** | Die Kernlogik ist getestet, Runtime und Editor nur per Windows-Skript und von Hand. Wer „funktioniert“ zusagt, braucht einen automatischen Beleg. | `runtime-editor.md`, `ci.yml` | M |

Reihenfolge innerhalb von Finalize: zuerst die billigen und ehrlichen Punkte (F3, F5, F10, F12, F14), danach F1/F2/F15 (Beleg), dann F4, F6, F7, F11, F8, zuletzt die großen F9 und F13.

### Basismerkmale (neu)

| ID | Titel | Nutzen und Begründung | Aufw. | Verw. |
| --- | --- | --- | --- | --- |
| B1 | **Lizenz klären** (z. B. MIT/Apache oder duale Lizenz mit kommerzieller Option) | Ohne firmentaugliche Lizenz kein Einsatz im Unternehmen, keine Beiträge. Reine Entscheidungs- und Doku-Aufgabe. | S | |
| B2 | **Barrierefreiheit in `hashmark check`**: Alt-Texte, Kontrast der Tokens, Lesereihenfolge, Sprachangabe | Behörden und Konzerne verlangen es. Passt zum vorhandenen Linter. | M | |
| B3 | **Mehr eingebaute Themes** (high-contrast, paper, blueprint, solarized) | Zwei Themes sind für den ersten Eindruck zu wenig. | M | F6 |
| B4 | **Bild-Zoom und Video/Embed** (lokale Videos, iframe nur mit Opt-in) | Typisches Vortragsmaterial. Offline-Regel beachten. | M | |
| B5 | **Includes** (`!include datei.md`, Codeauszug mit Zeilenbereich aus dem Repo) | Wiederverwendung und echter Code statt Kopien. | M | |
| B6 | **Undo, Autosave und Konfliktwarnung im Editor** (Webdienst: Änderung durch Dritte erkennen) | Datenverlust ist der schwerste Fehler. Besonders wegen des geteilten Passworts im Webdienst. | M | |
| B7 | **Englische Oberfläche und Doku** (UI-Texte in Sprachdateien, Handbuch übersetzen) | Voraussetzung für Reichweite jenseits des deutschsprachigen Raums. | L | |
| B8 | **PDF und PPTX ohne installierten Browser** (mitgeliefertes Chromium oder klare Fehlermeldung mit Anleitung) | Heute hängt der Export an Edge/Chrome. Auf Servern und gesperrten Rechnern scheitert er. | M | |
| B9 | **Kein Datenabfluss im Export**: Warnung, wenn Notizen im Klartext in HTML oder Build landen | Das Handbuch weist darauf hin, die App nicht. Wer ein Deck teilt, sollte es vorher sehen. | S | |

### Leistungsmerkmale (neu)

| ID | Titel | Nutzen und Begründung | Aufw. | Verw. |
| --- | --- | --- | --- | --- |
| L1 | **Outliner: Drag & Drop, Ebene höher/tiefer, Umbenennen, dateiübergreifend** | Der Baum ist das Kernmodell, also sollte man ihn auch direkt bearbeiten können. | L | F11 |
| L2 | **Plugin-API** für Diagrammrenderer, Container und Komponenten mit Logik, Cache per Inhalts-Hash | Voraussetzung für ein Ökosystem. Entkoppelt neue Sprachen vom Kern. | L | B1 |
| L3 | **Diagrammsprachen**: Graphviz (WASM), Vega-Lite/ECharts, Markmap; PlantUML/D2 nur optional | Technische Vorträge brauchen mehr als Mermaid. | L | L2 |
| L4 | **Diagramme aus Daten** (CSV/JSON einbinden) | Zahlen ohne Handarbeit. | M | L3 |
| L5 | **Corporate-Theme** (Logo, Fußzeile, Farben aus der Konfiguration) | Zweiter Schritt nach den Basis-Themes. Der Erfolg bei Firmen hängt daran. | M | F6 |
| L6 | **Animationen**: Schritt-Effekte (`fade-up`, `dim`, `highlight`), Zoom aus der Kachel, Auto-Animate (View Transitions), Magic Move für Code | Der räumliche Baum verspricht „Eintauchen“. Das sollte man sehen. | L | F3 |
| L7 | **Handy als Fernbedienung und Presenter-Ansicht** (Notizen, Timer, Navigation per QR-Code) | Häufiger Wunsch, ohne Zusatzhardware. Nutzt die vorhandene Presenter-Verbindung. | M | F13 |
| L8 | **Zeichnen, Laserpointer, Hervorheben** in der Präsentation | Standardfunktion der Konkurrenz. | M | |
| L9 | **Mehrbenutzer im Webdienst** (Konten oder Token je Person, Sperre/Merge je Datei) | Das gemeinsame Passwort genügt für ein Team nicht. | L | B6 |
| L10 | **VS-Code-Erweiterung** (Vorschau, Linter, Vorschläge aus `vocab.ts`/`complete.ts`) | Viele schreiben lieber im eigenen Editor. Der Kern liegt schon als reine Funktionen vor. | M | |
| L11 | **Deck-Vorlagen und Beispielgalerie erweitern** (Pitch, Konferenztalk, Schulung, Architektur-Review) | Senkt die Hürde für den ersten Wurf. | M | B3 |
| L12 | **Import-Pfade** (Marp/reveal-Markdown, später PPTX-Text) | Migration von Bestandsfolien. Der PPTX-Import wurde schon einmal gebaut und verworfen, hier nur der leichtere Weg. | M | |
| L13 | **Formeln als bearbeitbare PowerPoint-Formeln** (LaTeX → OMML) | Roadmap-Idee. Heute Bilder. | L | F9 |
| L14 | **Mehrsprachige Decks** (Texte je Sprache aus einer Quelle) | Folgt aus B7 und dem Baum: ein Deck, mehrere Sprachfahrpläne. | M | B7 |

### Begeisterungsmerkmale (neu)

Diese Punkte nutzen das, was nur Hashmark hat: Baum und Plan. Sie sind das Argument, warum jemand wechselt.

| ID | Titel | Nutzen und Begründung | Aufw. | Verw. |
| --- | --- | --- | --- | --- |
| D1 | **Publikumsvarianten aus einer Quelle**: 10-/30-/60-Minuten-Fahrplan als Export (PDF, PPTX, HTML), Handout je Fahrplan | Dasselbe Deck für Lightning-Talk und Workshop. Das kann sonst kein Tool. | M | F4 |
| D2 | **Live-Zeitassistent**: „Du liegst 4 Minuten hinten. Vorschlag: Kapitel X (optional) überspringen“, per Taste übernehmen | Macht aus Plan und Timer einen Coach. Die Daten gibt es schon. | M | F4 |
| D3 | **Fragen-Radar**: Frage tippen, Suche springt zum passenden Detailknoten und merkt den Ausflug; optional schickt das Publikum Fragen | Verwandelt „Fragen aus dem Publikum“ vom Risiko in eine Stärke. | M | F13 |
| D4 | **Vortragsprotokoll**: gezeigter Pfad, Zeiten je Knoten, übersprungene und abgetauchte Knoten | Probe und Auswertung in einem. Verbessert jeden nächsten Vortrag. | M | |
| D5 | **Probenmodus** mit Zeitmessung je Knoten und Kalibrierung der `duration` | Zeitangaben stimmen endlich. | M | D4 |
| D6 | **Karte statt Liste**: Übersicht als zoombare Baumlandkarte (auch fürs Publikum) | Verkauft die Baumidee auf einen Blick. | L | L6 |
| D7 | **Baum-Diff für Pull Requests**: Bot kommentiert „+2 Folien in Kapitel 3, Überlauf auf Folie 14“ mit Vorschau | Macht Git-Reviews von Präsentationen real. Nutzt `check` und die Druckansicht. | L | F15 |
| D8 | **PR-Vorschau als Webseite** (Deck je Branch als statische Seite) | Reviewer sehen das Ergebnis ohne Build. `pages.yml` ist die Vorlage. | S | |
| D9 | **KI-Assistent im Editor** (lokal oder eigener Schlüssel): Deck aus Gliederung erzeugen, Kürzung für ein Zeitbudget, Alt-Texte, Notizen | Gamma/Canva setzen die Erwartung. Hier bleibt das Ergebnis Markdown und diffbar. Mit Datenschutz-Opt-in. | L | B2 |
| D10 | **Deck als Werkzeug für Agenten** (CLI/MCP: Struktur lesen, Folie einfügen, `check` ausführen) | Passt zu Markdown als Quelle und zu `hashmark check`. | M | |
| D11 | **Untertitel/Transkript live** und Aufnahme mit Kamera-Overlay | Macht Remote-Vorträge zugänglicher. Offline-Regel beachten. | L | F13 |
| D12 | **Ein-Datei-Programm ohne Node** (Kern im WebView oder in Go) | Ein Binary pro System, ~15 MB, kein Sidecar. Starker Verkaufspunkt. | L | F1 |
| D13 | **Theme-Import aus PowerPoint** (Farben, Schriften, Logo aus `.potx`) | Corporate Design in Minuten. Ergänzt den Export. | L | L5, F9 |
| D14 | **Barrierefreie Ausgabe als Standard**: tagged PDF und barrierefreies HTML | Aus „B2 erfüllt“ wird „einfachster Weg zu barrierefreien Folien“. | M | B2 |

### Vorschlag zur Reihenfolge

1. **Finalize** zuerst, in der oben genannten Reihenfolge. Erst danach ist die Aussage „das ist fertig“ ehrlich.
2. **Basis:** B1 (Entscheidung), B6, B9, dann B2 bis B5, B8.
3. **Leistung:** L5, L1, L2, L6.
4. **Begeisterung:** D1, D2, D4/D5, D8 sind kleine bis mittlere Schritte, weil Plan, Timer und Baum schon vorhanden sind. D3 und D6 folgen mit F13.

### Hinweise für die Ticket-Erstellung

- Ein Label `Kano: Finalize|Basis|Leistung|Begeisterung` plus ein Bereichs-Label (Kern, Runtime, Editor, PPTX, Desktop, Webdienst, Doku). Die Quelle der Zusage bei Finalize-Tickets in die Beschreibung übernehmen.
- Vor dem Ticket einen kurzen Spike für alle mit Aufwand **L** (F9, F13, L1, L2, L6, D12).
- Jedes Ticket mit Akzeptanzkriterien, einem Test im Kern (`tests/core.test.ts`) und der Doku-Änderung im Handbuch (siehe `.claude/rules/git-workflow.md`). Der Titel eines Tickets sollte als PR-Titel (Changelog-Zeile) taugen.
- Gegenüber der ersten Fassung sind B2 (Linux/macOS), B3 (Reduced-Motion), B9 (Handout), B12 (Schriften), B14 (UI-Tests), L1 (Inspector), L8, L9, L11, L12 und L13 in Finalize aufgegangen (F1, F3, F7, F10, F15, F11, F9, F8, F4, F5, F12/F13).
