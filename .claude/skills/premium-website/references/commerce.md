# Online ordering and payments (the `shop` block)

Use this when the company sells online: food and drinks, protein and supplements, retail,
tickets, plans. A `shop` block in `data/<slug>.json` turns the catalogue into a store:

- an add button on every product card, and a quantity stepper and "Add to order" on product pages;
- a cart drawer (header bag icon with a count) kept in the visitor's browser;
- `checkout.html`: delivery or pickup, contact details, payment choice, order summary;
- `order.html`: confirmation, card payment result, cancelled payment;
- `plans.html` when `shop.plans` is set: a meal-plan or subscription builder that sends a request;
- `server/shop_api.py`: a small order service (Python standard library) that re-prices every
  order from the site's own price list, saves it, and creates card payments.

Reference build: `data/healthy-lab.json` (90-item restaurant menu from Talabat, Thawani Pay).

## Ask at intake (round 3)

1. Payment methods: card online (which gateway; is there a merchant account?), cash on delivery,
   pay at the counter on pickup, WhatsApp order, bank transfer.
2. Order types: delivery (areas, fee, minimum), pickup (which branch), scheduled times, subscriptions.
3. Where orders should arrive: the built-in orders page, WhatsApp, email, a POS or delivery platform.
4. Price source: their menu or price list, or a delivery-app menu (Talabat, Deliveroo, Noon) as a start.

## Local gateways (check the merchant has an account)

| Country | Common gateways | Notes |
|---|---|---|
| Oman | **Thawani Pay** (built in), OmanNet via the bank's gateway (Bank Muscat, NBO), Amwal | Shop checkouts in Oman show Visa, Mastercard and OmanNet; cash on delivery is expected |
| UAE | Network International (N-Genius), Telr, Checkout.com, Tabby/Tamara (pay later) | |
| Saudi | HyperPay, Moyasar, Tap; mada must be offered | |
| Qatar, Kuwait, Bahrain | Tap, MyFatoorah, KNET (Kuwait), BenefitPay (Bahrain) | |

Only Thawani is implemented. Another gateway is one function in `server/shop_api.py`
(create a hosted payment session, return its URL; on return, ask the gateway for the status).
Never put card fields on the site itself: always redirect to the gateway's hosted page.

## Data

```json
"catalogue": {"items": [{"title": "Mexican Salad", "category": "Exotic salads", "amount": 2.4,
   "macros": [{"label": "kcal", "value": "330"}, {"label": "protein", "value": "15 g"}], ...}]},
"shop": {
  "currency": "OMR",
  "payments": ["card", "cod", "counter", "whatsapp"],      // order shown at checkout
  "whatsapp": "+968 9xxx xxxx",                             // empty: WhatsApp options hidden
  "gateway": "Thawani Pay", "card_logos": ["VISA", "Mastercard"],
  "add_label": "Add to order", "ask_label": "Price on options",
  "delivery": {"label": "Delivery", "short": "In Muscat", "fee": 0.5, "areas": ["Al Khuwair", "Qurum"], "note": "…"},
  "pickup": {"label": "Pickup", "short": "Al Ghubra counter", "address": "…", "map": "https://maps…"},
  "slots": ["Lunch 12–2pm", "Dinner 7–9pm"],
  "plans": {"title": "Meal plans", "goals": [{"label": "Lose fat", "text": "…"}], "meals": [2, 3], "days": [5, 6],
            "weeks": [1, 4], "categories": ["Signature meals", "Salads"], "steps": […], "note": "How the estimate works"}
}
```
- Only items with a numeric `amount` can be added to the cart (`price` is then written for you).
  Items without one show "Price on options" and an ask/WhatsApp button. Never guess an amount.
- `delivery.fee` null means "confirmed by phone": the card payment then covers the food only.
- `macros` show as chips on cards and feed the plan builder's kcal and protein totals.
- The build writes `assets/shop.json` (price list for the server) and `assets/shop-data.js`.

## The order service

```
server/shop_api.py        GET /api/health · POST /api/order · GET /api/order/<id>?site=
                          POST /api/thawani/webhook · GET /api/admin/orders?site=<slug>&key=<admin key>
```
- Secrets live in `/etc/tier1-shop.env` on the server (created by `deploy/install.sh`, mode 600):
  `THAWANI_MODE=uat|live`, `THAWANI_SECRET_KEY`, `THAWANI_PUBLISHABLE_KEY`, `THAWANI_WEBHOOK_SECRET`,
  `ORDERS_ADMIN_KEY`. Never in the repository or in chat.
- With no keys, card payment shows as "switches on when connected" and cash/pickup orders still work.
- Orders are appended to `/var/lib/tier1-shop/<slug>.jsonl`; the restaurant reads them at
  `/api/admin/orders?site=<slug>&key=<ORDERS_ADMIN_KEY>` (bookmark it on the counter tablet).
- Static hosting only (GitHub Pages, Netlify): there is no `/api`, so the checkout falls back to
  WhatsApp (if a number is set) and says the order service is not reachable.

### Thawani Pay facts (verified 12 Oct 2026 against the official docs and the UAT service)

- Docs: https://thawani-technologies.stoplight.io/docs/thawani-ecommerce-api (docs.thawani.om redirects there).
- Base: `https://uatcheckout.thawani.om/api/v1` (test) and `https://checkout.thawani.om/api/v1` (live).
- `POST /checkout/session` with header `thawani-api-key: <secret>`; body `client_reference_id`, `mode: "payment"`,
  `products[{name ≤ 40 chars, quantity, unit_amount in baisa}]` (max 30 lines; order total ≥ 100 baisa),
  `success_url`, `cancel_url`, `metadata` (live mode needs customer name, phone and email in metadata).
- Customer goes to `https://[uat]checkout.thawani.om/pay/<session_id>?key=<publishable key>`.
- `GET /checkout/session/<id>` → `data.payment_status`: `unpaid` | `paid` | `cancelled`. The order page asks the server, which asks Thawani.
- Webhook (set in the merchant portal): headers `thawani-signature`, `thawani-timestamp`;
  signature = HMAC-SHA256(secret, raw body + "-" + timestamp), hex. Event `checkout.completed` marks the order paid.
- Cloudflare in front of Thawani rejects Python's default User-Agent (error 1010); the service sends its own.
- Test keys and cards are on the docs overview page (card 4242 4242 4242 4242, any future expiry, OTP 1234).

## Test locally

```
THAWANI_SECRET_KEY=… THAWANI_PUBLISHABLE_KEY=… ORDERS_ADMIN_KEY=dev SHOP_DATA_DIR=/tmp/orders python3 server/shop_api.py &
python3 tools/serve.py          # http://localhost:8080/sites/<slug>/ with /api forwarded
```
Walk through: add from a card, add from a product page with quantity 2, open the cart, change
quantities, checkout with cash on delivery (order page shows the number), checkout by card with
the test card (order page shows "Paid"), cancel on the Thawani page (order page shows "No payment
was taken"), send a plan request, open the admin page.
