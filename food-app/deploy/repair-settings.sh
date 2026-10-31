#!/usr/bin/env bash
# Puts back settings setup.sh wrote that are missing from the settings file. Run as root; update.sh runs it first.
#   bash /srv/food-app/repo/food-app/deploy/repair-settings.sh
# For each missing setting it first takes the value the running service is still using (so nothing changes), and only
# when there is none makes a new one. Values are never printed. The file is copied to a dated backup before a change.
set -euo pipefail

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/instance.sh"   # this copy's settings file, service and database
SERVICE_ENV="${SERVICE_ENV:-}"   # tests point this at a file; on the server it is read from the running service
REQUIRED=(DATABASE_URL ADMIN_PASSWORD OTP_SECRET APP_ENCRYPTION_KEY PARTNER_KEY_SECRET VOUCHER_CODE_SECRET)

[ "$(id -u)" = 0 ] || [ -n "$SERVICE_ENV" ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE does not exist. Run setup.sh." >&2; exit 1; }

has() { grep -Eq "^[[:space:]]*(export )?$1=.+" "$ENV_FILE"; }
missing=()
for name in "${REQUIRED[@]}"; do has "$name" || missing+=("$name"); done
[ ${#missing[@]} -eq 0 ] && exit 0

# The environment of the running service: what it loaded from the settings file when it last started.
if [ -z "$SERVICE_ENV" ]; then
  pid="$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || echo 0)"
  if [ "${pid:-0}" != 0 ] && [ -r "/proc/$pid/environ" ]; then
    SERVICE_ENV="$(mktemp)"; chmod 600 "$SERVICE_ENV"
    tr '\0' '\n' < "/proc/$pid/environ" > "$SERVICE_ENV"
  fi
fi
running() { [ -n "$SERVICE_ENV" ] && [ -f "$SERVICE_ENV" ] && grep -m1 "^$1=" "$SERVICE_ENV" | cut -d= -f2- || true; }

cp -p "$ENV_FILE" "$ENV_FILE.backup-$(date +%Y%m%d-%H%M%S)"
umask 077
for name in "${missing[@]}"; do
  value="$(running "$name")"
  if [ -n "$value" ]; then
    how="copied from the running service, unchanged"
  else
    case "$name" in
      DATABASE_URL)
        # A new password for the database account; the data stays as it is.
        pass="$(openssl rand -hex 24)"
        sudo -u postgres psql -qc "alter role $DB_ROLE with login password '$pass'" >/dev/null
        value="postgres://${DB_ROLE}:${pass}@127.0.0.1:5432/${DB_NAME}"
        how="new database password set (the data is kept)" ;;
      ADMIN_PASSWORD) value="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"; how="new staff password (see it with: grep ADMIN_PASSWORD $ENV_FILE)" ;;
      OTP_SECRET) value="$(openssl rand -hex 32)"; how="new; codes already sent stop working, customers ask for a new one" ;;
      APP_ENCRYPTION_KEY) value="$(openssl rand -base64 32)"; how="new; enter the assistant's provider key again in the console" ;;
      PARTNER_KEY_SECRET) value="$(openssl rand -hex 32)"; how="new; partner keys must be issued again" ;;
      VOUCHER_CODE_SECRET) value="$(openssl rand -hex 32)"; how="new; vouchers issued before this cannot be checked" ;;
    esac
  fi
  # A blank line for this name, if there is one, is replaced; otherwise the line is added at the end.
  if grep -Eq "^[[:space:]]*(export )?$name=" "$ENV_FILE"; then
    tmp="$(mktemp)"; grep -Ev "^[[:space:]]*(export )?$name=" "$ENV_FILE" > "$tmp"; cat "$tmp" > "$ENV_FILE"
  fi
  printf '%s="%s"\n' "$name" "$value" >> "$ENV_FILE"
  echo "Put back $name: $how."
done
chown root:foodapp "$ENV_FILE" 2>/dev/null || true
chmod 640 "$ENV_FILE"
