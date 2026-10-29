# Test plan: food app (slice, EN and AR)

Build: food-app/web on claude/festive-fermat-mvjq25 (see git log for the commit)
Date: 2026-10-29. Env: local, Postgres 16.15 + PostGIS, sample seed (`db/seed.sql`).
Browser: Chromium (preinstalled), Playwright 1.56.1. Projects: phone (Pixel 5 viewport) and desktop (1440px).

Automated where a browser or a database check can prove it. Manual where a real provider is needed.

## Flows in scope (slice)

F01 guest places an order · F02 staff runs the live board · F03 card payment · F04 language and RTL (cross-cutting)
F05 access rules (cross-cutting)

## Cases

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | guest orders | happy | add two items, checkout, cash on delivery, place | order page says Placed; one order row, total 11800 fils | e2e: f01-guest-order | pass |
| F01-E1 | guest orders | edge: double tap on Place order | two dblclicks on Place order | exactly one order row | e2e: f01-guest-order | pass (see bugs.md, intermittent) |
| F01-E2 | guest orders | edge: refresh mid-cart | add item, reload cart | item still there (cart is on the server) | e2e | pass |
| F01-E3 | guest orders | edge: empty cart | open cart with nothing in it | message shown, no checkout link | e2e | pass |
| F01-E4 | guest orders | edge: sold-out item | open menu | sold-out badge, no Add button | e2e | pass |
| F01-E5 | guest orders | edge: long note | open cart note | input limited to 200 characters | e2e | pass |
| F01-E6 | guest orders | edge: quantity limit | open cart quantity | input max is 20 | e2e | pass |
| F01-E7 | guest orders | edge: two tabs, same cart | add in tab 1, look in tab 2 | same cart in both | manual | not run |
| F01-E8 | guest orders | edge: slow network on submit | throttle, place order | button shows busy, one order | manual | not run |
| F01-N1 | guest orders | negative: delivery without address | place order with empty address | reason shown, no order row | e2e | pass |
| F01-N2 | guest orders | negative: pay on arrival offered for delivery | open checkout for delivery | option absent | e2e | pass |
| F01-N3 | guest orders | negative: sold out at checkout | sell out an item after it is in the cart | refused with the item name, no order | api: e2e-api (sold_out) | pass for the API; UI message not run |
| F01-A1 | guest orders | a11y | scan menu, cart, checkout | no axe violations | e2e: f01 + accessibility | pass after fix (see bugs.md B-03) |
| F02-H1 | staff board | happy | sign in, accept with time, customer page updates | customer sees Accepted within 12 s, no reload | e2e: f02-staff | pass |
| F02-N1 | staff board | negative: wrong password | sign in with wrong password | message shown, stay on login | e2e: f02-staff | pass |
| F02-E1 | staff board | edge: board without sign-in | open /admin signed out | sent to sign-in | e2e: f02-staff | pass |
| F02-E2 | staff board | edge: kitchen skips a step | move placed order straight to delivered | refused, status unchanged | api: e2e-api | pass |
| F02-A1 | staff board | a11y | scan the board | no axe violations | e2e: f02-staff | pass |
| F03-H1 | card | happy: option offered | checkout with Stripe configured | Pay by card visible | e2e: f03-card | pass |
| F03-H2 | card | happy: signed webhook confirms | post signed payment_intent.succeeded | order goes to Placed on the page | e2e: f03-card + api | pass |
| F03-N1 | card | negative: provider refuses | Stripe test key rejected (401) | order stays Waiting for payment, error shown, not marked paid | e2e: f03-card | pass |
| F03-N2 | card | negative: bad signature | webhook with wrong signature | 400, order unchanged | api: e2e-api | pass |
| F03-N3 | card | negative: wrong amount | webhook amount differs from total | order stays awaiting_payment | api: e2e-api | pass |
| F03-E1 | card | edge: replayed webhook | same event twice | one Placed transition, one history row | api: e2e-api | pass |
| F03-N4 | card | negative: declined card (4000 0000 0000 0002) | pay with declined test card | error in the sheet, no order change | manual (needs live test keys) | not run |
| F03-N5 | card | negative: 3-D Secure cancelled | pay, cancel challenge | stays awaiting_payment | manual | not run |
| F04-H1 | language | happy: switch to Arabic | press the Arabic link | RTL, Arabic labels, prices with western digits | e2e: accessibility | pass |
| F04-E1 | language | edge: language kept while links prefetch | load menu, reload | still English | e2e: language-cookie | pass (regression for the GET cookie bug) |
| F04-A1 | language | a11y in Arabic | scan Arabic menu, cart, checkout | no axe violations | e2e: accessibility | pass |
| F05-H1 | access | customer sees own orders only | two customers, RLS as client role | one row each | db: test/rls.test.mjs | pass |
| F05-N1 | access | customer reads another customer's lines, addresses | as client role | nothing | db: rls | pass |
| F05-N2 | access | customer updates another profile | as client role | 0 rows changed | db: rls | pass |
| F05-N3 | access | customer inserts an order for someone else | as client role | refused by RLS | db: rls | pass |
| F05-N4 | access | anonymous reads sensitive tables | as no user | 0 rows in orders, customers, addresses, payments, payment events, refunds, audit | db: rls | pass |
| F05-N5 | access | payments unreadable by customers and staff | as client role | 0 rows | db: rls | pass |
| F05-H2 | access | staff reads every order | staff role | all orders | db: rls | pass |
| F05-N6 | access | guest order invisible to a signed-in customer | as client role | 0 rows | db: rls | pass |
| F05-N7 | access | guest order read by another browser | second cookie jar | 404 | api: e2e-api | pass |

## Not run (needs a person or a provider)

- F03-N4, F03-N5: declined card and 3-D Secure challenge need live Stripe test keys and a browser that can take the challenge.
- F01-E7, F01-E8: two tabs and throttled network are manual.
- Apple Pay, Google Pay, Samsung Pay on a real device: not built or not testable here.
- Email and SMS: not in the slice.
- Flutter customer app: not started.

## Totals

- Unit: 8 pass (money, pricing, webhook signature, status, language parity).
- API exit test: 17 of 17 pass.
- Access (RLS): 8 of 8 pass.
- Browser walkthrough (script): pass.
- Playwright suite: 42 of 42 pass (21 tests on each of the phone and desktop projects), final run of `npm test`.
