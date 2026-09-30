# Strata – alles Nötige lokal starten. Node.js und alle npm-Pakete liegen im Projekt (vendor/).
#
#   make            Hilfe anzeigen
#   make setup      Node.js (falls fehlend) + Pakete aus dem lokalen Cache installieren
#   make dev        Dev-Server mit Hot Reload (DECK=..., PORT=...)
#
# Beispiele:  make dev DECK=examples/strata-demo PORT=4000
#             make new DECK=decks/mein-vortrag

SHELL := cmd.exe
.SHELLFLAGS := /c
.DEFAULT_GOAL := help

NODE_VERSION ?= 24.21.0
DECK         ?= examples/strata-demo
PORT         ?= 3030
OUT          ?= dist
DOCKER_PORT  ?= 8080
IMAGE        ?= strata/$(notdir $(DECK))
EXAMPLES_IMAGE ?= strata/beispiele
# ohne ausdrückliches DECK= bietet `make dev` die Beispiel-Decks in der Seite zur Auswahl an
EXAMPLES_SWITCH := $(if $(filter command line environment,$(origin DECK)),,--examples)

NODE_EXE := vendor/node/node.exe
# Lokales Node zuerst im PATH, damit npm-Skripte und Tools es ebenfalls nutzen
RUN      := set "PATH=%CD%\vendor\node;%PATH%" &&
NODE     := $(RUN) vendor\node\node.exe
NPM      := $(RUN) vendor\node\npm.cmd
STRATA   := $(NODE) src\cli\index.ts
# Desktop-App (Tauri): Rust + llvm-mingw im Benutzerprofil (make toolchain), nicht im Repo
LLVM_MINGW ?= 20260922
CARGO    := set "PATH=%LOCALAPPDATA%\strata-toolchain\llvm-mingw-$(LLVM_MINGW)-ucrt-x86_64\bin;%USERPROFILE%\.cargo\bin;%PATH%" && cargo
APP_DEBUG   := src-tauri\target\debug\strata.exe
APP_RELEASE := src-tauri\target\release\strata.exe
# Deck nur übergeben, wenn es auf der Kommandozeile steht – sonst zeigt die App ihre Startseite
APP_DECK := $(if $(filter command line,$(origin DECK)),"$(DECK)")

.PHONY: help setup node install toolchain app app-build app-package app-test sidecar-smoke deps-update edit edit-no-open dev dev-open dev-lan build preview preview-lan export pdf check build-examples docker-examples docker docker-run test new clean distclean

help:
	@echo Strata - Markdown-Praesentationen als navigierbarer Baum
	@echo.
	@echo   make setup         Node.js nach vendor/node holen und Pakete offline installieren
	@echo   make app           Desktop-App (Tauri) bauen und starten, optional DECK=...
	@echo   make app-package   Portables Programm: dist-app/Strata/Strata.exe
	@echo   make toolchain     Rust + llvm-mingw fuer die Desktop-App (ohne Admin, einmalig, Internet)
	@echo   make app-test      E2E-Test der Desktop-App, headless (ohne sichtbare Fenster)
	@echo   make sidecar-smoke Selbsttest des Node-Sidecars (Deck, PDF, HTML) nach export/sidecar-smoke
	@echo   make edit          Editor: links Markdown, rechts Live-Vorschau (DECK=...)
	@echo   make dev           Dev-Server starten           (DECK=$(DECK) PORT=$(PORT))
	@echo   make dev-open      Dev-Server starten und Browser oeffnen
	@echo   make dev-lan       Dev-Server im Netzwerk erreichbar (LAN/VPN)
	@echo   make build         Statisches HTML bauen        (OUT=$(OUT))
	@echo   make preview       Gebautes Deck lokal ausliefern
	@echo   make preview-lan   Gebautes Deck im Netzwerk ausliefern
	@echo   make export        Eine HTML-Datei, laeuft offline per Doppelklick (export/)
	@echo   make pdf           PDF nach export/ (DEPTH=1 Hauptpfad, STEPS=1 je Schritt, NOTES=1 Handout)
	@echo   make check         Deck pruefen: Layouts, Bilder, Theme, Ueberlauf (NOOVERFLOW=1 ohne Browser, STRICT=1)
	@echo   make docker        Build + Docker-Image mit nginx  (IMAGE=$(IMAGE))
	@echo   make docker-run    Image starten                (DOCKER_PORT=$(DOCKER_PORT))
	@echo   make build-examples / docker-examples   alle Beispiele mit Auswahlseite (Webservice; Image: $(EXAMPLES_IMAGE))
	@echo   make test          Tests ausfuehren
	@echo   make new DECK=...  Neues Deck-Geruest anlegen
	@echo   make deps-update   Pakete online aktualisieren und im Cache vendor/npm-cache ablegen
	@echo   make clean         Build-Ausgabe loeschen
	@echo   make distclean     Zusaetzlich node_modules loeschen

