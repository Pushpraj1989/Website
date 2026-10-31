#!/usr/bin/env bash
# Sends one test email the way sign-in codes go out, and explains a failure in plain words. Run as root:
#   bash /srv/food-app/repo/food-app/deploy/test-email.sh you@example.com
# Prints no password, secret or token.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/instance.sh"   # this copy's settings file and code
WEB="$REPO/food-app/web"
[ "$(id -u)" = 0 ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }
[ $# -eq 1 ] || { echo "Usage: bash test-email.sh you@example.com" >&2; exit 2; }

# The settings, read the way the service reads them (see update.sh).
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"; line="${line#"${line%%[![:space:]]*}"}"; line="${line#export }"
  case "$line" in ''|'#'*) continue ;; esac
  name="${line%%=*}"; value="${line#*=}"
  [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  export "$name=$value"
done < "$ENV_FILE"

cd "$WEB"
node --experimental-strip-types --no-warnings scripts/test-email.ts "$1"
