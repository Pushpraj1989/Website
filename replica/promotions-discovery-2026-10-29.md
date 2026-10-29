# Promotions and vouchers: repository discovery (Phase 0)

Scope: the brief "Enterprise Coupon, Voucher, Campaign & Redemption Engine". This report is read-only. It covers what
exists, what each part of the brief reuses or creates, the gaps and risks, and the decisions needed before Phase 1.
No application code was changed.

## 1. What exists today

| Area | Found | Where | Status |
| --- | --- | --- | --- |
| Offers with a code | `offers` table: type (percent, fixed, free delivery, item free, bundle), value, applies to (order, category, item), audience (guest, member, any), minimum subtotal, unique `code`, usage limit, used count, per-customer limit, max discount, stackable, priority, active window | Live test database (`\d offers`). Defined in `replica/schema.sql`, not in any food-app migration | Table exists; CRUD in the admin (`admin/src/pages/Offers.jsx`, `web/lib/catalog.ts`); staff-only routes |
| Offers in the customer app | Active offers are listed for an offers widget | `web/lib/data.ts` (`offers` list) | Shown only |
| Pricing | `computeQuote` takes subtotal, delivery and service fees, and tax; the discount is fixed at 0 | `web/lib/pricing.ts` | **Offers never change the price** |
| Cart and checkout | Cart returns server-priced lines and a quote; checkout locks cart items and re-checks availability in a transaction | `web/app/v1/cart/route.ts`, `web/lib/orders.ts` (line ~191) | Reusable |
| Order record | Orders store `discount_minor` already | `web/lib/data.ts` (order insert) | Reusable |
| Promotions table | Placement of a picture or video on the home screen (hero, mid-feed, product background) | `web/db/platform.sql` | **Not a coupon.** Name clash with "promotion"; keep it separate |
| Customers | Accounts, OTP sign-in, sessions with hashed codes | `web/db/auth.sql`, `web/lib/accounts.ts` | Reusable for a wallet |
| Staff access | `isStaff()` checks on admin routes | `web/app/v1/admin/offers/route.ts` | Reusable |
| Money | Integer minor units; a currency table | `web/lib/money.ts` | Reusable. Use fixed precision, never floats |
| Concurrency | `select ... for update` and transactions | `web/lib/db.ts`, `web/lib/accounts.ts`, `web/lib/gallery.ts` | Reusable pattern |
| Libraries | Only `next`, `pg`, `react`, `react-dom`; test tooling is Playwright and axe | `web/package.json` | No PDF, QR or job-queue library |

## 2. Gaps against the brief

1. **Offers are not applied.** An admin can create a `WELCOME10` code today and the customer pays full price. This is
   the first thing to fix, whatever else is decided.
2. **No campaign object.** Offers are single rows. There is no campaign budget, schedule states, or funding split.
3. **No coupon pools or bulk codes.** A code is one unique string. Generating 1,000 unique codes needs a pool, a batch
   job and collision handling.
4. **No reservation or redemption ledger.** `used_count` is a counter with no reservation, release or reversal. The
   brief's `AVAILABLE → RESERVED → REDEEMED` lifecycle is absent.
5. **No customer wallet.** Nothing stores a saved voucher per customer.
6. **No template designer, print or PDF.** No rendering or QR library exists.
7. **No partner API.** There are no partner clients, scopes, quotas or partner audit log.
8. **Schema source.** `offers` is defined in `replica/schema.sql`, which `web/db/migrate.mjs` applies first, so the
   migration path does create it. The file is not idempotent, so the runner needs `--reset` on an existing database.
   (An earlier version of this report said no migration creates the table; that was wrong.)

## 3. Reuse, create, modify

| Brief capability | Decision |
| --- | --- |
| Discount rules (percent, fixed, free delivery, minimum spend, audience) | **Reuse** the `offers` rules; **modify** `computeQuote` to apply the matched offers |
| Single coupon codes | **Reuse** `offers.code` |
| Usage limits (campaign, per-customer) | **Reuse** `usage_limit` and `per_customer_limit`; **modify** so they are enforced at redemption, not only counted |
| Campaigns (budget, states, funding) | **Create** a `campaigns` table; link offers to it |
| Coupon pools and bulk generation | **Create** `voucher_pools`, `vouchers`, `voucher_batches` with an idempotency key |
| Wallet | **Create** `voucher_wallet` |
| Reservation and redemption | **Create** `voucher_reservations` and `voucher_redemptions`, plus an append-only ledger |
| Stored-value vouchers | **Defer** (see decision 2) |
| Template designer, PDF, QR | **Create** later; needs a dependency (decision 4) |
| Partner API | **Defer** until phases 1–4 are proven |
| Admin | **Modify** the existing Offers page; **create** campaign and pool screens |
| Customer wallet and cart | **Modify** the cart; **create** a wallet screen in the app |

