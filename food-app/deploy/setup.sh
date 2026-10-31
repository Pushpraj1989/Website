#!/usr/bin/env bash
# One-time setup of the ordering system on an Ubuntu 22.04 or 24.04 server (the Hostinger VPS). Run as root:
#   DOMAIN=order.example.com bash setup.sh
# Optional: LE_EMAIL=you@example.com (Let's Encrypt expiry notices), BRANCH=..., WITH_APP=1 (also build the customer
# app for the browser at https://DOMAIN/app/; downloads the Flutter SDK, about 2 GB).
# Safe to run again: secrets, the database and uploaded media are kept. Other nginx sites on the server are not touched.
#
# A second, separate copy (for example a temporary demo you can share without the company's domain) on the same server:
#   INSTANCE=food-demo DOMAIN=ip WITH_APP=1 bash /srv/food-app/repo/food-app/deploy/setup.sh
# It gets its own folders, database, settings (/etc/food-demo.env), service (food-demo) and port (3200, or PORT=...).
# DOMAIN=ip uses this server's address as a name, like 187-77-125-86.sslip.io: a free public name that points to the
# IP written in it, so it gets a normal HTTPS certificate with no domain to buy or set up. See instance.sh.
set -euo pipefail

BRANCH="${BRANCH:-claude/festive-fermat-mvjq25}"
REPO_URL="${REPO_URL:-https://github.com/Pushpraj1989/Website.git}"

[ "$(id -u)" = 0 ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }

# Which copy this is (food-app unless INSTANCE says otherwise). When this script runs on its own, before any code is
# downloaded, only the code folder is needed now; the rest comes from instance.sh once the code is there.
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SELF_DIR/instance.sh" ]; then
  . "$SELF_DIR/instance.sh"
else
  INSTANCE="${INSTANCE:-food-app}"; ROOT="/srv/$INSTANCE"; DATA="/var/lib/$INSTANCE"; WWW="/var/www/$INSTANCE"
fi

if [ "${DOMAIN:-}" = ip ]; then
  # This server's public address, written as a name: 187.77.125.86 becomes 187-77-125-86.sslip.io.
  ADDRESS="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
  [[ "$ADDRESS" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Could not find this server's public address; set DOMAIN yourself." >&2; exit 1; }
  case "$ADDRESS" in 10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*)
    echo "This server's own address ($ADDRESS) is private. Set DOMAIN=<public-ip-with-dashes>.sslip.io yourself." >&2; exit 1 ;;
  esac
  DOMAIN="${ADDRESS//./-}.sslip.io"
  echo "Using $DOMAIN (it points to $ADDRESS)."
fi
: "${DOMAIN:?Set DOMAIN to the subdomain, for example DOMAIN=order.example.com (or DOMAIN=ip)}"
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

say "Service user and folders ($INSTANCE)"
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
. "$HERE/instance.sh"

say "Database"
systemctl enable --now postgresql >/dev/null
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  # Each copy has its own database account and database, so one copy can never read another's data.
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='$DB_ROLE'" | grep -q 1; then
    sudo -u postgres psql -qc "alter role $DB_ROLE with login password '$DB_PASS'"
  else
    sudo -u postgres psql -qc "create role $DB_ROLE with login password '$DB_PASS'"
  fi
  sudo -u postgres psql -tAc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres createdb --owner "$DB_ROLE" "$DB_NAME"
  sudo -u postgres psql -q -d "$DB_NAME" -c 'create extension if not exists postgis; create extension if not exists pgcrypto;'

  say "Settings file $ENV_FILE (new secrets generated)"
  umask 077
  sed \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=\"postgres://${DB_ROLE}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}\"|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=\"$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)\"|" \
    -e "s|^OTP_SECRET=.*|OTP_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^APP_ENCRYPTION_KEY=.*|APP_ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"|" \
    -e "s|^PARTNER_KEY_SECRET=.*|PARTNER_KEY_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^VOUCHER_CODE_SECRET=.*|VOUCHER_CODE_SECRET=\"$(openssl rand -hex 32)\"|" \
    -e "s|^PUBLIC_URL=.*|PUBLIC_URL=\"https://${DOMAIN}\"|" \
    "$HERE/food-app.env.template" > "$ENV_FILE"
  # A copy other than the company's records its port, so later updates find it.
  [ "$PORT" = 3100 ] || echo "LISTEN_PORT=\"$PORT\"" >> "$ENV_FILE"
  umask 022
  chown root:foodapp "$ENV_FILE" && chmod 640 "$ENV_FILE"
else
  echo "$ENV_FILE already exists; kept as it is."
  sudo -u postgres psql -q -d "$DB_NAME" -c 'create extension if not exists postgis; create extension if not exists pgcrypto;'
fi

say "Service"
render_template "$HERE/food-app.service" > "/etc/systemd/system/$SERVICE.service"
chmod 644 "/etc/systemd/system/$SERVICE.service"
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null

say "Web server for $DOMAIN"
write_nginx() {
  render_template "$HERE/$1" > "$NGINX_CONF"
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
WITH_APP="${WITH_APP:-0}" DOMAIN="$DOMAIN" INSTANCE="$INSTANCE" bash "$HERE/update.sh"

cat <<DONE

Done. The ordering system ($INSTANCE) runs at https://$DOMAIN
  Customer website  https://$DOMAIN/
  Order board       https://$DOMAIN/admin
  Admin console     https://$DOMAIN/console/
$( [ "${WITH_APP:-0}" = 1 ] && echo "  Customer app      https://$DOMAIN/app/" )

Next: open $ENV_FILE (nano $ENV_FILE) and fill in the email (GRAPH_ or SMTP_) lines and PLACES_USER_AGENT,
then run: systemctl restart $SERVICE
The staff password is the ADMIN_PASSWORD line in that file.
DONE
