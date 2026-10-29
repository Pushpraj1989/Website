# Restaurant app (Dubai and Abu Dhabi): scope coverage, feasibility and estimate

Checked against the code on 2026-10-29. Status: **Built** (in code and tested), **Partial** (some of it, named), **Missing**.
Estimates are ours and depend on the answers in section 6.

## 1. Coverage of the client's scope

### 1.1 Customer mobile app

| Requirement | Status | What exists / what is missing |
| --- | --- | --- |
| Location-specific menu for both branches | Missing | One restaurant only. No branch table; menu and availability are not per branch |
| Guest checkout with mobile number, delivery address and location | Partial | Guest checkout, saved addresses and zone matching are built. A mobile number is not captured on a guest order, and the address has no map pin yet |
| Optional login for offers, loyalty and discounts | Partial | Phone sign-up with one-time code and sign-in are built. Member-only offers and loyalty are not |
| Ongoing promotions, discounts, special offers | Partial | Admin creates promotions (hero, mid-feed, product background) and offers; the public home and menu payloads carry them. The Flutter app does not render promotions yet |
| Cart, order summary, checkout | Built | Cart, server pricing, totals with tax and service fee, idempotent placement |
| Payment: card through a gateway, or cash on delivery | Partial | Cash on delivery and pay on arrival are built. Card code (Stripe intent and signed webhook) is written but switched off until keys and the app's payment sheet are in place |
| Order confirmation, status updates, notifications | Partial | Confirmation and status history are built. The app refreshes every 5 seconds. No push notifications |
| Saved addresses and the address picker (new in this phase) | Built | Add, edit, delete, default; checkout picker; zone fee and minimum order; each order keeps its own copy of the address |
| Favourites, last order, frequent items on the home page | Missing | Next phase. Needs order history and item counts per customer |
| Reorder and order history | Missing | Next phase |

### 1.2 Restaurant admin panel

| Requirement | Status | What exists / what is missing |
| --- | --- | --- |
| Branch-level access for Dubai and Abu Dhabi, central visibility | Missing | No branches, no roles, one shared staff password |
| Daily menu: add, edit, remove, prices, availability | Partial | Built for the single restaurant (categories, items, gallery, availability). Not per branch |
| Create, modify, publish promotions and discounts | Built | Promotions with placement and live window; offers |
| Real-time notifications for new orders | Missing | The admin page does not poll or stream. The order board needs a live channel (server-sent events or websocket) and an alert |
| View and manage orders: accept, prepare, dispatch | Partial | Accept, status steps and the kitchen rule that prevents skipped steps are built. Not live |
| Basic order history and sales reporting | Missing | Order list only. No sales reports |
| Delivery areas (new in this phase) | Built | Staff draw areas with a fee and minimum; deactivate an area; outline validated (no self-crossing) |
| Staff accounts with two-factor sign-in | Missing | Shared password today |

### 1.3 Order and delivery management

| Requirement | Status | Note |
| --- | --- | --- |
| Route an order to the branch for its service area | Missing | Areas exist; areas do not yet belong to a branch |
| Immediate notification to the kitchen | Missing | See 1.2 |
| No automated rider assignment; manual coordination | Built by design | Staff update statuses by hand |
| Staff update order status manually | Built | |

### 1.4 Payments

| Requirement | Status | Note |
| --- | --- | --- |
| Card gateway integration | Partial | Stripe intent and webhook code exists and is tested with a signed event. Not live. A UAE gateway may be a better fit (see section 6) |
| Cash on delivery | Built | |
| Payment status and transaction tracking for management | Missing | Payments are stored and unreadable by staff by design (row-level security test). No admin view or reconciliation |

## 2. Hardcoding audit (your rule: everything backend-driven, managed in the admin)

Found by searching the code, counted on 2026-10-29:

| Item | Where | Status |
| --- | --- | --- |
| Restaurant identity | One UUID constant in `web/lib/data.ts` (`restaurantId`) | Hardcoded. Needs a branch table; every query is scoped to it |
| Currency code | `AED` literal in the cart empty state (fixed here, now from the restaurant row), in the admin `CODE` constants (Offers, Products, Zones), in the Flutter cart and checkout defaults, and in the assistant's sample | Partly hardcoded. The Flutter defaults and admin constants should come from the restaurant record |
| Currency precision | `money.ts` and `money.dart` both list AED with 2 digits | Hardcoded table. Move to the `currencies` table in the schema, which already exists |
| Tax label and rate | Read from the restaurant row | Backend-driven |
| Service fee | Read from the restaurant row | Backend-driven |
| Delivery fee and minimum order | Per zone, now read from the database | Backend-driven |
| Cities (Dubai, Abu Dhabi) | Only in the seed file | Data, not code |
| App copy (about 100 sentences) | Dart getters in `mobile/lib/core/strings.dart` | Hardcoded in the app. Moving copy to the database needs a copy table and an admin editor; this is a decision (section 6) |
| Default address label ("Home") | Server default and the address sheet | A default value, not a rule; can come from a list in the database |
| Payment method list | Restaurant flags (cod, card, pay on arrival) | Backend-driven |

