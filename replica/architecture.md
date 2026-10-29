# Architecture: single-restaurant food ordering (a rebuild of the core features of delivery apps, EN and AR)

Reads: `recon.md`, `features.csv`. Schema: `schema.sql` (23 tables, unverified until run on a Supabase instance).

## Stack

| layer | choice | why |
| --- | --- | --- |
| customer mobile | Flutter (Dart), one codebase for Android and iOS | the team's chosen mobile stack; RTL support is built in; one app runs on any device |
| customer web and admin panel | Next.js (App Router) + TypeScript, Tailwind with design tokens | one web codebase for the web ordering page and the admin panel; server components keep prices and offers on the server |
| database | Postgres 15 on Supabase, in the region nearest Muscat (confirm the available region) | one managed database; row level security for customers and staff; PostGIS for delivery zones |
| auth | Supabase Auth, phone one-time code for customers, email and password plus two-factor for staff | guests get a token instead of an account; staff get stronger login |
| realtime | Supabase Realtime on `orders` for the kitchen board and the customer's tracking screen | no polling; the same table drives both screens |
| payments | a gateway that supports Omannet and cards (candidates: Paymob, Checkout.com; confirm with the client) behind one adapter | the gateway is a swappable adapter; webhooks are stored before processing |
| SMS | a local SMS provider for one-time codes (confirm the provider that reaches Omani numbers) | Supabase's default SMS path does not cover Oman reliably; check before launch |
| push | Firebase Cloud Messaging (Android and iOS) | order status while the app is closed |
| email | Resend | receipts and staff alerts |
| files | Supabase Storage with image transforms for thumbnails | the admin uploads photos; the apps request the size they need |
| jobs | Trigger.dev (scheduled and retried jobs) | order timeouts, refunds, reconciliation |
| hosting | Vercel for the web and admin; Supabase for data | managed, cheap at this scale |
| analytics | none at first; server-side counts in the reports screen | keeps the first release simple and private |

One database. No microservices. The admin panel and the web ordering page are the same Next.js app.

## Schema

Tables: 23 (restaurant, opening_hours, holidays, delivery_zones, media, categories, menu_items,
option_groups, option_choices, offers, offer_redemptions, customers, addresses, guest_sessions,
carts, orders, order_lines, order_status_events, payments, refunds, payment_events, staff, audit_log).

Money: integer minor units (baisa for OMR), with a currency code. Times: `timestamptz` in UTC.
Restaurant local time (Asia/Muscat) is applied in the app, and the opening hours are stored as local
times with the restaurant's time zone.

Access rules: Postgres row level security.
- Customers: their own profile, addresses, cart and orders only.
- Guests: no auth user, so no direct table access. A guest token (stored hashed) goes through the API.
- Menu, offers and settings: public read of active rows; write for owner and manager staff only.
- Payments, refunds, payment events and audit log: service role only. No client policy exists.

Hard constraints in the schema:
- Offer usage limits are enforced with a conditional update in the same transaction as the order.
  If no row changes, the order is refused. Two customers cannot both take the last use.
- A total must equal subtotal minus discount plus delivery fee (checked in the table).
- An order needs a customer or a guest session, and a delivery order needs an address.
- Each webhook event is stored once (unique provider and event id), before it is processed.

## API

