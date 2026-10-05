# Hashmark – alles Nötige lokal starten. Node.js und alle npm-Pakete liegen im Projekt (vendor/).
#
#   make            Hilfe anzeigen
#   make setup      Node.js (falls fehlend) + Pakete aus dem lokalen Cache installieren
#   make dev        Dev-Server mit Hot Reload (DECK=..., PORT=...)
#
# Beispiele:  make dev DECK=examples/hashmark-demo PORT=4000
#             make new DECK=decks/mein-vortrag

SHELL := cmd.exe
.SHELLFLAGS := /c
.DEFAULT_GOAL := help

NODE_VERSION ?= 24.21.0
DECK         ?= examples/hashmark-demo
PORT         ?= 3030
OUT          ?= dist
DOCKER_PORT  ?= 8080
IMAGE        ?= hashmark/$(notdir $(DECK))
EXAMPLES_IMAGE ?= hashmark/beispiele
SERVER_IMAGE ?= hashmark/server
# ohne ausdrückliches DECK= bietet `make dev` die Beispiel-Decks in der Seite zur Auswahl an
EXAMPLES_SWITCH := $(if $(filter command line environment,$(origin DECK)),,--examples)

NODE_EXE := vendor/node/node.exe
# Lokales Node zuerst im PATH, damit npm-Skripte und Tools es ebenfalls nutzen
RUN      := set "PATH=%CD%\vendor\node;%PATH%" &&
NODE     := $(RUN) vendor\node\node.exe
NPM      := $(RUN) vendor\node\npm.cmd
HASHMARK   := $(NODE) src\cli\index.ts
# Deck nur übergeben, wenn es auf der Kommandozeile steht – sonst zeigt die App ihre Startseite
APP_DECK := $(if $(filter command line,$(origin DECK)),"$(DECK)")
# Desktop-App (Go, ohne CGO, desktop-go/): Go muss im PATH liegen
APP_TARGETS := windows/amd64 windows/arm64 linux/amd64 linux/arm64 darwin/amd64 darwin/arm64
# Version: <letzter Tag ohne v>.<Kurz-Hash> (ohne Tag 0.0.0), wie in der Pipeline; hashmark.exe --version gibt sie aus
GIT_TAG := $(patsubst v%,%,$(shell git describe --tags --abbrev=0 2>nul || echo 0.0.0))
VERSION ?= $(GIT_TAG).$(shell git rev-parse --short HEAD)

.PHONY: help setup node install app app-cross app-exe app-package app-test sidecar-smoke deps-update serve image image-run edit edit-no-open dev dev-open dev-lan build preview preview-lan export pdf pptx check build-examples docker-examples docker docker-run test new clean distclean

