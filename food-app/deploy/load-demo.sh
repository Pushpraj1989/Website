#!/usr/bin/env bash
# Loads the demo into the sample restaurant: offers and vouchers (pilot-setup), home promotions (home-setup), and the
# app's demo photos and videos with an optional demo customer account (demo-setup). Run as root:
#   bash /srv/food-app/repo/food-app/deploy/load-demo.sh you@example.com
# It only works while the sample menu is still there, and running it again changes nothing. The pilot step prints a
# partner key once; it belongs to a demo partner, which can be revoked in the console under Partners.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/instance.sh"   # this copy's settings file and code
WEB="$REPO/food-app/web"
[ "$(id -u)" = 0 ] || { echo "Run this as root (sudo -i first)." >&2; exit 1; }

# The settings, read the way the service reads them (see update.sh), passed to the scripts as the service user.
vars=(NODE_ENV=production)
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"; line="${line#"${line%%[![:space:]]*}"}"; line="${line#export }"
  case "$line" in ''|'#'*) continue ;; esac
  name="${line%%=*}"; value="${line#*=}"
  [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  vars+=("$name=$value")
done < "$ENV_FILE"
run() { (cd "$WEB" && sudo -u foodapp -H env "${vars[@]}" node --experimental-strip-types --no-warnings "$@"); }

echo "== Offers and vouchers"
run scripts/pilot-setup.ts
echo
echo "== Home promotions"
run scripts/home-setup.ts
echo
echo "== Demo photos, videos and customer account"
run scripts/demo-setup.ts "${1:-}"
echo
echo "Done. Open the website: the pictures show at once. The app at /app/ shows them on its next load."
