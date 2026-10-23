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

## 3. Kano-Merkmale für die nächsten Tickets

Zuordnung nach Kano, jeweils aus Sicht der Hauptzielgruppen (Entwickler:innen, die technisch vortragen; Teams, die ein Deck pflegen).

- **Basismerkmal:** Wird erwartet. Fehlt es, ärgert es. Vorhanden fällt es nicht auf.
- **Leistungsmerkmal:** Mehr davon ist besser, proportional zur Zufriedenheit.
- **Begeisterungsmerkmal:** Wird nicht erwartet, überrascht positiv, begründet eine Empfehlung.

Aufwand: **S** (Tage), **M** (1–3 Wochen), **L** (mehr). Das ist eine grobe Schätzung vom Code her, nicht belastbar. „Verw.“ verweist auf Abhängigkeiten.

### Basismerkmale

| ID | Titel | Nutzen und Begründung | Aufw. | Verw. |
| --- | --- | --- | --- | --- |
| B1 | **Lizenz klären** (z. B. MIT/Apache oder duale Lizenz mit kommerzieller Option) | Ohne klare, firmentaugliche Lizenz kein Einsatz im Unternehmen, keine Beiträge. Reine Entscheidungs- und Doku-Aufgabe. | S | |
| B2 | **Linux und macOS wirklich testen und paketieren**, CI-Lauf je System (Headless-E2E) | README verspricht es. Ohne Test ist es ein Risiko für das Vertrauen. | M | |
| B3 | **`prefers-reduced-motion` beachten**, Übergänge abschaltbar | In der Roadmap als „Pflicht“ markiert. Schutz für Nutzer mit Vestibularstörung. | S | |
| B4 | **Barrierefreiheits-Prüfung in `hashmark check`**: Alt-Texte, Kontrast der Tokens, Lesereihenfolge, Sprachangabe | Behörden und Konzerne verlangen es. Passt zum vorhandenen Linter. | M | |
| B5 | **Hell/Dunkel-Variante je Theme** und Umschalter (Taste T ist belegt, andere Taste nötig) | Räume und Projektoren unterscheiden sich. Standard in anderen Tools. | M | |
| B6 | **Mehr eingebaute Themes** (high-contrast, paper, blueprint, solarized) | Zwei Themes sind für einen ersten Eindruck zu wenig. | M | B5 |
| B7 | **Bild-Zoom und Video/Embed** (`![](video.mp4)`, iframe nur mit Opt-in) | Typisches Vortragsmaterial. Offline-Regel beachten (lokale Dateien). | M | |
| B8 | **Includes** (`!include datei.md`, Codeauszug mit Zeilenbereich aus dem Repo) | Wiederverwendung und echter Code statt Kopien. Üblich in Konkurrenzprodukten. | M | |
| B9 | **Handout 2/3/6 pro Seite und Titelseite mit Baum** | Standard bei gedruckten Unterlagen, in der Roadmap vorgemerkt. | M | |
| B10 | **Undo/Autosave/Konfliktwarnung im Editor** (Webdienst: Änderung durch Dritte erkennen) | Datenverlust ist der schwerste Fehler. Besonders wegen des geteilten Passworts im Webdienst. | M | |
| B11 | **Englische Oberfläche und Doku** (i18n der UI-Texte, Handbuch übersetzen) | Voraussetzung für Reichweite jenseits des deutschsprachigen Raums. Code bleibt, Texte wandern in Sprachdateien. | L | |
| B12 | **Fehlende Systemschriften im PPTX-Export** erkennen und warnen, Schriften einbetten | Wenn der Zielrechner die Schrift nicht hat, sieht die Datei anders aus. Das ist ein Vertrauensbruch. | S | |
| B13 | **PDF/PPTX ohne installierten Browser** (mitgelieferte Chromium-Variante oder klare Fehlermeldung mit Anleitung) | Heute hängt der Export an Edge/Chrome. Auf Servern und gesperrten Rechnern scheitert er. | M | |
| B14 | **UI-Tests für Runtime und Editor in CI** (Playwright-Smoke: starten, navigieren, Presenter, Export) | Die Kernlogik ist getestet, die Oberfläche nicht automatisch. Verhindert Rückfälle. | M | |

### Leistungsmerkmale

