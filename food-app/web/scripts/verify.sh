#!/usr/bin/env bash
# Runs every automated check for a release, one after another, and reports each one. Exits non-zero if any fails.
# Needs: DATABASE_URL (a test database that may be reset), and the Flutter SDK for the app tests (FLUTTER_BIN).
# Usage: DATABASE_URL=postgres://... ./scripts/verify.sh
set -u
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?set DATABASE_URL to a test database (it is reset)}"
export VOUCHER_CODE_SECRET="${VOUCHER_CODE_SECRET:-verify-voucher-secret}"
export PARTNER_KEY_SECRET="${PARTNER_KEY_SECRET:-verify-partner-secret}"
export APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-$(openssl rand -base64 32)}"
FLUTTER_BIN="${FLUTTER_BIN:-/opt/flutter/bin/flutter}"
ROOT_ADMIN="$(cd ../admin && pwd)"
ROOT_MOBILE="$(cd ../mobile && pwd)"

failed=0
results=()
step() {
  local name="$1"; shift
  local log; log="$(mktemp)"
  if "$@" >"$log" 2>&1; then
    results+=("PASS  $name")
  else
    results+=("FAIL  $name  (see $log)")
    failed=1
    tail -n 25 "$log"
  fi
}

step "type check (web)"            npx tsc --noEmit -p .
for suite in test/vouchers.test.mjs test/campaigns.test.ts test/templates.test.ts test/print.test.ts test/wallet.test.ts test/checkout-offers.test.ts test/partners.test.ts test/reporting.test.ts test/gates.test.ts test/branding.test.ts; do
  step "database: $suite"          node --test "$suite"
done
step "unit tests"                  node --test test/unit.test.ts
step "end-to-end API (42 checks)"  node test/e2e-api.mjs
step "admin build"                 bash -c "cd '$ROOT_ADMIN' && npx vite build"
step "app tests (Flutter)"         bash -c "cd '$ROOT_MOBILE' && '$FLUTTER_BIN' test --no-version-check"
step "app analysis (Flutter)"      bash -c "cd '$ROOT_MOBILE' && '$FLUTTER_BIN' analyze --no-version-check"

echo
echo "Verification summary"
echo "--------------------"
printf '%s\n' "${results[@]}"
if [ "$failed" -eq 0 ]; then echo; echo "All checks passed."; else echo; echo "Some checks failed."; fi
exit "$failed"
