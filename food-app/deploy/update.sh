#!/usr/bin/env bash
# Brings the server up to the latest code on its branch: download, install, migrate, build, restart. Run as root:
#   bash /srv/food-app/repo/food-app/deploy/update.sh
# WITH_APP=1 also rebuilds the customer app for the browser (needs DOMAIN, or reads it from the settings file).
# The database is migrated in place; restaurant data and uploaded media are kept.
set -euo pipefail

# Everything is inside main, so bash reads the whole script before running it: the download below replaces this file.
main() {

ROOT=/srv/food-app
REPO="$ROOT/repo"
DATA=/var/lib/food-app
WWW=/var/www/food-app
ENV_FILE=/etc/food-app.env
FLUTTER_VERSION=3.47.8

[ "$(id -u)" = 0 ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }
as_app() { sudo -u foodapp -H env PATH="/opt/flutter/bin:$PATH" "$@"; }
say() { printf '\n== %s\n' "$*"; }
cd /

SELF_COPY="$(mktemp)"; cp "$REPO/food-app/deploy/update.sh" "$SELF_COPY"
say "Download the latest code"
BRANCH="$(as_app git -C "$REPO" rev-parse --abbrev-ref HEAD)"
as_app git -C "$REPO" fetch --quiet origin "$BRANCH"
as_app git -C "$REPO" reset --quiet --hard "origin/$BRANCH"
echo "At $(as_app git -C "$REPO" log -1 --format='%h %s')"
# When the download brought a newer copy of this script, the rest of the update runs from that copy.
if [ -z "${FOOD_APP_RESTARTED:-}" ] && ! cmp -s "$SELF_COPY" "$REPO/food-app/deploy/update.sh"; then
  echo "This update script changed; continuing with the new one."
  FOOD_APP_RESTARTED=1 exec bash "$REPO/food-app/deploy/update.sh" "$@"
fi

# Uploaded pictures and videos live outside the code folder, so a download never touches them.
for link in storage data; do
  target="$REPO/food-app/web/$link"
  if [ ! -L "$target" ]; then
    [ -d "$target" ] && as_app cp -a "$target/." "$DATA/$link/" && rm -rf "$target"
    ln -s "$DATA/$link" "$target" && chown -h foodapp:foodapp "$target"
  fi
done

# Settings added by later versions get their default once; a value already there is never changed.
grep -q '^STAFF_URL=' "$ENV_FILE" || echo 'STAFF_URL="/console/"' >> "$ENV_FILE"

# The settings are read for the build too (the card payment key is built into the website). They are read the way
# the service reads them, one NAME=value per line, quotes optional, so a value with spaces or brackets is fine.
# Windows line endings, spaces before a name and a leading "export " are all accepted.
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line#export }"
  case "$line" in ''|'#'*) continue ;; esac
  name="${line%%=*}"; value="${line#*=}"
  [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  export "$name=$value"
done < "$ENV_FILE"
# The domain: from DOMAIN if given, else PUBLIC_URL, else the name nginx already answers for this site. A missing
# PUBLIC_URL line is written back so the next update finds it.
PUBLIC_URL="${PUBLIC_URL:-}"
DOMAIN="${DOMAIN:-${PUBLIC_URL#https://}}"
if [ -z "$DOMAIN" ] && [ -f /etc/nginx/conf.d/food-app.conf ]; then
  DOMAIN="$(awk '$1 == "server_name" { gsub(/;/, "", $2); print $2; exit }' /etc/nginx/conf.d/food-app.conf)"
fi
if [ -n "$DOMAIN" ] && ! grep -q '^[[:space:]]*\(export \)\{0,1\}PUBLIC_URL=.' "$ENV_FILE"; then
  echo "PUBLIC_URL=\"https://$DOMAIN\"" >> "$ENV_FILE"
  echo "Added PUBLIC_URL for $DOMAIN to $ENV_FILE."
fi
for required in DATABASE_URL ADMIN_PASSWORD; do
  if [ -z "${!required:-}" ]; then
    echo "$ENV_FILE has no $required line. It was written by setup.sh; restore it from your backup of that file." >&2
    exit 1
  fi
done
export NODE_ENV=production

say "Website and API: install, migrate, build"
cd "$REPO/food-app/web"
as_app npm ci --no-audit --no-fund --include=dev
as_app env DATABASE_URL="$DATABASE_URL" node db/migrate.mjs
as_app env NODE_ENV=production NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" npx next build

say "Admin console: build"
cd "$REPO/food-app/admin"
as_app npm ci --no-audit --no-fund --include=dev
as_app npx vite build --base /console/ --logLevel warn
rsync -a --delete "$REPO/food-app/admin/dist/" "$WWW/console/"

if [ "${WITH_APP:-0}" = 1 ]; then
  say "Customer app for the browser: build"
  if [ ! -x /opt/flutter/bin/flutter ]; then
    install -d -o foodapp -g foodapp /opt/flutter
    as_app git clone --quiet --depth 1 --branch "$FLUTTER_VERSION" https://github.com/flutter/flutter.git /opt/flutter
  fi
  cd "$REPO/food-app/mobile"
  as_app flutter --disable-analytics >/dev/null 2>&1 || true
  as_app flutter pub get
  as_app flutter build web --release --no-web-resources-cdn --base-href /app/ --dart-define=API_BASE="https://$DOMAIN"
  rsync -a --delete "$REPO/food-app/mobile/build/web/" "$WWW/app/"
fi
chmod -R a+rX "$WWW"

say "Web server"
# The nginx file follows the code too. A config nginx refuses is put back as it was.
CONF=/etc/nginx/conf.d/food-app.conf
if [ -n "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  cp "$CONF" "$CONF.previous" 2>/dev/null || true
  sed -e "s|__DOMAIN__|$DOMAIN|g" "$REPO/food-app/deploy/nginx-https.conf" > "$CONF"
  if nginx -t 2>/dev/null; then systemctl reload nginx; echo "Updated."
  else echo "nginx refused the new file; kept the old one." >&2; mv "$CONF.previous" "$CONF"; fi
fi

say "Restart"
systemctl restart food-app
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3100/v1/brand; then break; fi
  sleep 1
done
if curl -fsS -o /dev/null http://127.0.0.1:3100/v1/brand; then
  echo "Running."
else
  echo "The service did not answer. See: journalctl -u food-app -n 50" >&2
  exit 1
fi

# Say which optional features are still switched off, without printing any value.
missing=()
for name in SMTP_HOST SMTP_USER SMTP_PASS SMTP_FROM PLACES_USER_AGENT; do
  [ -n "${!name:-}" ] || missing+=("$name")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo
  echo "Still empty in $ENV_FILE: ${missing[*]}"
  echo "  SMTP_*: customers cannot get sign-in codes until these are set."
  echo "  PLACES_USER_AGENT: address search at checkout stays off until it is set."
  echo "Fill them in, then: systemctl restart food-app"
fi
}
main "$@"
exit
