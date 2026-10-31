#!/usr/bin/env bash
# Lists the settings in /etc/food-app.env as set or empty, never showing a value, and says what each missing one stops.
#   bash /srv/food-app/repo/food-app/deploy/check-settings.sh
set -uo pipefail
ENV_FILE="${ENV_FILE:-/etc/food-app.env}"
[ -r "$ENV_FILE" ] || { echo "Cannot read $ENV_FILE (run as root)." >&2; exit 1; }

# The value of a setting, read the way the service reads it (quotes optional, "export " and spaces allowed).
value() {
  local line
  line="$(grep -E "^[[:space:]]*(export )?$1=" "$ENV_FILE" | tail -1 | tr -d '\r')"
  line="${line#*=}"; line="${line#\"}"; line="${line%\"}"; line="${line#\'}"; line="${line%\'}"
  printf '%s' "$line"
}
show() { if [ -n "$(value "$1")" ]; then printf '  %-36s set\n' "$1"; else printf '  %-36s EMPTY  %s\n' "$1" "$2"; fi; }

# Lines the service cannot read (a stray quote before the name, a missing =), and example text left in place.
bad=0; n=0
while IFS= read -r line || [ -n "$line" ]; do
  n=$((n + 1)); line="${line%$'\r'}"; trimmed="${line#"${line%%[![:space:]]*}"}"
  case "$trimmed" in ''|'#'*) continue ;; esac
  trimmed="${trimmed#export }"
  if ! [[ "$trimmed" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
    echo "Line $n is not read by the service: it must start with a NAME= (no quote or space before the name)."; bad=1
  elif [[ "$trimmed" =~ yourdomain|YourRestaurant|the\ mailbox\ password|the\ Directory|the\ Application|the\ client\ secret ]]; then
    echo "Line $n (${trimmed%%=*}) still holds the example text from the instructions: put your own value there."; bad=1
  fi
done < "$ENV_FILE"
[ "$bad" = 1 ] && echo

echo "Made by setup.sh (must all be set):"
for n in PUBLIC_URL DATABASE_URL ADMIN_PASSWORD OTP_SECRET APP_ENCRYPTION_KEY PARTNER_KEY_SECRET VOUCHER_CODE_SECRET; do
  show "$n" "- run the update, which puts it back"
done

delivery="$(value OTP_DELIVERY)"
echo
echo "Sign-in codes (OTP_DELIVERY is \"${delivery}\"):"
case "$delivery" in
  graph)
    for n in GRAPH_TENANT_ID GRAPH_CLIENT_ID GRAPH_CLIENT_SECRET GRAPH_SENDER; do show "$n" "- codes cannot be sent"; done ;;
  smtp)
    for n in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM; do show "$n" "- codes cannot be sent"; done ;;
  *)
    echo "  OTP_DELIVERY must be \"graph\" (Microsoft 365) or \"smtp\". Until it is, customers cannot sign up or sign in." ;;
esac

echo
echo "Optional:"
show PLACES_USER_AGENT "- address search at checkout is off"
show STRIPE_SECRET_KEY "- card payment is off (cash still works)"
show STRIPE_WEBHOOK_SECRET "- card payment is off"
show NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY "- card payment is off (needs the update to be run after setting it)"