Not yet verified: any value in the admin pages that is typed in by hand instead of read from the API. The list above covers the code paths that were searched.

## 3. Feasibility

Yes. The current stack covers most of the scope: Next.js route handlers on Postgres with PostGIS (zones), a Flutter customer app, a React admin, one-time code sign-in, and an order state machine. The gaps are structural and known:

1. **Branches.** Add a `branches` table (name, address, phone, hours, currency, tax) and a `branch_id` on zones, menu availability, orders and staff. Route each order to the branch that owns the matched zone. Admin roles: branch manager, central viewer.
2. **Live orders.** Server-sent events from the API to the admin order board, and an in-app alert. Customer status uses the same channel instead of polling.
3. **Payments.** Choose a UAE-licensed gateway (or Stripe, where it is available to the merchant); finish the app's payment sheet; add refunds and a reconciliation view.
4. **Notifications.** Push through Firebase Cloud Messaging and Apple Push, plus SMS for the one-time code and the order status.
5. **Reports.** Sales by day, branch and item from the orders table. Read-only views, cached.
6. **Hosting.** A UAE region for the database and media if the client requires data residency.

## 4. Approach (summary)

- Keep one API (Next.js on Postgres/PostGIS) for both apps and the admin. Mobile uses bearer tokens; the web uses cookies.
- Every business value (branches, zones, fees, copy, payment methods, promotions) lives in the database and is edited in the admin.
- Phase 1 (customer ordering, two branches, cash and card, admin order board with live alerts): customer app, admin, branches, payments, notifications.
- Phase 2 (member offers, loyalty, favourites and reorder, reports, staff two-factor): after Phase 1 is in use.
- Security: the controls in `replica/security.md`; a penetration test before store release.

## 5. Estimate (our estimate, for planning only)

Assumes 2 engineers (one mobile, one full stack) plus a designer part-time, and the answers in section 6.

| Work | Estimate |
| --- | --- |
| Branches, branch routing, branch and central admin roles | 2 weeks |
| Live order board, in-app alerts, push and SMS notifications | 2 weeks |
| Payments: gateway, card flow in the app, refunds, payment tracking | 2–3 weeks (plus the gateway's onboarding time) |
| Customer app: per-branch menu, promotions, favourites, last order, reorder, order history | 3 weeks |
| Guest checkout with mobile number; optional sign-in; member offers and loyalty | 2 weeks |
| Admin: menu per branch, reports, staff accounts with two-factor, copy editor | 2–3 weeks |
| Hardening: security review, penetration test, store submission, user acceptance testing | 2–3 weeks |
| **Total** | **about 14–18 weeks** |

## 6. Clarifications needed before a firm estimate

1. Payment gateway: Stripe, or a UAE gateway (for example Network International, Checkout.com, Telr or PayTabs)? One merchant account for both branches, or one per branch?
2. Branch routing: is the branch chosen only by the zone of the delivery address? Can staff move an order to the other branch?
3. Guest checkout: is a verified mobile number required for every guest order, or only for cash on delivery?
4. Loyalty and member offers: point rules, tiers, expiry. Which offers are member-only?
5. Notifications in version 1: push and SMS, or in-app only? Does the kitchen need a sound alert?
6. Reports: which measures (sales, orders, average ticket, cancellations, payment mix), and by what period?
7. Admin users: how many, and what each branch may see. Two-factor for all staff?
8. Data residency: must data stay in the UAE?
9. Maps: which provider and budget for the map pin? Delivery areas drawn as polygons is the proposal.
10. Copy: should the app's wording be editable in the admin, or fixed in the app?
11. Store accounts: who owns the Apple and Google developer accounts?
12. Languages: English and Arabic, both full right-to-left screens. Confirm both are required from version 1.

## 7. Reusable modules

| Module | Where | Reuse |
| --- | --- | --- |
| Sign-in with one-time codes, sessions, step-up sheet | `web/lib/accounts.ts`, `mobile/lib/auth` | Direct |
| Cart, server pricing, checkout, order state machine | `web/lib/orders.ts`, `web/lib/pricing.ts`, `web/lib/status.ts` | Direct; add branch |
| Saved addresses and delivery zones | `web/lib/orders.ts` (address rules), `web/lib/data.ts`, `web/lib/zones.ts` | Direct; add branch |
| Media gallery and promotions | `web/lib/gallery.ts`, admin Products and Promotions | Direct |
| AI assistant (restaurant and own orders only) | `web/lib/ai/` | Optional for version 1 |
| Encryption at rest, security headers, webhook signatures | `web/lib/crypto.ts`, `web/lib/stripe-signature.ts`, `next.config.mjs` | Direct |
| Flutter widget dashboard and design tokens | `mobile/lib/core/theme.dart`, dashboard widgets | Direct |
| Admin shell and pages | `admin/src` | Direct |
