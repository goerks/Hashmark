# Liefert ein gebautes Deck (dist/) statisch über nginx aus.
# Bauen:   make docker DECK=...     Starten:  make docker-run
FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