help:
	@echo Hashmark - Maechtige Praesentationen aus reinem Markdown
	@echo.
	@echo   make setup         Node.js nach vendor/node holen und Pakete offline installieren
	@echo   make app           Desktop-App (Go) bauen und starten, optional DECK=...
	@echo   make app-cross     Desktop-Huelle fuer Windows/Linux/macOS (amd64, arm64) nach dist-go/
	@echo   make app-package   Portables Programm: dist-app/Hashmark/Hashmark.exe
	@echo   make app-test      E2E-Test der Desktop-App, headless (ohne sichtbare Fenster)
	@echo   make sidecar-smoke Selbsttest des Node-Sidecars (Deck, PDF, PPTX, HTML) nach export/sidecar-smoke
	@echo   make edit          Editor: links Markdown, rechts Live-Vorschau (DECK=...)
	@echo   make serve         Webdienst lokal (Praesentation oeffentlich, Editor mit Passwort EDITOR_PASSWORD)
	@echo   make image         Docker-Image des Webdienstes bauen (Dockerfile im Root, Name: $(SERVER_IMAGE))
	@echo   make image-run     Webdienst-Image starten (http://localhost:$(DOCKER_PORT), Editor-Passwort: EDITOR_PASSWORD)
	@echo   make dev           Dev-Server starten           (DECK=$(DECK) PORT=$(PORT))
	@echo   make dev-open      Dev-Server starten und Browser oeffnen
	@echo   make dev-lan       Dev-Server im Netzwerk erreichbar (LAN/VPN)
	@echo   make build         Statisches HTML bauen        (OUT=$(OUT))
	@echo   make preview       Gebautes Deck lokal ausliefern
	@echo   make preview-lan   Gebautes Deck im Netzwerk ausliefern
	@echo   make export        Eine HTML-Datei, laeuft offline per Doppelklick (export/)
	@echo   make pptx          PowerPoint nach export/ (DEPTH=1, STEPS=1, PLAN=path|grouped, NOANIM=1, PPTX=pfad.pptx)
	@echo   make pdf           PDF nach export/ (DEPTH=1 Hauptpfad, STEPS=1 je Schritt, NOTES=1 Handout, PLAN=path|grouped nach Vortragsplan)
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

# ---------- Desktop-App (Go) ----------

# Hülle bauen und starten, optional DECK=...
app: node_modules
	$(NODE) src\desktop\runtime-build.ts
	cd desktop-go && go build -trimpath -ldflags="-s -w -X main.version=$(VERSION) -H windowsgui" -o ..\export\hashmark.exe .
	export\hashmark.exe $(APP_DECK)

# alle Plattformen ohne CGO (auch von Linux/macOS aus): dist-go/hashmark-<os>-<arch>
app-cross:
	cd desktop-go && set "CGO_ENABLED=0" && $(foreach t,$(APP_TARGETS),set "GOOS=$(word 1,$(subst /, ,$(t)))" && set "GOARCH=$(word 2,$(subst /, ,$(t)))" && go build -trimpath -ldflags="-s -w -X main.version=$(VERSION)$(if $(findstring windows,$(t)), -H windowsgui)" -o ..\dist-go\hashmark-$(word 1,$(subst /, ,$(t)))-$(word 2,$(subst /, ,$(t)))$(if $(findstring windows,$(t)),.exe) . &&) echo fertig

# nur die Windows-EXE (für das portable Paket)
app-exe:
	cd desktop-go && set "CGO_ENABLED=0" && go build -trimpath -ldflags="-s -w -X main.version=$(VERSION) -H windowsgui" -o ..\dist-go\hashmark-windows-amd64.exe .

app-package: app-exe
	$(NODE) scripts\package-app.ts

# headless: Fenster bleiben unsichtbar; VISIBLE=1 zeigt sie
app-test: node_modules
	$(NODE) scripts\app-e2e.ts

sidecar-smoke: node_modules
	$(NODE) scripts\sidecar-smoke.ts

edit: node_modules
	$(HASHMARK) edit "$(DECK)" --port $(PORT)

edit-no-open: node_modules
	$(HASHMARK) edit "$(DECK)" --port $(PORT) --no-open

dev: node_modules
	$(HASHMARK) dev "$(DECK)" --port $(PORT) $(EXAMPLES_SWITCH)

dev-open: node_modules
	$(HASHMARK) dev "$(DECK)" --port $(PORT) --open $(EXAMPLES_SWITCH)

dev-lan: node_modules
	$(HASHMARK) dev "$(DECK)" --port $(PORT) --host

build: node_modules
	$(HASHMARK) build "$(DECK)" --out "$(OUT)"

preview: node_modules
	$(HASHMARK) preview "$(DECK)" --out "$(OUT)"

preview-lan: node_modules
	$(HASHMARK) preview "$(DECK)" --out "$(OUT)" --host

export: node_modules
	$(HASHMARK) export "$(DECK)"

# Optionen: DEPTH=n, STEPS=1, NOTES=1, PLAN=path|grouped, PDF=pfad.pdf, BROWSER=pfad-zu-edge-oder-chrome
pdf: node_modules
	$(HASHMARK) pdf "$(DECK)" $(if $(DEPTH),--depth $(DEPTH)) $(if $(STEPS),--steps) $(if $(NOTES),--notes) $(if $(PLAN),--plan $(PLAN)) $(if $(PDF),--out "$(PDF)") $(if $(BROWSER),--browser "$(BROWSER)")

# PowerPoint (.pptx): Text, Listen, Code, Tabellen bearbeitbar; Diagramme/Dekoration als Bild. Optionen: DEPTH=n, STEPS=1, PLAN=path|grouped, PPTX=pfad.pptx, BROWSER=…
pptx: node_modules
	$(HASHMARK) pptx "$(DECK)" $(if $(DEPTH),--depth $(DEPTH)) $(if $(STEPS),--steps) $(if $(NOANIM),--no-animations) $(if $(PLAN),--plan $(PLAN)) $(if $(PPTX),--out "$(PPTX)") $(if $(BROWSER),--browser "$(BROWSER)")

# Deck prüfen (Layouts, Attribute, Bilder, Theme, Überlauf); NOOVERFLOW=1 = ohne Browser, STRICT=1 = Hinweise sind Fehler
check: node_modules
	$(HASHMARK) check "$(DECK)" $(if $(NOOVERFLOW),--no-overflow) $(if $(STRICT),--strict) $(if $(BROWSER),--browser "$(BROWSER)")

# Webdienst wie auf Render: Praesentation oeffentlich, Editor unter /editor.html mit Passwort
serve: node_modules
	set "DECK_DIR=$(DECK)" && set "PORT=$(PORT)" && set "EDITOR_PASSWORD=$(if $(EDITOR_PASSWORD),$(EDITOR_PASSWORD),geheim)" && $(HASHMARK) serve

image:
	docker build -t $(SERVER_IMAGE) .

image-run:
	docker run --rm -p $(DOCKER_PORT):10000 -e EDITOR_PASSWORD="$(if $(EDITOR_PASSWORD),$(EDITOR_PASSWORD),geheim)" -v hashmark-data:/data $(SERVER_IMAGE)

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