## 4. Risks

- **Double redemption.** Two checkouts with one single-use code must not both succeed. Use `for update` on the voucher
  row, or a conditional update, inside the checkout transaction.
- **Reservation leaks.** A payment that fails or times out must release the reservation. This needs an expiry worker.
- **Trust.** The client must never send a discount value. The server recalculates every time.
- **Currency.** The brief's examples use ₹ and INR. This project is UAE: the currency is AED, and examples must be
  rewritten.
- **Code guessing.** Generated codes must come from a secure random source, be checked for collisions, and be stored as
  keyed hashes (the app already does this for OTP codes).
- **Scope size.** The brief lists nine phases. Phases 1–2 alone change pricing, checkout and the admin. Each phase
  needs its own tests before the next starts.

## 5. Proposed first release (for approval)

1. Apply the existing offers in the quote, with a test for each offer type. (Fixes gap 1.)
2. Add the migration for `offers` so a fresh database has it. (Fixes gap 8.)
3. Add campaigns and reservations, with redemption at order confirmation and release on failure. Concurrency test on
   the same code.
4. Add the customer wallet (save, list, remove) and the cart "Offers & vouchers" section.
5. Bulk generation of single-use codes, asynchronous, with a batch status screen.

Deferred: the template designer and PDFs, the partner API, stored-value vouchers, webhooks and reporting dashboards.

## 6. Decisions needed before Phase 1

1. **Confirm the first release** above, or name what to cut.
2. **Stored-value (gift) vouchers:** in or out of the first release? They create a financial liability and need an
   accounting owner.
3. **Currency:** confirm AED and rewrite the brief's examples.
4. **Dependencies:** approve a PDF library and a QR library for Phase 4.
5. **Bulk limit:** maximum codes per batch (the brief suggests 1,000 as an example; confirm the cap).
6. **Refund and cancellation policy:** should a cancelled order restore the voucher, and if so, within what time?
7. **Partner API:** is there a partner who needs it now, or can it wait?
8. **Member vouchers:** should a voucher be restricted to members, using the existing `audience` field?

## 7. Phase 1 status (database layer, added after approval)

Done in `food-app/web/db/vouchers.sql`, applied by `db/migrate.mjs`, tested in `test/vouchers.test.mjs` (12 of 12 pass on
the test database):

- `campaigns` (status, dates, timezone, budget, funding source, limits) and `offers.campaign_id`.
- `voucher_pools` (code pattern, quantity limit, issued count), `vouchers` (keyed code hash, status, expiry, optional
  single-customer binding, template version, optimistic version).
- `voucher_batches` (requested and generated counts, idempotency key, 1 to 10,000 per batch).
- `voucher_wallet` (save and remove without consuming; removed rows are kept).
- `voucher_reservations` (one hold per voucher, a consumed hold must name an order).
- Redemptions are recorded in the existing `offer_redemptions` (new `voucher_id`, unique per voucher), not a new table.
- `voucher_ledger`, append-only (update and delete are blocked by trigger).
- Row-level security is enabled on the new tables, as on the rest of the platform.

Not done in Phase 1, by design: the price is not changed yet (offers are still not applied in `computeQuote`), no API
routes, no admin screens, no code generation, no encryption of codes (the HMAC key and the ciphertext column come with
the code generator).

### Defaults used for the open decisions

- Currency: AED. Timezone default: Asia/Dubai.
- Stored-value vouchers: not built; the discount-only model is used.
- Bulk limit: 10,000 per batch, a placeholder until confirmed.
- No PDF or QR library added.

### New decision found during Phase 1

