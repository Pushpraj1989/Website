#!/usr/bin/env bash
# One-time setup of the ordering system on an Ubuntu 22.04 or 24.04 server (the Hostinger VPS). Run as root:
#   DOMAIN=order.example.com bash setup.sh
# Optional: LE_EMAIL=you@example.com (Let's Encrypt expiry notices), BRANCH=..., WITH_APP=1 (also build the customer
# app for the browser at https://DOMAIN/app/; downloads the Flutter SDK, about 2 GB).
# Safe to run again: secrets, the database and uploaded media are kept. Other nginx sites on the server are not touched.
set -euo pipefail

: "${DOMAIN:?Set DOMAIN to the subdomain, for example DOMAIN=order.example.com}"
BRANCH="${BRANCH:-claude/festive-fermat-mvjq25}"
REPO_URL="${REPO_URL:-https://github.com/Pushpraj1989/Website.git}"
ROOT=/srv/food-app
DATA=/var/lib/food-app
WWW=/var/www/food-app
ENV_FILE=/etc/food-app.env

[ "$(id -u)" = 0 ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }
if ! [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "DOMAIN must be a plain host name like order.example.com (no https://, no slash)." >&2; exit 1
fi

say() { printf '\n== %s\n' "$*"; }
cd /

say "Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot git curl ca-certificates openssl ufw rsync ffmpeg postgresql postgresql-contrib
PG_MAJOR="$(ls /usr/lib/postgresql | sort -n | tail -1)"
apt-get install -y "postgresql-${PG_MAJOR}-postgis-3"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# The website build needs about 2 GB of memory. Small plans get a swap file so it does not run out.
if [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 3000 ] && ! swapon --show | grep -q .; then
  say "Adding a 2 GB swap file (this server has under 3 GB of memory)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Service user and folders"
getent group foodapp >/dev/null || groupadd --system foodapp
id foodapp >/dev/null 2>&1 || useradd --system --gid foodapp --home "$DATA" --shell /usr/sbin/nologin foodapp
install -d -o foodapp -g foodapp "$ROOT" "$DATA" "$DATA/storage" "$DATA/data"
install -d -o root -g root "$WWW" /var/www/letsencrypt

say "Code (branch $BRANCH)"
if [ ! -d "$ROOT/repo/.git" ]; then
  # Only the folders the ordering system needs, so the download stays small.
  sudo -u foodapp git clone --filter=blob:none --sparse --branch "$BRANCH" "$REPO_URL" "$ROOT/repo"
  sudo -u foodapp git -C "$ROOT/repo" sparse-checkout set food-app replica
fi
# The rest of the kit comes from the downloaded code, so this script can be fetched on its own.
HERE="$ROOT/repo/food-app/deploy"

say "Database"
systemctl enable --now postgresql >/dev/null
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='foodapp'" | grep -q 1; then
    sudo -u postgres psql -qc "alter role foodapp with login password '$DB_PASS'"
  else
    sudo -u postgres psql -qc "create role foodapp with login password '$DB_PASS'"
  fi
  sudo -u postgres psql -tAc "select 1 from pg_database where datname='food_app'" | grep -q 1 \
    || sudo -u postgres createdb --owner foodapp food_app
  sudo -u postgres psql -q -d food_app -c 'create extension if not exists postgis; create extension if not exists pgcrypto;'

  say "Settings file $ENV_FILE (new secrets generated)"
  umask 077
  sed \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=\"postgres://foodapp:${DB_PASS}@127.0.0.1:5432/food_app\"|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=\"$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)\"|" \
    -e "s|^OTP_SECRET=.*|OTP_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^APP_ENCRYPTION_KEY=.*|APP_ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"|" \
    -e "s|^PARTNER_KEY_SECRET=.*|PARTNER_KEY_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^VOUCHER_CODE_SECRET=.*|VOUCHER_CODE_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^PUBLIC_URL=.*|PUBLIC_URL=\"https://${DOMAIN}\"|" \
    "$HERE/food-app.env.template" > "$ENV_FILE"
  umask 022
  chown root:foodapp "$ENV_FILE" && chmod 640 "$ENV_FILE"
else
  echo "$ENV_FILE already exists; kept as it is."
  sudo -u postgres psql -q -d food_app -c 'create extension if not exists postgis; create extension if not exists pgcrypto;'
fi

say "Service"
install -m 644 "$HERE/food-app.service" /etc/systemd/system/food-app.service
systemctl daemon-reload
systemctl enable food-app >/dev/null

say "Web server for $DOMAIN"
write_nginx() {
  sed -e "s|__DOMAIN__|$DOMAIN|g" "$HERE/$1" > /etc/nginx/conf.d/food-app.conf
  nginx -t && systemctl reload nginx
}
systemctl enable --now nginx >/dev/null
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  write_nginx nginx-http.conf
  ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null
  say "HTTPS certificate (the DNS A record for $DOMAIN must already point to this server)"
  if [ -n "${LE_EMAIL:-}" ]; then contact=(-m "$LE_EMAIL"); else contact=(--register-unsafely-without-email); fi
  certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" --non-interactive --agree-tos "${contact[@]}" \
    --deploy-hook 'systemctl reload nginx'
fi
write_nginx nginx-https.conf
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

say "First build"
WITH_APP="${WITH_APP:-0}" DOMAIN="$DOMAIN" bash "$HERE/update.sh"

cat <<DONE

Done. The ordering system runs at https://$DOMAIN
  Customer website  https://$DOMAIN/
  Order board       https://$DOMAIN/admin
  Admin console     https://$DOMAIN/console/
$( [ "${WITH_APP:-0}" = 1 ] && echo "  Customer app      https://$DOMAIN/app/" )

Next: open $ENV_FILE (nano $ENV_FILE) and fill in the SMTP_ lines and PLACES_USER_AGENT,
then run: systemctl restart food-app
The staff password is the ADMIN_PASSWORD line in that file.
DONE
