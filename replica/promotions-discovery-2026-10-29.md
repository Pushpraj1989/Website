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
8. **Schema drift.** `offers` is defined in `replica/schema.sql` but no food-app migration creates it. A fresh database
   built from `web/db` would not have the table. This must be resolved before adding columns.

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