Customer (mobile and web). All money is calculated on the server.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /v1/menu | categories and items in the locale, with availability | public | locale | menu tree | F01, F04 |
| GET /v1/offers | live offers that the caller may use (audience filter applied) | public, guest or member | locale, guest token or session | offers | F03 |
| GET /v1/status | open or closed, next opening, delivery possible for an address | public | channel, address or time | status | F01, F04 |
| POST /v1/auth/otp/request | send a one-time code | anyone | phone | 202 | F07-equivalent sign-in |
| POST /v1/auth/otp/verify | verify the code, return a session | anyone | phone, code | session | sign-in |
| POST /v1/guest | create a guest session and token | anyone | none | guest token | F01 |
| PUT /v1/cart | replace the cart items (validated, prices not trusted) | guest or member | items, options, notes | cart with server prices | F01, F02 |
| POST /v1/cart/promo | apply or remove a promo code (checks audience and limits) | guest or member | code | cart with discount breakdown or the reason it failed | F03 |
| POST /v1/checkout/quote | server totals for channel, address, time, payment method | guest or member | cart, channel, address, time, method | totals, fee, VAT, what changed since the cart was built | F01, F02, F04 |
| POST /v1/orders | place the order (idempotency key required), reserves the offer use | guest or member | quote id, idempotency key, method | order, status | F01, F02, F04 |
| POST /v1/orders/:id/payment | create a payment intent for the card path | owner of the order | none | redirect or sheet data | F01 |
| GET /v1/orders | order list for the caller | owner | page | orders | F05 |
| GET /v1/orders/:id | order detail with status timeline | owner | none | order and events | F05, S10 |
| POST /v1/orders/:id/reorder | build a cart from a past order, flags sold-out items | owner | none | cart with flags | F05 |
| POST /v1/orders/:id/feedback | rating and comment, once per order | owner | rating, text | 201 | S12 |
| GET/POST/PATCH/DELETE /v1/addresses | the caller's addresses (zone checked on save) | member | address fields | address | S14 |
| GET/PATCH /v1/me | profile and locale | member | name, locale, consent | profile | S13 |
| DELETE /v1/me | request account deletion (soft delete, purged by a job) | member | confirmation | 202 | S13 |

Payments and webhooks in:
- POST /v1/webhooks/payments/:provider: verifies the signature, stores the event once, then processes it
  (captured, failed, refunded). Replies 200 after storing, so the gateway does not retry needlessly.

Staff (admin panel):

| method path | does | who | flow |
| --- | --- | --- | --- |
| GET /v1/admin/orders?status= | live board, filtered | any active staff | F08 |
| POST /v1/admin/orders/:id/accept | accept, sets the ETA | kitchen, cashier, manager | F08 |
| POST /v1/admin/orders/:id/reject | reject with a reason; refund if paid | cashier, manager | F08 |
| POST /v1/admin/orders/:id/status | move to preparing, ready, out_for_delivery, delivered, collected | kitchen, cashier, manager | F08 |
| GET/POST/PATCH /v1/admin/categories | menu categories | owner, manager | F06 |
| GET/POST/PATCH/DELETE /v1/admin/items | menu items, prices, availability, images | owner, manager | F06 |
| POST /v1/admin/items/:id/options | option groups and choices | owner, manager | F06 |
| POST /v1/admin/media/upload-url | signed upload URL, size and type checked | owner, manager | F06 |
| POST /v1/admin/media | register an uploaded file with alt text in EN and AR | owner, manager | F06 |
| GET/POST/PATCH /v1/admin/offers | offers, audience, limits, schedule | owner, manager | F07 |
| POST /v1/admin/offers/dry-run | apply the rules to a sample cart and show the result | owner, manager | F07 |
| GET/PATCH /v1/admin/settings | hours, holidays, zones, fees, payment methods, cash limit, VAT | owner, manager | A07 |
| GET /v1/admin/reports | sales, orders by channel and payment, offers used | owner, manager | A08 |
| GET /v1/admin/customers | customers with the guest or member flag | owner, manager | A09 |
| POST /v1/admin/staff | invite staff with a role | owner | A01 |
| POST /v1/admin/orders/:id/refund | manual refund (audited) | owner, manager | F08 |

Route count: 37 (customer 19, webhooks 1, staff 17).

Jobs:
- order-timeout: every minute. Auto-cancels orders not accepted within the timeout, and refunds captured payments.
- payment-reconcile: every 15 minutes. Compares orders with the gateway's records and flags gaps.
- refund-retry: every 5 minutes. Retries refunds that failed, with backoff, and alerts after the limit.
- cart-cleanup: daily. Removes abandoned carts and expired guest sessions.
- account-purge: daily. Deletes soft-deleted customers after the retention period, keeps the order financial records anonymised.
- daily-report: 04:00 local. Sales totals sent to the owner.

## The parts that bite

