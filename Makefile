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

NODE_EXE := vendor/node/node.exe
# Lokales Node zuerst im PATH, damit npm-Skripte und Tools es ebenfalls nutzen
RUN      := set "PATH=%CD%\vendor\node;%PATH%" &&
NODE     := $(RUN) vendor\node\node.exe
NPM      := $(RUN) vendor\node\npm.cmd
STRATA   := $(NODE) src\cli\index.ts

.PHONY: help setup node install deps-update edit edit-no-open dev dev-open dev-lan build preview preview-lan export docker docker-run test new clean distclean

help:
	@echo Strata - Markdown-Praesentationen als navigierbarer Baum
	@echo.
	@echo   make setup         Node.js nach vendor/node holen und Pakete offline installieren
	@echo   make edit          Editor: links Markdown, rechts Live-Vorschau (DECK=...)
	@echo   make dev           Dev-Server starten           (DECK=$(DECK) PORT=$(PORT))
	@echo   make dev-open      Dev-Server starten und Browser oeffnen
	@echo   make dev-lan       Dev-Server im Netzwerk erreichbar (LAN/VPN)
	@echo   make build         Statisches HTML bauen        (OUT=$(OUT))
	@echo   make preview       Gebautes Deck lokal ausliefern
	@echo   make preview-lan   Gebautes Deck im Netzwerk ausliefern
	@echo   make export        Eine HTML-Datei, laeuft offline per Doppelklick (export/)
	@echo   make docker        Build + Docker-Image mit nginx  (IMAGE=$(IMAGE))
	@echo   make docker-run    Image starten                (DOCKER_PORT=$(DOCKER_PORT))
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

edit: node_modules
	$(STRATA) edit "$(DECK)" --port $(PORT)

edit-no-open: node_modules
	$(STRATA) edit "$(DECK)" --port $(PORT) --no-open

dev: node_modules
	$(STRATA) dev "$(DECK)" --port $(PORT)

dev-open: node_modules
	$(STRATA) dev "$(DECK)" --port $(PORT) --open

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

docker: build
	docker build -f docker/Dockerfile -t $(IMAGE) .

docker-run:
	docker run --rm -p $(DOCKER_PORT):80 $(IMAGE)

test: node_modules
	$(NODE) node_modules\vitest\vitest.mjs run

new: node_modules
	$(NODE) scripts\new-deck.ts "$(DECK)"

clean:
	if exist "$(OUT)" rmdir /s /q "$(OUT)"
	if exist export rmdir /s /q export

distclean: clean
	if exist node_modules rmdir /s /q node_modules
