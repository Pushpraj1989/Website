# Build log: food app (single restaurant, EN and AR)

One line per screen: ID, date, state, what is missing, what was harder than expected.
States: done (all states, tested), partial (slice behaviour only), not started.

| ID | date | state | what is missing | harder than expected |
| --- | --- | --- | --- | --- |
| S02 menu (web) | 2026-10-29 | partial | search, category rail icons, sort and filter sheet, offers banner, item detail link | nothing |
| S05 cart (web) | 2026-10-29 | partial | promo field, offers, cancellation policy, minimum order | saving on blur needed a full cart write; quantity 0 removes the line |
| S06 checkout (web) | 2026-10-29 | partial | address map and zone check, scheduled orders, tip, card 3-D Secure UI check, Samsung Pay | payment methods must come from the server, not the client, so the form reads the menu payload |
| S07 guest (web) | 2026-10-29 | partial | phone sign-in, guest to member move, cart and order move on sign-in | the guest cookie is Secure in production; local tests need localhost, not 127.0.0.1 |
| S08 card payment (web) | 2026-10-29 | partial | live Stripe run, Apple Pay and Google Pay on the device, 3-D Secure challenge test, saved cards | the Payment Element script loads from Stripe; not testable without keys in this container |
| S10 order status (web) | 2026-10-29 | partial | realtime channel (polls every 5 s), push, cancel button, rating | nothing |
| A02 live board (admin) | 2026-10-29 | partial | sound alert, roles, print ticket, filters by status | the board sends accept with a time, and the next-step button depends on channel |
| Mobile customer app (Flutter) | - | not started | everything: no Flutter SDK in this container, no project in the repo | the mobile app is the main customer surface in the plan; the slice is web only |
| Stripe webhook | 2026-10-29 | done for the slice (not a screen) | live key check; retries from Stripe are covered by unit tests, not a live retry | a state change on GET was a bug: language links are prefetched, so the switch became a POST form |

## Bugs found by the tests (fixed)

- The language link was a GET that set a cookie. Next prefetches links in view, so the cookie flipped
  between languages on every page load. Fixed: the switch is a POST form.
- The browser test used 127.0.0.1. Secure cookies are refused over plain http on that address, so the
  cart stayed empty. The test now uses localhost.
- A killed `npx` wrapper left the Next server running and the test hung. The test now starts the Next binary
  directly and kills its process group.
- A `pkill -f` pattern matched the shell that ran it and ended the session. Find the process by port instead.

## Counts (slice)

- Screens built as partial: 7 web screens (S02, S05, S06, S07, S08, S10, A02). Done: 0.
- Feature matrix after this slice: 6 yes, 16 partial, 65 no, 6 skip (of 93 rows).
- Must-haves: 56 rows. 6 yes, 16 partial, 34 no.
- Checks: 8 unit tests, 17 HTTP exit-test checks, 1 browser walkthrough at 390px (phone width).
