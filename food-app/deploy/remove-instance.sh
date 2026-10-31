#!/usr/bin/env bash
# Removes a second copy of the ordering system (one made with INSTANCE=... setup.sh), everything it has: its service,
# web server file, HTTPS certificate, database and database account, settings file, code, uploads and web files.
# It refuses to remove the company copy (food-app). Run as root, from the copy's own folder or with INSTANCE:
#   bash /srv/food-demo/repo/food-app/deploy/remove-instance.sh
#   INSTANCE=food-demo bash /srv/food-app/repo/food-app/deploy/remove-instance.sh
# It asks you to type the copy's name before anything is removed. Nothing of the company copy is touched.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/instance.sh"
[ "$(id -u)" = 0 ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }
if [ "$INSTANCE" = food-app ]; then
  echo "This removes a second copy, never the company copy (food-app). Set INSTANCE to the copy to remove." >&2
  exit 1
fi

DOMAIN=""
[ -f "$NGINX_CONF" ] && DOMAIN="$(awk '$1 == "server_name" { gsub(/;/, "", $2); print $2; exit }' "$NGINX_CONF")"
echo "This removes the copy \"$INSTANCE\"${DOMAIN:+ (https://$DOMAIN)} and all of its data:"
echo "  service $SERVICE, $NGINX_CONF, database $DB_NAME, $ENV_FILE, $ROOT, $DATA, $WWW${DOMAIN:+, certificate for $DOMAIN}"
read -r -p "Type $INSTANCE to remove it: " answer
[ "$answer" = "$INSTANCE" ] || { echo "Nothing removed."; exit 1; }

cd /
systemctl disable --now "$SERVICE" 2>/dev/null || true
rm -f "/etc/systemd/system/$SERVICE.service"
systemctl daemon-reload
if [ -f "$NGINX_CONF" ]; then
  rm -f "$NGINX_CONF" "$NGINX_CONF.previous"
  nginx -t 2>/dev/null && systemctl reload nginx
fi
[ -n "$DOMAIN" ] && [ -d "/etc/letsencrypt/live/$DOMAIN" ] && certbot delete --non-interactive --cert-name "$DOMAIN" >/dev/null 2>&1 || true
sudo -u postgres psql -qc "drop database if exists $DB_NAME" >/dev/null
sudo -u postgres psql -qc "drop role if exists $DB_ROLE" >/dev/null
rm -rf "$ROOT" "$DATA" "$WWW"
rm -f "$ENV_FILE" "$ENV_FILE".backup-*
echo "Removed $INSTANCE. The company copy (food-app) is untouched."
