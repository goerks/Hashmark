---
paths:
  - "src/runtime/**"
  - "src/vite/**"
  - "src/cli/**"
---

# Runtime, Editor, Vite-Plugin und CLI

```
src/vite/     plugin.ts: virtual:hashmark/deck (JSON), virtual:hashmark/theme.css, File-Watcher → HMR-Event
              'hashmark:deck', Bild-Middleware, Asset-Emit (auch `.hashmark/plan.json` als `__hashmark/plan`);
              editor-api.ts: Datei-API nur für `hashmark edit`, `planApi` (GET/PUT /__hashmark/plan → .hashmark/plan.json) immer;
              serve-file.ts: `serveFile` mit Teilabrufen (Range, 206/416, HEAD) für Bilder und Videos im Dev-Server, im Live-Server (Desktop-App, Webdienst) und im statischen Server von PDF/Check/PPTX; ohne Range lässt sich ein Video nicht vorspulen
src/cli/      index.ts (cac: dev | edit | serve | build | preview | export | pdf | check), serve.ts (Webdienst: Seed, Runtime, Live-Server mit `web`-Option), config.ts (gemeinsame Vite-Konfiguration),
              export.ts (Single-File), pdf.ts (CDP), scaffold.ts (Deck-Gerüst für make new)
src/runtime/  Svelte-App (Vite-Root!): main.ts wählt App oder PrintView (?print)
  App.svelte        Präsentation, Tasten (navKey), Hash-Sync, HMR, Editor-Messages, Presenter-Link, Suche,
                    Notiz-Overlay (N), unsichtbare Druckseiten
  Slide.svelte      eine Folie: Layout, Schritte (data-step/data-until → .step-hidden), Zeilen-Hervorhebung (.hl), bg, Mermaid
  PresenterView.svelte  ?presenter: zweites Fenster, per postMessage gekoppelt (presenter-link.ts); eigener Navigator
                    nur für die Vorschau (peek), bekommt Ausflüge und T-Zustand aus der Präsentation. Dazu ScaledSlide.svelte,
                    Notes.svelte, Search.svelte, presenter.css
  PlanPanel.svelte  Vortragsplan bearbeiten (Presenter-View, Taste P): Rolle je Knoten, Vorlagen, Fahrpläne, Zeitsumme;
                    plan-store.ts lädt/speichert (Server-Datei, sonst localStorage)
  NavControls/NavOverview/KeyHelp/PrintView/PrintPages, transitions.ts, mermaid.ts
  zoom.ts           Bild-Zoom (siehe unten): `toggleZoom` (Z), `escapeZoom` (Esc), `zoomClick`, `resetZoom` beim Blättern, `zoomInfo` für die Presenter-View
  video.ts          Video in der Präsentation (siehe unten): `prepareVideos`/`syncVideos` aus Slide.svelte, K (`toggleVideo`), → (`skipVideo`), `videoInfo` für die Presenter-View
  ReaderView.svelte + Lazy.svelte + reader.css   ?reader = Lesemodus (Handbuch): Baum als Inhaltsverzeichnis, Notizen als Fließtext, Folien als Karten (ScaledSlide, erst im Sichtbereich gerendert); CardView.svelte: ?card#id:folie&step=n = eine Folie, per postMessage `{type:'hashmark:card', id, slide, step}` umschaltbar (Einbettung in die Startseite). Beide in main.ts
  base.css, print.css, themes/*.css (nur Design-Tokens: --color-*, --font-*, --shiki-*, …)
  editor.html + editor/   Editor (CodeMirror 6), eigene neutrale Tokens (--ed-*): codemirror.ts (Setup, API), hashmark-lang.ts (Decorations für ::: und {…}, Highlight-Klassen .tok-*/.st-*),
                    assist.ts (Autocomplete, Linter, Formatleiste), Palette.svelte (Strg+K), KeyBar.svelte (Tablet), Editor.svelte; Layout A „Fokus“, unter 900 px Schublade + gestapelt
src/runtime/deck-source.ts  onDeckUpdate(): Vite-HMR ('hashmark:deck') bzw. EventSource in der App (window.__HASHMARK_LIVE__)
```