| ID | Titel | Nutzen und Begründung | Aufw. | Verw. |
| --- | --- | --- | --- | --- |
| L1 | **Editor-Inspector** für den Knoten unter dem Cursor (Layout, Übergang, Id, Klassen, `duration`, Plan-Rolle) | Schreibt Markdown, kein WYSIWYG. Senkt den Einstieg, passt zur Grundregel. | M | |
| L2 | **Formular für `deck.yaml`** mit Prüfung | Heute reine Textarbeit. Fehler (Theme, Mounts) fallen spät auf. | M | L1 |
| L3 | **Outliner: Drag & Drop, Ebene höher/tiefer, Umbenennen, dateiübergreifend** | Der Baum ist das Kernmodell, also sollte man ihn auch direkt bearbeiten können. | L | |
| L4 | **Plugin-API** für Diagrammrenderer, Container und Komponenten mit Logik, mit Cache per Inhalts-Hash | Voraussetzung für ein Ökosystem. Entkoppelt neue Sprachen vom Kern. | L | B1 |
| L5 | **Diagrammsprachen** Graphviz (WASM), Vega-Lite/ECharts, Markmap; PlantUML/D2 nur optional | Technische Vorträge brauchen mehr als Mermaid. | L | L4 |
| L6 | **Diagramme aus Daten** (CSV/JSON einbinden, Diagramm aus Tabelle) | Zahlen ohne Handarbeit. | M | L5 |
| L7 | **Corporate-Theme** (Logo, Fußzeile, Farben aus der Konfiguration) und **Theme-Ketten** (`extends` über Ordner) | Zweiter Schritt nach den Basis-Themes. Der Erfolg bei Firmen hängt daran. | M | B5 |
| L8 | **PPTX: Folienmaster und Layouts aus dem Theme**, Kacheln/Karten/Rahmen als echte Formen, SVG als Vektor | Heute ein einziges Layout. Erst damit lässt sich die Datei in Firmenvorlagen weiterbearbeiten. | L | L7 |
| L9 | **PPTX-Animationen vervollständigen** (Gruppen in SVG, Tabellenspalten, Codezeilen abdunkeln) | Schließt die in der Roadmap genannten Lücken. | M | |
| L10 | **Animationen**: Schritt-Effekte (`fade-up`, `dim`, `highlight`), Zoom aus der Kachel, Auto-Animate (View Transitions), Magic Move für Code | Der räumliche Baum verspricht „Eintauchen“. Das sollte man sehen. | L | B3 |
| L11 | **Zeitbudget mit Priorität je Knoten** und Fahrplan-Auswahl beim Start | Offene Punkte des Vortragsplans, direkter Mehrwert. | M | |
| L12 | **Presenter: Miniatur-Hinweis bei Überlauf**, Prüfungen für Notizen und Schritte in `check` | Ergänzt die vorhandene Überlaufprüfung. | S | |
| L13 | **Live-Folgen für das Publikum** (WebSocket oder WebRTC, Link/QR) | Ersetzt „Fenster teilen“ bei Remote-Vorträgen. Heute offener Punkt in der FAQ. | L | |
| L14 | **Handy als Fernbedienung und Presenter-Ansicht** (Notizen, Timer, Navigation per QR-Code) | Häufiger Wunsch, ohne Zusatzhardware. Nutzt die vorhandene Presenter-Verbindung. | M | L13 |
| L15 | **Zeichnen/Laserpointer/Hervorheben** in der Präsentation | Standardfunktion in Konkurrenzprodukten. | M | |
| L16 | **Mehrbenutzer im Webdienst** (Konten oder Token je Person, Sperre/Merge je Datei) | Das gemeinsame Passwort genügt für ein Team nicht. | L | B10 |
| L17 | **VS-Code-Erweiterung** (Vorschau, Linter, Vorschläge aus `vocab.ts`/`complete.ts`) | Viele schreiben lieber im eigenen Editor. Kern ist schon als reine Funktionen vorhanden. | M | |
| L18 | **Deck-Vorlagen und Beispielgalerie erweitern** (Pitch, Konferenztalk, Schulung, Architektur-Review) | Senkt die Hürde für den ersten Wurf. | M | B6 |
| L19 | **Import-Pfade** (Marp/reveal-Markdown, später PPTX-Text) | Migration von Bestandsfolien. Der PPTX-Import wurde schon einmal gebaut und verworfen, hier nur der leichtere Weg. | M | |

### Begeisterungsmerkmale

Diese Punkte nutzen das, was nur Hashmark hat: Baum und Plan. Sie sind das Argument, warum jemand wechselt.