- **Time zones and daylight saving:** Oman does not use daylight saving, but the app still stores UTC and
  converts for display. Opening hours cross midnight for late-night outlets (handled by the close-before-open
  check, which must be relaxed if the restaurant opens past midnight; decide with the client).
- **Idempotency:** the order request carries a key; a repeat returns the same order. Webhooks are stored
  once by (provider, event id) and processed only if not yet processed.
- **Races:** two customers on the last offer use (conditional update); the same cart checked out twice
  (idempotency key); a sold-out item at the moment of checkout (re-check inside the order transaction);
  the kitchen rejecting while the customer pays (refund path).
- **Price changes between cart and order:** the quote shows what changed; the order is refused until the
  customer accepts the new total.
- **Payment without an order:** the order is created as awaiting_payment; if the gateway never confirms
  it, the timeout job cancels it. Money is never taken for an order that is not recorded.
- **Guest to member:** when a guest signs in, their cart and their orders move to the account. Offers
  are re-evaluated for the member audience, and the customer sees the change.
- **Arabic and English:** every customer text exists in both languages. Missing Arabic text is a build
  failure for published content, not a silent English fallback.
- **Realtime at the kitchen:** a dropped connection must recover the board without losing orders
  (reload from the table on reconnect, then subscribe).
- **Offline customer app:** the menu is cached; ordering needs the network, and the app says so.
- **Push and SMS deliverability:** one-time codes in Oman need a local provider and a sender name agreed
  with the client; test with real numbers early.
- **Multi-tenant leakage:** there is one restaurant, but the schema keeps restaurant_id on the tables, so a
  second restaurant later does not need a rewrite. Every query filters on it.
- **VAT:** the rate is a setting (5% is the assumption; confirm). Prices may include VAT; the quote shows both.
- **Deletion and privacy:** a deletion request removes personal data; order financial records are kept
  with the personal fields anonymised, as required by accounting rules (confirm with the client's accountant).
- **Card data:** the app never sees card numbers. Saved cards are gateway tokens only.

## Build order

1. **Vertical slice (milestone 0), ugly and end to end:**
   Screens S02 (plain list), S04, S05, S06 (delivery, card only), S07 (guest), S08, S09, S10 (plain).
   Admin A01, A03 (one category, one item), A02 (plain list).
   Tables: restaurant, categories, menu_items, customers, guest_sessions, carts, orders, order_lines,
   order_status_events, payments, payment_events, staff.
   Routes: GET /v1/menu, PUT /v1/cart, POST /v1/checkout/quote, POST /v1/orders, POST /v1/orders/:id/payment,
   the webhook, GET /v1/orders/:id, admin accept and status.
   Exit test: a guest places a card order, the payment webhook arrives, the kitchen accepts, the customer sees "accepted".

2. **Must-haves by area (features.csv):**
   - Menu complete with options, images and EN and AR text (S02, S03, S04, S15, A03, A06).
   - Cash on delivery and pay on arrival, with the restaurant's switches (S06, A07).
   - Offers with audience, codes, limits, schedule, and the guest sign-in prompt (S03, S05, A04, F03, F07).
   - Addresses and delivery zones on a map (S14, A07).
   - Sign-in with phone code, guest checkout and the guest to member move (S07, S13).
   - Order history, reorder, saved addresses, live status and push (S10, S11, S12, F05).
   - Admin: live board with sound, settings, reports, roles, audit (A02, A07, A08, A01).
   - Language switch with right-to-left layout, numbers and currency formatting (F09).

3. **Should-haves:** scheduled orders, stacking rules and dry-run (A05), reorder flags, feedback, print
   kitchen ticket, audit for offer changes, reports export.

4. **Fixes from replica-entrepreneur:** not yet run. Run it after the first clickable build, with
   real public reviews of the competitor apps (read, do not scrape).

## Summary (for the user)

- Stack in one line: Flutter mobile, Next.js web and admin, Supabase Postgres with Realtime, a gateway adapter for Omannet and cards.
- Tables: 23. Routes: 37. Jobs: 6.
- Riskiest parts: payment and webhooks with refunds; the offer engine under concurrent use; the Arabic and
  right-to-left content and layout.
- Next step: `/replica-design`.