`make check` = `hashmark check`: `src/core/check.ts` (statisch), `src/cli/check.ts` (Überlauf: Build + Druckansicht per Edge/Chrome, liest `data-overflow` der `.print-page[data-node][data-sub]`); Exit 1 bei Fehlern; `pdf.ts`: `withPrintView`/`serveBuild` geteilt mit dem PDF-Export.

## Bekannte Fallstricke (bereits gelöst – nicht wieder einbauen)

- **Druck:** Folien im Druck 2 px niedriger als 16:9 (`aspect-ratio: 1280/718`), `html, body { height: auto }`. Sonst entstehen durch Rundung oder Skalierung leere Zusatzseiten. Kein `100vh` für die Seitenhöhe.
- **Chromium wendet `place-items` auch auf Block-Layout an.** Für Druck/Block-Kontexte ausdrücklich `place-items: normal` setzen.
- **Bühne absolut zentrieren** (`left/top 50%` + `translate(-50%,-50%) scale()`), nicht per Grid. Sonst wird in Fenstern unter 1280 px links abgeschnitten.
- **Mermaid:** feste `max-height` (460px) statt `%`, weil sich das SVG in Spalten sonst an die Nachbarspalte anpasst. Der Versions-Container braucht `grid-template-columns: minmax(0,1fr)`.
- **Druckbereitschaft:** `document.documentElement.dataset.printReady = '1'` ist das Signal für `make pdf`. Die Präsentation rendert die Druckseiten nach 1,5 s bzw. bei `beforeprint` (`.print-only`).
- **Mermaid (mermaid.ts):** `prepare()` hängt bei flowchart/graph/stateDiagram/classDiagram die Theme-`classDef`s (`accent ok warn bad important muted actor`) an und setzt bei `look=hand` ein YAML-Frontmatter davor. Fehler stehen als `.mermaid-error` im DOM, `hashmark check` liest sie (src/cli/check.ts).
- **Figur mit Inline-SVG:** Ein SVG ohne Breite schrumpft in `width: fit-content` auf 0, darum `.d-figure:has(.svg-block…) { width: 100% }`.
- **Navigator:** `down()`/`forward()` merken sich die Position für ↑. Für reine Anzeige immer `peek = true` übergeben.
- **Presenter-Link** (`presenter-link.ts`):
  - Unter http(s) läuft er über BroadcastChannel (`hashmark-presenter:<pfad>`). Der funktioniert ohne `window.opener`, also auch mit App-Fenstern und eigenen Tabs.
  - Unter file:// (Export) läuft er über postMessage an das Partnerfenster. Vertraut wird über `e.source` bzw. denselben Origin.
  - Jede Präsentation hat eine `session`. Die Presenter-View koppelt sich an eine und adressiert Tasten per `target`. Die Editor-Vorschau (`embedded`) nimmt nicht teil.
  - Hello jede Sekunde, so übersteht die Verbindung ein Neuladen. Quelle der Wahrheit bleibt die Präsentation.
- **Vortragsplan (Fahrpläne):**
  - Gespeichert wird nur die Überschreibung je Knoten-ID in `.hashmark/plan.json` (`{ active, plans: { Name: { states, budget? } } }`, tolerant gelesen in `parsePlanFile`). Der Datei-Watcher überspringt Punkt-Ordner, ein Speichern löst also keinen Reload aus.
  - Die Presenter-View ist der einzige Ort zum Bearbeiten. Sie schickt den Plan als `hashmark:presenter-plan` **an alle** Präsentationen (kein `target`: der Plan gehört zum Deck, nicht zur Sitzung); die Präsentation meldet Ausflüge und `all` im `presenter-state` zurück, damit die Vorschau „Als Nächstes“ stimmt.
  - `plan-store.ts`: Server (`./__hashmark/plan`, relativ, mit Header `X-Hashmark-Editor`), sonst `localStorage`. Schlägt das PUT fehl (Webdienst ohne Anmeldung, statischer Export), gilt der Browser-Speicher als neuer (Flag `…:local`).
  - Im Webdienst liegt `/__hashmark/plan` hinter dem Passwort wie die Datei-API (nicht in `PUBLIC_API`).
  - Zeitschätzung: `{duration}` nur an Blättern, sonst 1 min je Sub-Slide (`ownSeconds`). `duration` an Kapiteln gilt für das ganze Kapitel samt Details.
  - Vorlage „Zeitbudget“ schreibt nur die rausgeworfenen Knoten (`optional`). Ein ausdrückliches `path` an einem Elternknoten würde den Autor-Standard (`appendix`) der Kinder überstimmen.