| ID | Titel | Nutzen und Begründung | Aufw. | Verw. |
| --- | --- | --- | --- | --- |
| D1 | **Publikumsvarianten aus einer Quelle**: 10-/30-/60-Minuten-Fahrplan als Export (PDF, PPTX, HTML), Handout je Fahrplan | Dasselbe Deck für Lightning-Talk und Workshop. Das kann sonst kein Tool. In der Roadmap als Wettbewerbsvorteil notiert. | M | L11 |
| D2 | **Live-Zeitassistent**: „Du liegst 4 Minuten hinten. Vorschlag: Kapitel X (optional) überspringen“, per Tastendruck übernehmen | Macht aus Plan und Timer einen Coach. Rechnet mit `duration` und Plan, die Daten gibt es schon. | M | L11 |
| D3 | **Fragen-Radar**: Frage tippen (oder Publikum schickt sie), Suche springt zum passenden Detailknoten und merkt sich den Ausflug | Verwandelt „Fragen aus dem Publikum“ von Risiko in Stärke. Nutzt Suche und Ausflug. | M | L13 |
| D4 | **Vortragsprotokoll**: Nach dem Vortrag zeigt Hashmark den tatsächlich gezeigten Pfad, Zeiten je Knoten, übersprungene und abgetauchte Knoten. Ergebnis fließt in `duration`-Vorschläge ein | Probe und Auswertung in einem. Verbessert jeden nächsten Vortrag. | M | |
| D5 | **Probenmodus** mit Zeitmessung je Knoten und Kalibrierung der `duration` | Zeitangaben stimmen endlich. Macht den Zeitplan glaubwürdig. | M | D4 |
| D6 | **Karte statt Liste**: Übersichtsansicht als zoombare Baumlandkarte (auch fürs Publikum), Zoom aus der Kachel in den Knoten | Verkauft die Baumidee visuell auf einen Blick. | L | L10 |
| D7 | **Baum-Diff für Pull Requests**: Bot kommentiert „+2 Folien in Kapitel 3, Plan geändert, Überlauf auf Folie 14“ mit Vorschaubildern | Macht Git-Reviews von Präsentationen real. Nutzt `check` und die Druckansicht. | L | B14 |
| D8 | **PR-Vorschau als Webseite** (Deck je Branch als statische Seite) | Reviewer sehen das Ergebnis ohne Build. `pages.yml` ist die Vorlage. | S | |
| D9 | **KI-Assistent im Editor** (lokal oder mit eigenem Schlüssel): Deck aus Gliederung oder Dokument erzeugen, Kürzungsvorschlag für ein Zeitbudget, Alt-Texte, Sprechernotizen | Gamma/Canva setzen die Erwartung. Hier bleibt das Ergebnis Markdown und diffbar. Mit Datenschutz-Opt-in. | L | B4 |
| D10 | **Deck als Werkzeug für Agenten** (CLI/MCP: Struktur lesen, Folie einfügen, `check` ausführen) | Passt zu Markdown als Quelle und zu `hashmark check`. Agenten können Präsentationen pflegen. | M | |
| D11 | **Untertitel/Transkript live** (lokale Spracherkennung) und Aufnahme mit Kamera-Overlay | Macht Remote-Vorträge zugänglicher. Aufwand hoch, Offline-Regel beachten. | L | L13 |
| D12 | **Ein-Datei-Programm ohne Node** (Kern im WebView oder in Go) | Ein Binary pro System, ~15 MB, kein Sidecar. Starker Verkaufspunkt. | L | B2 |
| D13 | **Theme-Import aus PowerPoint** (Farben, Schriften, Logo aus `.potx`) | Corporate Design in Minuten statt Stunden. Ergänzt den Export. | L | L7, L8 |
| D14 | **Zugängliche Mehrfachausgabe**: tagged PDF und barrierefreies HTML als Standard | Aus „B4 erfüllt“ wird „Hashmark ist die einfachste Art, barrierefreie Folien zu schreiben“. | M | B4 |

### Vorschlag zur Reihenfolge

1. **Vertrauen und Reichweite (Basis):** B1, B2, B3, B5, B6, B10, B12, B14, dann B4, B7, B8, B9.
2. **Bedienung und Ausbau (Leistung):** L1, L11, L12, dann L3, L4, L7.
3. **Das Alleinstellungsmerkmal schärfen (Begeisterung):** D1, D2, D4/D5, D8 sind kleine bis mittlere Schritte mit großer Wirkung, weil Plan, Timer und Baum schon vorhanden sind. D3 und D6 folgen mit den Live-Funktionen.

### Hinweise für die Ticket-Erstellung

- Jede Karte hat einen Titel, der als PR-Titel (Changelog-Zeile) taugt. Für Tickets bietet sich `Kano: Basis|Leistung|Begeisterung` als Label an, dazu ein Bereichs-Label (Kern, Runtime, Editor, PPTX, Desktop, Webdienst, Doku).
- Vor dem Ticket einen kurzen Spike für alle mit Aufwand **L** (Plugin-API, Outliner, Animationen, Live-Folgen, Node-freie App).
- Jedes Ticket sollte Akzeptanzkriterien, einen Test im Kern (`tests/core.test.ts`) und die Doku-Änderung im Handbuch enthalten (siehe `.claude/rules/git-workflow.md`).
