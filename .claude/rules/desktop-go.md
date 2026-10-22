---
paths:
  - "desktop-go/**"
  - "src/desktop/**"
  - "scripts/package-app.ts"
  - "scripts/bundle-sidecar.ts"
  - "scripts/app-e2e.ts"
  - "scripts/sidecar-smoke.ts"
---

# Desktop-App (Go-Hülle + Node-Sidecar)

```
src/desktop/  Node-Sidecar der Desktop-App: sidecar.ts (stdin JSON-Zeilen → stdout `@@hashmark {…}`; open/isDeck/scaffold/examples/
              recent/forget/pdf/html/position/close; Ereignis `action` aus den Seiten), settings.ts, ui/ (Startseite, `fetch` an `api/<befehl>` der Hülle)
  live-server.ts   statt Vite-Dev-Server: runtime-dist/ statisch, /__hashmark/deck.json, /__hashmark/theme.css,
                   /__hashmark/events (SSE: deck | reload), deck-assets/, Datei-API + App-Aktionen; fs.watch rekursiv
  paths.ts (src/cli) PROJECT_ROOT/realPath ohne Abhängigkeiten – der Sidecar importiert nur Leichtes beim Start, alles Schwere per import()
  bundle-sidecar (scripts/) sidecar.ts → sidecar.bundle.mjs + bundle-*.mjs (Vite SSR-Build, Vite/Svelte/Shiki extern); nur im Paket
  runtime-build.ts vorgebaute Runtime (liveConfig + src/vite/live-plugin.ts), Stempel = Inhalts-Hash der Quellen
desktop-go/   Desktop-Hülle in Go ohne CGO (go-webview per purego, zenity für Dialoge): main.go (Ablauf, `locate`, Kindprozess `--window`), app.go (Decks, Export,
              Menü, Präsentation/Presenter als eigene Prozesse, Tastenkürzel-JS), api.go (Server der Startseite, `api/<befehl>` mit Header X-Hashmark-App),
              sidecar.go (JSON-Zeilen), native_windows.go (Win32-Menü, Vollbild/Monitore, Symbol), native_linux.go (GTK 3 per purego), native_darwin.go (Objective-C-Laufzeit per purego), native_unix.go; Linux/macOS sind ungetestet und schalten sich bei fehlenden Symbolen ab;
              gepackt `node/` + `app/` neben der EXE, sonst das Repository (`locate`)
```

## Präsentieren und Fenster

- **Präsentieren (Desktop):** `desktop-go/present.go` hält `presentSettings` (`present.json`: presenter auto|on|off, Bildschirm-Indizes, -1 = automatisch) mit `pickScreens`; `app.present` startet die Präsentation mit `--screen <index>` und, wenn der Presenter dabei ist, mit `?dual` (Bedienhilfen aus, bis der Presenter meldet; nach 15 s ohne ihn wieder an). Der Optionen-Dialog (`editor/PresentOptions.svelte`) nutzt die Bindungen `hmPresentOptions`/`hmSetPresentOptions` (nur im Hauptfenster, `hasPresentOptions()`).
- **Go-Hülle:**
  - Die Webview-Bibliothek kennt **ein Fenster je Prozess** und keinen Hook für neue Fenster. Präsentation und Presenter sind deshalb Kindprozesse derselben EXE (`--window URL --mode presentation|presenter`). Schließt die Präsentation, beendet der Hauptprozess auch den Presenter.
  - Das Menü ist ein Win32-Menü über eine Fensterprozedur (`SetWindowLongPtr`). Tastenkürzel greifen darüber nicht, weil WebView2 Tasten selbst verarbeitet: `shortcutsJS` (app.go) fängt sie in jeder Seite des Hauptfensters (nicht in iframes) ab und ruft `window.hmMenu(id)` (Bind).
  - Die Startseite hat einen eigenen Server (api.go). Ihre Befehle verlangen den Header `X-Hashmark-App`, das löst bei fremden Origins einen Preflight aus, den der Server nicht beantwortet. Die Prüfung auf `127.0.0.1` im Host schützt vor DNS-Rebinding.
  - Externe Links (http/https/mailto) und `window.open` fängt `externalLinksJS` (app.go) in allen Frames ab und ruft `hmOpen` (Bind), das nur diese Schemata im Standardbrowser öffnet.
  - Die eingebettete Webview-Bibliothek entpackt sich nach `%TEMP%\webview-<Version>`.
  - Go-Builds **immer mit `CGO_ENABLED=0`** (`make app-cross` setzt es), sonst hängt purego-fremder Code am C-Compiler. Windows: `-ldflags="-H windowsgui"`, sonst erscheint ein Konsolenfenster.
  - Backslashes in Pfaden: Beim Bearbeiten von Makefile/Skripten per Shell gehen sie leicht verloren (aus `\d` wird ein Steuerzeichen). Das Edit-Werkzeug nehmen.
