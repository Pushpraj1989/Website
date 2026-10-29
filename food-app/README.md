# Food app: vertical slice (web)

Single-restaurant ordering in EN and AR, built from `replica/`. This folder holds the first working slice:
menu, cart, checkout (delivery or pickup, cash on delivery or pay on arrival, card through Stripe), order
status, and the staff board.

Status: web slice only. The Flutter customer app is not started (no Flutter SDK in the build environment).
The data layer is a fake (`web/data/store.json`, one file, one process) with the same function names as the
Supabase layer in `replica/schema.sql`. Swapping it in changes no screen code.

## Run it

```
cd food-app/web
npm install
ADMIN_PASSWORD='at-least-12-chars' npm run build
ADMIN_PASSWORD='at-least-12-chars' npm start    # http://localhost:3100
```

Environment:
- `ADMIN_PASSWORD` (required for staff sign-in, 12 characters or more). Replaced by real staff accounts in the Supabase layer.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: both needed for card payment. Without them, card is hidden.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: needed for the card form in the browser.

## Test

```
npm test                       # unit tests: money, pricing, webhook signature, status, language parity
node test/e2e-api.mjs          # HTTP exit test against a real server (17 checks)
node test/browser-flow.mjs     # browser walkthrough at 390px (needs Playwright's Chromium)
```

The browser test writes screenshots to `replica/clone-screens/`.

## Rules in the code

- Money is an integer count of the currency's smallest unit. Decimal places come from the currency table
  (`web/lib/money.ts`). AED has 2, OMR has 3. Nothing is hard-coded to one currency.
- Prices and totals are computed on the server. The client's prices are never used.
- Menu prices include VAT. The VAT shown is rounded once, at the total, half up.
- An order with the same idempotency key returns the same order.
- A card order waits for `payment_intent.succeeded`. The webhook checks the signature, the timestamp window, the
  amount and the currency. Events are stored once. The app never marks an order paid itself.
- A guest's cookie holds a token. Only its hash is stored.
- Order states follow `web/lib/status.ts`. Anything not listed is refused.

## Placeholders to replace before any launch (TODO)

- Restaurant name, menu, prices, photos and Arabic copy in `web/lib/seed.ts` (sample data, written fresh).
  The Arabic needs a native review.
- Delivery fee (AED 10.00), service fee (0) and cash limit: client decisions.
- VAT rate: 5% for the UAE, to be confirmed by the client's accountant.
- Stripe: account, UAE availability and currencies, and Apple Pay domain registration.
- Samsung Pay: not a Stripe method. Separate integration to decide. Off until then.
- Staff accounts with two-factor sign-in (A01): the slice has one shared password.
- Supabase: run `replica/schema.sql` on a test project, then swap `web/lib/data.ts` for the real layer.
