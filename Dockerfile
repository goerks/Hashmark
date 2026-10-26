# Hashmark als Webdienst: Präsentation öffentlich, Editor unter /editor.html, beide ohne Anmeldung.
# Ein Container, ein Prozess (hashmark serve). Das Deck liegt im Ordner DECK_DIR; wird dafür eine dauerhafte
# Festplatte eingehängt (Render: Disk auf /data), bleiben Änderungen aus dem Editor über Neustarts erhalten.
#
# Bauen:     docker build -t hashmark .
# Starten:   docker run --rm -p 10000:10000 -v hashmark-data:/data hashmark
# Umgebung:  PORT             Standard 10000 (Render setzt ihn selbst)
#            DECK_DIR         Deck-Ordner, Standard /data/deck
#            DECK_SEED        wird beim ersten Start in einen leeren DECK_DIR kopiert (Standard: Beispiel-Deck)
#            SITE_DIR         gebaute Webseite unter /webseite/ (nur in der Vorschau eines Pull Requests gefüllt)
# Vorschau eines Pull Requests: die fertig gebaute Webseite (make docs) unter /webseite/. Die Pipeline ersetzt diese Stufe per
# `build-contexts: webseite=<ordner>` (der Ordner enthält site/); ohne das bleibt sie leer und der Webdienst zeigt keine Webseite.
FROM node:24-bookworm-slim AS webseite
RUN mkdir -p /site

FROM node:24-bookworm-slim

WORKDIR /app

# Pakete aus dem Lockfile (online: der Vendor-Cache enthält nur die Windows-Binärdateien)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY examples ./examples
# Abnahme-Präsentation des offenen Pull Requests (siehe .claude/rules/git-workflow.md); im Normalbetrieb ein kurzer Ruhezustand
COPY abnahme ./abnahme
COPY --from=webseite /site ./webseite

# Oberfläche (Präsentation, Editor) einmal vorbauen, damit der Start nur Sekunden dauert
RUN node src/desktop/runtime-build.ts

# Vorschau eines Pull Requests: --build-arg SEED=abnahme --build-arg SEED_RESET=1 zeigt die Abnahme-Präsentation statt des Beispiels
ARG SEED=examples/hashmark-demo
ARG SEED_RESET=0

ENV NODE_ENV=production \
    PORT=10000 \
    DECK_DIR=/data/deck \
    DECK_SEED=/app/${SEED} \
    DECK_SEED_RESET=${SEED_RESET} \
    SITE_DIR=/app/webseite

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# Läuft als root: eingehängte Festplatten (Render) gehören root und wären für einen anderen Benutzer nicht beschreibbar
CMD ["node", "src/cli/index.ts", "serve"]