setup: node install

node: $(NODE_EXE)

$(NODE_EXE):
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts\get-node.ps1 -Version $(NODE_VERSION)

# Installation ausschliesslich aus vendor/npm-cache (kein Internet noetig)
install: $(NODE_EXE)
	$(NPM) ci --offline

# Holt aktuelle Pakete aus der Registry und legt sie im Cache ab
deps-update: $(NODE_EXE)
	$(NPM) install --prefer-online

node_modules: | $(NODE_EXE)
	$(NPM) ci --offline

# ---------- Desktop-App (Tauri) ----------

toolchain:
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts\get-toolchain.ps1 -LlvmMingw $(LLVM_MINGW)

# Debug-Build (schneller) und starten
app: node_modules
	$(NODE) src\desktop\runtime-build.ts
	cd src-tauri && $(CARGO) build
	$(APP_DEBUG) $(APP_DECK)

app-build: node_modules
	cd src-tauri && $(CARGO) build --release

app-package: app-build
	$(NODE) scripts\package-app.ts

# headless: Fenster bleiben unsichtbar; VISIBLE=1 zeigt sie
app-test: node_modules
	$(NODE) scripts\app-e2e.ts

sidecar-smoke: node_modules
	$(NODE) scripts\sidecar-smoke.ts

edit: node_modules
	$(STRATA) edit "$(DECK)" --port $(PORT)

edit-no-open: node_modules
	$(STRATA) edit "$(DECK)" --port $(PORT) --no-open

dev: node_modules
	$(STRATA) dev "$(DECK)" --port $(PORT) $(EXAMPLES_SWITCH)

dev-open: node_modules
	$(STRATA) dev "$(DECK)" --port $(PORT) --open $(EXAMPLES_SWITCH)

dev-lan: node_modules
	$(STRATA) dev "$(DECK)" --port $(PORT) --host

build: node_modules
	$(STRATA) build "$(DECK)" --out "$(OUT)"

preview: node_modules
	$(STRATA) preview "$(DECK)" --out "$(OUT)"

preview-lan: node_modules
	$(STRATA) preview "$(DECK)" --out "$(OUT)" --host

export: node_modules
	$(STRATA) export "$(DECK)"

# Optionen: DEPTH=n, STEPS=1, NOTES=1, PDF=pfad.pdf, BROWSER=pfad-zu-edge-oder-chrome
pdf: node_modules
	$(STRATA) pdf "$(DECK)" $(if $(DEPTH),--depth $(DEPTH)) $(if $(STEPS),--steps) $(if $(NOTES),--notes) $(if $(PDF),--out "$(PDF)") $(if $(BROWSER),--browser "$(BROWSER)")

# Deck prüfen (Layouts, Attribute, Bilder, Theme, Überlauf); NOOVERFLOW=1 = ohne Browser, STRICT=1 = Hinweise sind Fehler
check: node_modules
	$(STRATA) check "$(DECK)" $(if $(NOOVERFLOW),--no-overflow) $(if $(STRICT),--strict) $(if $(BROWSER),--browser "$(BROWSER)")

docker: build
	docker build -f docker/Dockerfile -t $(IMAGE) .

docker-run:
	docker run --rm -p $(DOCKER_PORT):80 $(IMAGE)

# Webservice mit Auswahlseite: alle Beispiele unter examples/ (dist/index.html + dist/<deck>/)
build-examples: node_modules
	$(NODE) scripts\build-examples.ts "$(OUT)"

docker-examples: build-examples
	docker build -f docker/Dockerfile -t $(EXAMPLES_IMAGE) .

test: node_modules
	$(NODE) node_modules\vitest\vitest.mjs run

new: node_modules
	$(NODE) scripts\new-deck.ts "$(DECK)"

clean:
	if exist "$(OUT)" rmdir /s /q "$(OUT)"
	if exist export rmdir /s /q export
	if exist dist-app rmdir /s /q dist-app

distclean: clean
	if exist node_modules rmdir /s /q node_modules