- **go-webview: gebundene Funktionen dürfen keinen `error` zurückgeben** (auch nicht `nil`): Die Bibliothek (v0.0.0-20250327) macht `res[i].Interface().(error)` und stürzt mit „interface conversion: interface is nil, not error“ in einer eigenen Goroutine ab, ohne dass `recover` greift. Das war der Absturz beim Klick auf den Pfeil neben „Präsentieren“. Deshalb Bindungen nur als `func(...) string` über `callGuard` (crash.go) und Fehler als JSON `{"error":"…"}`; auf der Seite `callShell`/`failure` in `desktop.ts`.

## Start, Server, Pfade

- **Kein Vite-Dev-Server in der App:** Die Vorbündelung (`deps_temp_… → deps`) scheitert unter Windows oft mit `EPERM rename`, weil Virenscanner oder Indexer die Dateien sperren. Die Seite wartet dann minutenlang. Deshalb liefert die App eine vorgebaute Runtime über `live-server.ts` aus. `make dev`/`make edit` nutzen weiterhin Vite. Neue virtuelle Module oder HMR-Ereignisse brauchen beide Wege (`hashmark()` und `hashmarkLive()`, `onDeckUpdate`).
- **8.3-Kurznamen (`C:\Users\MICHAE~1\…`, typisch in %TEMP%):** Vite verweigert Dateien, wenn Freigabe und Anfrage in unterschiedlicher Form vorliegen (`outside of Vite serving allow list`, `/@vite/client` → 404). Deshalb löst `config.ts` (`realPath`), `deck.ts` (Themes) und `main.go` (`longPath` für EXE- und App-Ordner) alles auf lange Pfade auf.
- **Kaltstart auf frisch kopierten Dateien:** Node liest beim ersten Import hunderte kleine Dateien (unified, remark, micromark …). Jede prüft der Virenscanner: kalt 10–30 s, warm 0,3 s. Deshalb ist der Sidecar im Paket ein Bündel (`scripts/bundle-sidecar.ts`, wird von `package-app.ts` erzeugt und danach wieder gelöscht, damit die Entwicklung bei den Quellen bleibt; `HASHMARK_SIDECAR_SOURCE=1` erzwingt die Quelle). Dazu `NODE_COMPILE_CACHE` im Datenordner. Messen mit frischer Kopie (`robocopy`) an einen neuen Ort, nicht mit dem zuletzt benutzten Ordner.
- **Aufwärmen im Sidecar** (`warmUp()`): Kern + Shiki laden und das zuletzt geöffnete Deck lesen, während die Startseite zu sehen ist. `open` nutzt das vorab gelesene Deck nur, wenn `isStale()` keine Änderung seit dem Lesen findet (mtime von Ordner und Deck-Dateien).

## Diagnose und Tests

- **Abstürze:** `crash.go`. `debug.SetCrashOutput` schreibt Absturz-Stacks (Panik ohne recover, fatale Laufzeitfehler, native Ausnahmen) in `crash.log` im Datenordner; alle Prozesse der EXE hängen an dieselbe Datei an. Beim nächsten Start (und wenn ein Fensterprozess mit Fehler endet, `reportCrash`) zeigt ein Dialog die Fehlerzeile samt Pfad, die Datei wird als `crash-<Zeit>.log` aufgehoben (5 Stück) und `hashmark.log` bekommt eine Zeile „Absturz erkannt“. Prüfen: `hashmark.exe --crash-test` löst eine Panik aus (nur in Headless-Läufen ohne Dialog). `callGuard` fängt Panics von Bindungen ab und meldet sie der Seite; der Optionen-Dialog zeigt den Fehlertext, `hmLog` schreibt ihn ins Protokoll. Menü Hilfe › „Protokoll öffnen“. Doppeltes „Präsentieren“ innerhalb 2 s wird ignoriert (sonst startete es zwei Präsentationsprozesse).
- **Diagnose:** `hashmark.log` im Datenordner (`%APPDATA%\app.hashmark.desktop`) sammelt Panics (`recoverLog`/`safeGo` in `desktop-go/log.go`), Start und Ende der Fenster-Prozesse mit Exit-Code, das Ende des Sidecars und JS-Fehler der Fenster (`hmLog`). `sidecar.log` wird bei jedem Start nach `sidecar.log.1` gesichert. Neue Goroutinen immer mit `safeGo` starten. **Tests mit `make app-test` teilen sich den Datenordner mit der echten App** (Zuletzt-geöffnet-Liste) und scheitern, solange die echte App läuft.
- **Headless-Tests der App:** `HASHMARK_HEADLESS=1` macht alle Fenster unsichtbar (Hauptfenster `visible(false)`, Präsentation/Presenter werden nicht gezeigt). Die Seiten laufen trotzdem, WebView2-CDP funktioniert. Screenshots unsichtbarer Fenster sind unzuverlässig, daher nur bei `VISIBLE=1` sinnvoll.
- **WebView2 per CDP testen:** App mit `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>` starten, dann wie bei Edge über `/json/list`.
- **Tasten per CDP:** Für `window.open` (Taste S) braucht es `Input.dispatchKeyEvent`, also eine echte Nutzer-Geste. Synthetische Events öffnen kein Popup.
