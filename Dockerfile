FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/15-debug.sh /docker-entrypoint.d/15-debug.sh
RUN chmod +x /docker-entrypoint.d/15-debug.sh
COPY runtime-debug.js /usr/share/nginx/html/runtime-debug.js
COPY index.html /usr/share/nginx/html/index.html
COPY js /usr/share/nginx/html/js
COPY styles /usr/share/nginx/html/styles
COPY leaflet /usr/share/nginx/html/leaflet

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