- **Präsentieren (Browser):** Im Browser blendet `App.svelte` die Bedienhilfen aus, solange `presenter-hello` kommt (`withPresenter`). Nicht `?withpresenter` nennen: der E2E-Test erkennt URLs mit „presenter“ als Presenter-Fenster.
- **Desktop-Modus der Seiten:** Das Vite-Plugin mit `onAppAction` setzt `window.__HASHMARK_DESKTOP__` (transformIndexHtml). Dann gehen P/S/PDF/Präsentieren/Ctrl+W per `POST /__hashmark/app` (Header `X-Hashmark-Editor`) an den Sidecar statt per `window.open`.
- **Editor-API:** nur localhost, Header `X-Hashmark-Editor: 1`, nur Pfade im Deck, nur `.md`/`.yaml`/Bilder. `hashmark edit` hat bewusst kein `--host`.
- Die Datei-API-Pfade und `deck-assets/` sind **relativ**, damit Builds auch in Unterverzeichnissen laufen (`base: './'`).

## Video (video.ts)

- **Nur die laufende Präsentation spielt.** `Slide.svelte` hat die Eigenschaft `media`: `live` (App.svelte, nicht in der Editor-Vorschau), `still` (Druckansicht, Presenter-Vorschau, Editor-Vorschau: `preload=metadata`, keine Leiste) und `off` (Übersicht, Lesemodus, unsichtbare Druckseiten der Präsentation: `preload=none`). Sonst würden alle Videos eines Decks gleichzeitig laden. Neue Stellen, die eine Folie zeigen, müssen `media` bewusst setzen.
- **Schritt und Tasten:** `syncVideos(root, step, previous)` startet ein Video, wenn der Schritt `data-play` erreicht wird (`previous === null` = Folie wird erst angezeigt, dann startet nur `play=0`); wer rückwärts auf die Folie zurückkehrt, sieht das Standbild. Bei Schritten davor wird zurückgesetzt. K und → (laufendes Video springt ans Ende) stehen in `navKey` (App.svelte) vor der Navigation. Die Presenter-View reicht K weiter (`FORWARDED_KEYS`) und zeigt den Zustand (`VideoInfo` in `presenter-state`).
- **Autoplay:** Der Start kommt oft aus dem Presenter-Fenster, also nicht als Eingabe im Präsentationsfenster. Chrome/Edge verlangen dann eine frühere Eingabe; schlägt `play()` fehl, zeigt das Video seine Leiste (`controls`), ein Klick startet es. Die Desktop-App setzt `--autoplay-policy=no-user-gesture-required` (`desktop-go/autoplay.go`).
- **Einzel-HTML-Export:** `inlineAssets` (plugin.ts) bettet Bilder ein, Videos bleiben Dateien im Ordner `<name>-medien` neben der HTML-Datei (`MediaSink`, `mediaSink()` in cli/export.ts; Warnung im Export und im App-Dialog). `embedMedia: true` bettet bis 25 MB je Video ein.
- **Prüfung im Browser:** `scripts/video-e2e.ts` und `scripts/zoom-e2e.ts` (CI-Job `browser-e2e`, Chrome des Runners) spielen die Folie „Video“ des Beispiel-Decks bzw. ein kleines Zoom-Deck durch. Lokal: `node scripts/video-e2e.ts` (Browser über `HASHMARK_BROWSER`). Die Testvideos sind WebM (VP9): Playwright-Chromium kann kein H.264, Chrome und Edge schon.

## Bild-Zoom (zoom.ts)