**Two customer identity tables.** Orders reference `customers` (linked to Supabase auth in `replica/schema.sql`), while
sign-in uses `accounts` (`web/db/auth.sql`, `web/lib/accounts.ts`). The running app places orders against guest sessions.
The voucher wallet references `accounts`, so a signed-in customer's orders will not link to the wallet until this is
decided. Options: make `accounts` the single customer table, or have the wallet reference `customers`. This needs a
decision before the wallet is built.

## 8. Phase 2 status (campaign and coupon administration)

Done. Staff can manage campaigns, their rules, code pools, manual codes and bulk batches, from the API and the admin
console (new "Campaigns" section).

- **Lifecycle:** draft → scheduled or active → paused → completed, or cancelled. Starting needs at least one rule. A
  scheduled campaign becomes active on its start time, and any campaign completes at its end. Pausing, ending or
  cancelling switches its rules off; resuming switches them on. Only a draft can be edited.
- **Rules:** a rule is an `offers` row linked to its campaign, so the same types, audiences and limits apply. A rule
  must sit inside the campaign's dates. Shared codes stay unique.
- **Pools:** a pattern (# digit, @ letter, * either) and an optional limit. A pool is tied to one rule.
- **Manual codes:** one code, normalised, checked for uniqueness, stored as a keyed hash plus an encrypted copy.
- **Bulk batches:** up to 1,000 codes per request, unique, from a cryptographic random source. The same
  `Idempotency-Key` returns the same batch and creates no codes. A batch is all-or-nothing, and two batches racing on
  one pool cannot exceed its limit.
- **Endpoints:** `/v1/admin/campaigns` (list, create), `/[id]` (read, edit draft), `/[id]/transition`, `/[id]/offers`,
  `/[id]/pools`, `/v1/admin/voucher-pools/[id]` (summary), `/[id]/codes`, `/[id]/batches`. All require the staff session.

Tests: `test/campaigns.test.ts` (13 tests against the database) and `test/vouchers.test.mjs` (12). Both reset the test
database, so run them one after the other: `npm run test:vouchers`. The existing end-to-end API test passes (42 of 42),
and a live HTTP round trip through the new routes passed (create, rule, activate, pool, batch, replay).

Deviations from the brief, deliberately deferred:

- Batches above 1,000 are refused. The background worker that handles larger batches belongs to Phase 4.
- Codes are generated during the request, inside one transaction. The brief's asynchronous job model comes with the
  worker.
- The admin console does not yet show a code list or export; codes are stored encrypted for printing in Phase 4.
- Prices still do not use these rules. Applying offers to the cart is Phase 6.

Production needs two new secrets: `VOUCHER_CODE_SECRET` (keys the code hashes) and `APP_ENCRYPTION_KEY` (encrypts the
stored codes). The server refuses to start the code routes without them, as it does for other secrets.

## 9. Phase 3 status (voucher template studio)

Done, without PDF or QR output (see below).

- **Designs:** a draft that staff edit, and immutable numbered versions created on publish. Archived designs cannot change.
  Duplicate copies the draft. A published design must show the code, or a QR code, before it can be published.
- **Fields:** text and QR only. Text may show only the placeholders in the list (code, QR, discount, expiry, campaign,
  restaurant, customer, terms, serial number). Nothing is printed closer than 3 mm to the edge. Colours are hex values.
- **Backgrounds:** pictures only, checked by their bytes and size, stored like product pictures.
- **Previews:** sample values only. The server fills them, so the editor and any later print use the same rules.
- **Pools and vouchers:** a pool can print with a published design. Each voucher records the version it was issued
  with, so a later design change does not change vouchers already made.
- **Admin:** a "Voucher designs" section with fields you can drag or move with the arrow keys, a properties panel,
  background upload, preview, publish, duplicate and archive. The field panel warns when text is likely to be too large
  for its box.

Not done, and why: a real QR image and a PDF need a QR library and a PDF library. Neither is approved (decision 4). The
editor shows a QR placeholder box, and printing waits for the libraries. Text that is too large for its box wraps and can
still spill past the box; the print step must shrink or wrap it too.

Tests: `test/templates.test.ts` (11 tests). `npm run test:vouchers` now runs all three database suites one after another
(vouchers 12, campaigns 13, templates 11). Checked in a browser: the editor loads with no page overflow.

## 10. Phase 4 status (bulk generation and printing)

Done. Printing and exports are built in-house, with no new dependency.

- **QR codes (`lib/qr.ts`):** our own encoder: byte mode, error correction level M, versions 1 to 8 (up to 152 bytes).
  Checked against an independent decoder: 300 random strings across every version decoded exactly, and the matrix matches
  a reference encoder cell for cell in the data area.
- **PDF (`lib/pdf.ts`):** our own writer: pages in millimetres, filled shapes, text in Helvetica, JPEG and PNG pictures
  (8-bit RGB, RGBA, grey, grey with alpha, and palette). Other formats are refused with a clear message. Text that needs
  letters outside Latin cannot be drawn yet and is refused.
- **Printing (`lib/print.ts`):** single cards (one voucher per page at the design's size), or A4 and A5 sheets. Each
  voucher shows its real code, QR code, discount, expiry, restaurant and campaign name. Only usable vouchers are printed:
  not revoked, not redeemed, not expired. A stored code that fails its hash check stops the print.
- **Export:** CSV of codes with serial, status, expiry and batch.
- **Audit:** every print and export is written to `voucher_print_jobs`.
- **Large batches:** the full quantity is reserved when a batch starts. Batches above 1,000 are queued, and the admin
  "Continue making codes" button finishes them in chunks of 500, each committed on its own. A campaign that stops
  mid-batch fails the batch and keeps the codes already made.

Verified end to end: 30 vouchers printed on A4 (4 pages) and as 30 cards; all 30 codes were read back from the rendered
PDFs and match the export exactly. A browser download of single cards gave a 30-page PDF.

Tests: `test/print.test.ts` (11 tests), and the batch tests cover queued and stopped batches. `npm run test:vouchers`
runs all four database suites one after another.

Risks and limits:

- **Losing `APP_ENCRYPTION_KEY` makes stored codes unreadable.** Printing and export then fail with a clear message, and
  the codes must be issued again. Keep the key in the secrets store, and back it up with the database.
- The admin drives large batches; there is no always-on worker yet. A scheduled runner should call the run endpoint in
  production.
- Crop marks and bleed are not drawn. Backgrounds must be JPEG or PNG.
- Print uses the standard Helvetica font. Arabic voucher text needs an embedded font, which is a later step.

## 11. Phase 5 status (customer voucher wallet)

Done on the server and in the customer app. **Decision used:** the wallet references `accounts`, the table customers
sign in with. This was the open question from Phase 1; please confirm it. If `customers` is chosen instead, change the
one foreign key in `db/wallet.sql` and `db/vouchers.sql`.

- **API (bearer token, the same sign-in as the rest of the app):** `GET /v1/me/vouchers` returns the wallet in three
  groups (available, used, expired). `POST /v1/me/vouchers` saves a voucher by its code. `DELETE /v1/me/vouchers/[id]`
  removes one.
- **Saving:** saving does not use the voucher. Saving the same code twice is one entry. A voucher bound to another
  customer gives the same answer as a code that does not exist, so codes cannot be probed. Ten failed attempts in
  fifteen minutes pause saving for that account. A failed attempt is committed before the answer is given, so the count
  holds.
- **Removing:** the wallet entry is hidden and kept for history, the voucher is untouched, and each save and removal is
  recorded in the ledger.
- **Customer app:** "My vouchers" in the Home menu, with a code field, a save button, and Available, Used and Expired
  tabs. Remove is on the available vouchers. The app now sends its sign-in token, and clears it on sign-out.

Tests: `test/wallet.test.ts` (9 database tests), and `test/vouchers_wallet_test.dart` (5 app tests). The full app suite
passes (65 tests). All five database suites pass in sequence, and the end-to-end API test passes (42 of 42). A live
request with a bearer token returned an empty wallet, refused a wrong code with the standard message, and returned 401
without a token.

Not built, and why:

- **QR scanning in the app.** It needs the camera, which needs a device permission and a scanning package. The field
  takes a typed code only, and the same validation runs either way.
- **Shared coupon codes in the wallet.** Only single vouchers are saved. Shared codes (one code for many customers) are
  applied at checkout in Phase 6, because they have no per-customer record to save against.
- **Orders linked to the wallet.** A saved voucher is applied to an order only when Phase 6 is done.
- **On a device.** The app tests run in the test environment. Checking the screen on a phone is still to do.
