# Backend: food app (single restaurant)

Reads `architecture.md`. Schema: `schema.sql` (run on Postgres 16 with PostGIS, from scratch, no errors).
Code: `food-app/web` (data layer on Postgres, order rules, Stripe adapter, webhook).

## What exists

| part | state | where |
| --- | --- | --- |
| schema (29 tables, 15 policies) | applied cleanly on Postgres 16.15 + PostGIS | `replica/schema.sql` |
| migrations and sample seed | runs twice safely; `--reset` for local and test only | `food-app/web/db/migrate.mjs`, `db/seed.sql` |
| data layer | Postgres, all writes that must be all-or-nothing in one transaction | `food-app/web/lib/data.ts`, `lib/db.ts` |
| order rules | placement (locks cart items, re-checks availability in the transaction), idempotency key, state machine as conditional updates | `lib/orders.ts`, `lib/status.ts` |
| payments | Stripe PaymentIntent with Idempotency-Key per order; webhook verifies signature, stores event once, confirms only awaiting_payment orders, checks amount and currency | `lib/payments/stripe.ts`, `app/v1/webhooks/...` |
| access rules | row level security as written in schema.sql, tested as a non-owner role | `test/rls.test.mjs` (8 checks) |
| staff sign-in | one shared password (HMAC session cookie), not Supabase Auth | `app/v1/admin/session` |
| guests | token cookie, only its hash stored in guest_sessions | `lib/http.ts` |

## Found and fixed while running the schema for real

1. `postgis` was never created. Delivery zones and addresses failed. Added to schema.sql.
2. Guest addresses could not be stored: `addresses` only referenced customers, and customers reference auth users.
   Addresses now belong to exactly one of a customer or a guest session. Guest sessions are defined first.
3. No ETA column for staff acceptance. Added `orders.eta_minutes`.
4. `order_lines` insert failed on untyped parameters (`$5 * $6`). Cast in the query.

## Checklist (from replica-backend)

- [x] secrets only in env vars; `.env*` ignored; `.env.example` lists names only
- [x] input validated on the server on every route (quantities, idempotency key length, method, channel, address)
- [x] authorisation checked on every read and write: guest orders owner-only (tested with a second browser),
      customer rows by RLS (tested as a non-owner role with two customers)
- [ ] rate limits on sign-in and on anything that sends SMS or email (no SMS or email in the slice yet)
- [x] webhooks verify signatures (HMAC, 300-second window, timing-safe compare)
- [ ] uploads: no uploads in the slice yet
- [x] no user data in URLs; logs print errors only, not payloads
- [ ] `npm audit` run on the project: to do before deploy
- [ ] privacy policy lists processors (Stripe, host, SMS and email providers when added)

## Not done, and why

- **Supabase project.** Needs the user's account. The schema has been run on a local Postgres 16 with PostGIS and a
  stub `auth` schema, which matches Supabase's functions (`auth.uid()`, `auth.users`). Run `db/migrate.mjs` against the
  Supabase database once the project exists; the migration checks for an existing `auth.uid()` before adding a stub.
- **Stripe test mode.** Needs the user's test keys. Card payment is hidden until both secrets are set. The payment
  sheet and 3-D Secure are untested in this environment.
- **Apple Pay and Google Pay domain registration.** Needs the Stripe account and the domain.
- **Samsung Pay.** Separate integration; off.
- **Refunds.** Not built. A rejected card order that was paid needs a Stripe refund and a `refunds` row.
- **Order timeout and reconciliation jobs.** Not built. A card order that never confirms stays `awaiting_payment`.
- **Delivery zone check.** The slice uses the first active zone's fee for every address. Real polygon checks need the
  address on a map.
- **Realtime.** The customer page polls every 5 seconds. Supabase Realtime replaces it.
- **Audit log.** The table exists; writes to it are not made yet.
