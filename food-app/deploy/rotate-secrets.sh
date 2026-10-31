#!/usr/bin/env bash
# Replaces every secret setup.sh made, for when they may have been seen (a screenshot, a shared screen). Run as root:
#   bash /srv/food-app/repo/food-app/deploy/rotate-secrets.sh   (another copy: run it from that copy's folder)
# New values are written to /etc/food-app.env and never printed. The database account gets a new password; the data
# stays. Afterwards: the new staff password is shown by "grep ADMIN_PASSWORD /etc/food-app.env"; codes already sent
# stop working; an assistant key saved in the console must be entered again; partner keys and printed vouchers made
# before now stop working.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/instance.sh"   # this copy's settings file, service and database
[ "$(id -u)" = 0 ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE does not exist." >&2; exit 1; }

cp -p "$ENV_FILE" "$ENV_FILE.backup-$(date +%Y%m%d-%H%M%S)"
pass="$(openssl rand -hex 24)"
sudo -u postgres psql -qc "alter role $DB_ROLE with login password '$pass'" >/dev/null

declare -A new=(
  [DATABASE_URL]="postgres://${DB_ROLE}:${pass}@127.0.0.1:5432/${DB_NAME}"
  [ADMIN_PASSWORD]="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  [OTP_SECRET]="$(openssl rand -hex 32)"
  [APP_ENCRYPTION_KEY]="$(openssl rand -base64 32)"
  [PARTNER_KEY_SECRET]="$(openssl rand -hex 32)"
  [VOUCHER_CODE_SECRET]="$(openssl rand -hex 32)"
)
umask 077
tmp="$(mktemp)"
grep -Ev "^[[:space:]]*(export )?($(IFS='|'; echo "${!new[*]}"))=" "$ENV_FILE" > "$tmp" || true
for name in DATABASE_URL ADMIN_PASSWORD OTP_SECRET APP_ENCRYPTION_KEY PARTNER_KEY_SECRET VOUCHER_CODE_SECRET; do
  printf '%s="%s"\n' "$name" "${new[$name]}" >> "$tmp"
done
cat "$tmp" > "$ENV_FILE"
chown root:foodapp "$ENV_FILE"; chmod 640 "$ENV_FILE"

systemctl restart "$SERVICE"
for i in $(seq 1 30); do curl -fs -o /dev/null "http://127.0.0.1:$PORT/v1/brand" && break; sleep 1; done
if curl -fs -o /dev/null "http://127.0.0.1:$PORT/v1/brand"; then echo "All secrets replaced; the service is running."
else echo "Secrets replaced, but the service did not answer. See: journalctl -u $SERVICE -n 50" >&2; exit 1; fi
echo "Your new staff password: run  grep ADMIN_PASSWORD $ENV_FILE  (do not share the output)."