- **Kamera statt Overlay:** Z (oder Klick auf ein Bild mit `data-zoom`) setzt ein `transform` (`translate` + `scale`, Ursprung 0 0) auf `.stage-slide`, die Bühne `.stage` schneidet ab. Titel und Text wandern also mit aus dem Bild. Bedienelemente (Steuerkreuz, Brotkrumen) liegen daneben in der Bühne und bleiben stehen. Maße werden mit abgeschaltetem `transform` gemessen (Bühnenkoordinaten 1280 × 720, Faktor aus `getBoundingClientRect` der Bühne).
- **Nur die laufende Präsentation** (`media="live"` in Slide.svelte, nicht die Editor-Vorschau): `setZoomRoot`/`clearZoomRoot` aus dem Effekt der Folie. Weiterblättern (`go()` in App.svelte) setzt sofort zurück, Esc fährt zuerst zurück (`escapeZoom` in `navKey`), dann steigt es im Baum auf. Z während des Übergangs zur Folie (`getAnimations()`) tut nichts, die Maße stimmten sonst nicht.
- **Animationen reduzieren** (`prefers-reduced-motion`): kein `transition`, die Kamera springt.
- **Presenter:** `FORWARDED_KEYS` enthält Z, `presenter-state` trägt `zoom: { available, active }` (PresenterView zeigt „Bild: normal · Z vergrößern“). `available` wird neu gemeldet, wenn ein Bild geladen ist oder ein Schritt es sichtbar macht (`refreshZoom`).
- **Schreibweise:** `{zoom}` am Bild bzw. `zoom: true` in der `deck.yaml`, `{zoom=off}` nimmt aus (render.ts `imageAttrs`, `RenderContext.zoomImages`). `zoomstep=N`/`zoomuntil=M` (data-zoomstep/-until, zählen in `blocksToHtml` als Schritte) steuert `syncZoom(el, step, previous)` aus Slide.svelte: Zoom ab Schritt N, heraus bei M, erste Anzeige der Folie bleibt normal; `go()` setzt nur bei Folienwechsel zurück, ohne zoomstep beendet ein Schritt einen von Hand gestarteten Zoom. 
- **Stufe 2:** Kamera = `view {s, tx, ty}` (Bühnenkoordinaten) und `base` (Skalierung der ersten Fahrt); `setView` setzt sie, `clamp` hält den Ausschnitt in der Folie (erst ab + / − / Pfeilen, die erste Fahrt darf mittig über den Rand hinaus). `+`/`−` (`zoomBy`, Faktor 1,5, Maximum 8×; unter 1,02 = zurück), `panZoom` (Pfeile nur im tiefen Zoom `s > base·1,02`, sonst blättert →), Mausrad zoomt am Zeiger (`onWheel`, nicht passiv, an der Folie in `setZoomRoot`; ohne Kamera nur mit Strg = Touchpad-Spreizen), Minikarte `.zoom-map` (von `drawMap` an `.stage` gehängt, nur im tiefen Zoom). Ziele (`ZOOMABLE`): `img[data-zoom]`, `.mermaid-block`, `figure.code-block`, `table.d-table-el`, Bilder zuerst. Die Presenter-View leitet + / − nur weiter, solange `zoom.active` (sonst Schrift der Notizen).

## Editor (CodeMirror 6)

- Die Farben der Hashmark-Syntax (`.st-*`) stehen als Decorations innerhalb der Markdown-Überschrift (`.tok-h`) und brauchen `!important`, sonst gewinnt die Überschriftenfarbe.
- Bei `showTooltip` ist das gelieferte `dom` selbst das `.cm-tooltip`-Element. Eigene Farben brauchen deshalb `.cm-editor .cm-tooltip.st-bubble` (mehr Spezifität als das Basis-Theme).
- Vorschläge starten nur bei Eingabe (`userEvent input.type`), nicht bei programmatischen Änderungen. Tests per CDP tippen mit `Input.dispatchKeyEvent` (`char`).
- Headless: `Emulation.setTouchEmulationEnabled` macht `pointer: coarse` wahr (Tastaturleiste), `setFocusEmulationEnabled` liefert `view.hasFocus`.
- Beim Laden wechselt der Editor einmal die Datei, sobald die Vorschau ihre Position meldet (`followPreview`). Tests erst danach bedienen.

## Zwei Wege für Runtime-Erweiterungen

Neue virtuelle Module oder HMR-Ereignisse brauchen beide Wege (`hashmark()` und `hashmarkLive()`, `onDeckUpdate`), weil die Desktop-App keinen Vite-Dev-Server nutzt (siehe `desktop-go.md`).
