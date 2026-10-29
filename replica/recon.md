# Recon map: single-restaurant food ordering app (web + mobile, EN and AR)

Scope: a food ordering app for ONE restaurant, not an aggregator. Customers browse one menu,
order for delivery or pickup, and pay online or on arrival. The restaurant has its own admin
panel to manage the menu, images, offers and discount rules, and to run the order board.
For: the client restaurant (name, brand and copy to be supplied by the client; this map uses
placeholders such as {{restaurant}}). Date: 2026-10-29.

## Method and honesty about the evidence

- No screenshots of the original apps were taken. replica/screens/ is empty on purpose.
- No account was used on any competitor app. The research is public sources only:
  help pages, app-store copy, bank promotion terms and third-party market write-ups.
- Confidence is marked on every claim: high (official page), medium (several independent
  sources agree), guess (inferred from the category; must be checked by hands-on use).
- Market promotion terms are bank-specific. None of the sources found a general
  "guest vs logged-in discount" rule for a food app in the GCC. The rules engine in this clone is
  therefore designed as configurable, not copied from a competitor.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Talabat app listing (App Store) | https://apps.apple.com/app/id451001072 | feature copy: tracking, card or cash payment, saved cards, vouchers. Marketing copy: medium |
| 2 | Talabat FAQ | https://corporate.talabat.com/faq/ | live order tracking from preparation to delivery; payment methods vary by country. High |
| 3 | Talabat Oman bank offers (Muzn, Oman Arab Bank) | https://timesofoman.com/article/152721-muzn-islamic-banking-announces-exclusive-50-discount-on-talabat-orders ; https://www.oman-arabbank.com/oman-arab-bank-partners-with-talabat-to-offer-exclusive-weekend-discounts-on-all-orders-for-credit-card-holders/ | discounts tied to a card and a promo code; the app must hold the card as the preferred payment method. High for the promo mechanics |
| 4 | Bank promo terms with guest exclusion (Bahrain, UAE) | https://www.credimax.com.bh/en/offers/mastercard_and_talabat_food_offer ; https://www.arabbank.ae/mainmenu/home/Consumer-Banking/talabat-thursday-offer | "shall not apply for the visitors or guests": the guest exclusion pattern. Medium (not Oman) |
| 5 | Talabat Oman overview | https://ar-pay.com/en/category/talabat-oman | app-only deals; gift vouchers redeemable in the app after registering. Low (third party) |
| 6 | Careem Food (feature overview) | https://gulfnews.com/business/corporate-news/careem-food-and-careem-pay-expand-into-abu-dhabi-1.1712058701384 | one account and one wallet across services; real-time tracking; order history for reordering; Ramadan offers. Medium |
| 7 | Deliveroo (UAE, Qatar, Kuwait overview) | https://www.digitalgravity.ae/blog/food-delivery-apps-in-dubai/ | real-time rider tracking; scheduled delivery; rewards. Low (third party) |
| 8 | Oman payment landscape | https://www.checkout.com/de-de/payment-methods/omannet ; https://docs.oman.paymob.com/docs/integration-process | cash on delivery is the most common method; Omannet is the main domestic card network. High |
| 9 | Khedmah Delivery (Oman) listing | https://apps.apple.com/us/app/id6738427748 | cash on delivery or card through a payment gateway. Medium |
| 10 | Thawani | https://www.omanobserver.om/ampArticle/81877 | wallet and QR payments; 2017 article, status must be confirmed. Low |
| 11 | The user's own restaurant | to be provided | the client's real menu, prices, opening hours, delivery zone and offers. Authoritative for content |

Not yet done (needs the user): hands-on checkout walkthrough of a competitor app with a
test account the user is allowed to use. Until then, flows marked "guess" are unverified.

## Core loop

A hungry customer picks a dish from one restaurant's menu, pays (online or on arrival) and
tracks the order until it arrives or is collected.

## Screens

Customer app (EN and AR, RTL flips the whole layout):

| ID | screen | route / how to reach | purpose | key components | states seen (source) |
| --- | --- | --- | --- | --- | --- |
| S01 | Language and welcome | first launch | choose English or Arabic, then continue | language toggle, primary button | first run (guess) |
| S02 | Menu home | tab 1 | browse categories and popular items | category rail, offer banner carousel, item card, search icon, cart bar | filled, loading, restaurant closed (guess) |
| S03 | Offers | banner or tab | list active offers, each marked for guests, members or both | offer card, eligibility badge, code chip | filled, empty, expired (guess; sources 3-5) |
| S04 | Item detail | tap an item | photo, description, options (size, add-ons), quantity, notes | option groups, stepper, sticky add-to-cart | filled, sold out (guess) |
| S05 | Cart | cart bar or tab | review items, edit quantities, apply a promo code, see the discount breakdown | line items, promo field, price summary | empty, filled, promo invalid, minimum order not met (guess) |
| S06 | Checkout | from cart | choose delivery or pickup, address, time (ASAP or scheduled), payment method | segmented control, address picker, time picker, payment options, summary | delivery, pickup, outside delivery zone (guess; source 2) |
| S07 | Sign in or continue as guest | at checkout or from account | phone number with a one-time code, or email, or continue as guest | phone input, OTP input, guest button | new, returning, OTP wrong, OTP expired (guess; source 4 implies the account question matters) |
| S08 | Online payment | after Pay | hosted card page (3-D Secure), return to the app | payment sheet, loading, result | success, declined, cancelled (guess; sources 3, 8) |
| S09 | Order placed | after payment or after choosing cash | order number, ETA, the next step | status card, view tracking button | cash order, card order (guess) |
| S10 | Order tracking | from S09 or orders | status timeline: received, accepted, preparing, on the way, delivered or ready for pickup | timeline, map (delivery only), call restaurant | live, delayed, cancelled (sources 1, 2, 6, 7) |
| S11 | Orders | tab 4 | past and current orders | order row, status chip, reorder | empty, filled (source 6) |
| S12 | Order detail | tap an order | items, totals, payment, reorder, feedback | reorder button, rating stars, receipt | completed, cancelled, refunded (guess) |
| S13 | Account | tab 5 | profile, language, saved addresses, saved cards (token from the gateway), help, sign out | list rows | signed in, guest (source 1 mentions saved cards) |
| S14 | Addresses | from S13 or S06 | add and edit delivery addresses on a map | map pin, text fields, label (home, work) | empty, filled (guess) |
| S15 | Search | icon on S02 | search dishes by name in EN or AR | search field, recent searches, results | empty query, no results (guess) |
| S16 | Error and empty states | any | network error, item unavailable, restaurant closed, out of zone | illustration, message, retry | all listed (guess) |

Admin panel (web, EN and AR):

| ID | screen | purpose | key components | states seen (guess unless noted) |
| --- | --- | --- | --- | --- |
| A01 | Sign in | staff login, two-factor | email, password, code | expired session, wrong code |
| A02 | Live orders board | new, accepted, preparing, ready, out for delivery, done | kanban columns, sound alert, accept or reject, print | empty, busy, paused (guess) |
| A03 | Menu manager | categories, items, prices, images, EN and AR text, availability | item table, bilingual form, image upload with crop, availability toggle | empty, editing, unsaved changes (guess) |
| A04 | Offers manager | create and schedule offers, set who may use them | offer form (type, value, dates, audience, minimum order, code, limits), preview | draft, scheduled, active, expired (guess) |
| A05 | Discount rules | rules that stack or do not, order of application, guest vs member settings | rule list, priority drag, dry-run test | valid, conflict warning (guess) |
| A06 | Media library | images and videos, used-by list | grid, upload, alt text EN and AR | empty, in use (guess) |
| A07 | Restaurant settings | opening hours, delivery zone and fee, payment methods on or off, languages | map zone editor, hours grid, toggles | closed for holiday, outside hours (guess) |
| A08 | Reports | sales, orders by channel, offers used, cash versus card | charts, date range, export | no data, filtered (guess) |
| A09 | Customers | list of customers with guest or member flag, order count | table, search | empty (guess) |

## Flows

```
F01 Guest orders for delivery and pays online
    S02 -> S04 -> S05 -> S06 -> S07 (continue as guest) -> S08 -> S09 -> S10
    happy path taps: about 9 (estimate, unverified)
    edge: address outside zone, card declined (back to S06 with the cart kept),
          item sold out after adding, OTP expired, app closed during 3-D Secure

F02 Guest orders for delivery and pays on arrival (cash)
    S02 -> S04 -> S05 -> S06 (cash) -> S07 (guest) -> S09 -> S10
    edge: order over the cash limit, change needed (customer enters amount)

F03 Logged-in customer uses a member offer
    S07 (sign in) -> S02 -> S03 -> S04 -> S05 (offer applied automatically) -> S06 -> S08 -> S09
    edge: offer is for members only and the guest has not signed in (show the sign-in prompt)

F04 Pickup and pay on arrival
    S02 -> S04 -> S05 -> S06 (pickup, time) -> S09 -> S10 (ready for pickup)

F05 Reorder from history
    S11 -> S12 -> reorder -> S05 (items changed or sold out are flagged) -> S06

F06 Admin publishes a dish with images and bilingual text
    A03 -> A06 (upload) -> A03 (EN and AR text, price, availability) -> publish -> visible on S02

F07 Admin creates a targeted offer
    A04 (type, value, dates, audience: guest, member or both, minimum order, code, limits)
      -> A05 (priority and stacking) -> dry-run with a sample cart -> publish -> visible on S03

F08 Kitchen works the order board
    A02 new order (sound) -> accept or reject (reason) -> preparing -> ready -> out for delivery -> done
    edge: reject after payment starts a refund; order timeout auto-cancels

F09 Language switch mid-flow
    any screen -> language toggle -> whole layout flips to RTL, numbers and dates localised,
    the cart and the open checkout keep their state
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, pressed, focus, disabled, loading | all |
| Stepper (quantity) | compact, full | min, max, sold out | S04, S05 |
| Option group | single choice, multi choice | selected, disabled, required missing | S04 |
| Item card | list, grid | available, sold out, offer badge | S02, S03, S15 |
| Offer card | banner, row | active, scheduled, expired, member only, guest allowed | S02, S03, A04 |
| Badge | offer, member only, new, sold out | neutral, accent, warning | several |
| Promo field | empty, filled | valid, invalid, minimum not met | S05 |
| Price summary | with and without discount | itemised, total only | S05, S06, S12 |
| Address picker | map, list | pin set, out of zone | S06, S14 |
| Time picker | ASAP, scheduled | slot full, closed | S06 |
| Payment option | card, cash on delivery, pay on arrival | selected, unavailable | S06 |
| Status timeline | delivery, pickup | current, done, pending, failed | S10, S12 |
| Order card | row, detail | status chip | S11, A02 |
| Toast and banner | info, success, warning, error | auto-dismiss, sticky | all |
| Bottom tab bar | 5 tabs, RTL mirrored | active, badge count | customer app |
| Admin data table | sortable, filterable | loading, empty, error | A03, A07, A08, A09 |
| Image uploader | single, multiple | uploading, cropped, too large | A03, A06 |
| Language switch | EN, AR | active | S01, S13, admin |

## Inferred data model

```
Restaurant          id, name_en, name_ar, phone, address, country (ISO code), currency (ISO code),
                    timezone (IANA), tax_label and tax rate (from the country pack), opening_hours, delivery_fee_rule,
                    min_order, accepts (card, cod, pay_on_arrival)
                    evidence: S07 settings, A07; sources 2, 8. confidence: high

Category            id, restaurant_id, name_en, name_ar, image_id, sort_order, active
                    evidence: S02. confidence: high

MenuItem            id, category_id, name_en, name_ar, description_en, description_ar, base_price,
                    image_id, available, sort_order, dietary_flags (json)
                    evidence: S02, S04, A03. confidence: high

OptionGroup         id, item_id, name_en, name_ar, min_select, max_select, required
OptionChoice        id, group_id, name_en, name_ar, price_delta, available
                    evidence: S04. confidence: medium

Offer               id, name_en, name_ar, type (percent | fixed | free_delivery | item_free | bundle),
                    value, applies_to (order | category | item), applies_to_ids, audience (guest | member | any),
                    min_subtotal, code (nullable, unique), starts_at, ends_at, usage_limit,
                    per_customer_limit, stackable (bool), priority, active
                    evidence: S03, A04, A05; sources 3, 4 (bank promos use codes and guest exclusion). confidence: medium

OfferRedemption     id, offer_id, order_id, customer_id (nullable for guest), amount, redeemed_at

Customer            id, phone (unique), email (nullable), name, locale (en | ar), is_guest (bool),
                    created_at, marketing_consent, last_seen_at
                    evidence: S07, S13. confidence: high

Address             id, customer_id, label, line_1, line_2, lat, lng, zone_id, notes
                    evidence: S14, S06. confidence: high

Cart                id, customer_id (nullable), session_token, items (json), promo_code, updated_at
                    evidence: S05 (guest carts must survive sign-in). confidence: medium

Order               id, number (human readable), channel (delivery | pickup), status, customer_id,
                    address_id, scheduled_for (nullable), locale, subtotal, discount_total,
                    delivery_fee, vat_total, total, payment_method (card | cod | pay_on_arrival),
                    payment_status, placed_at, accepted_at, delivered_at, cancel_reason
                    evidence: S09, S10, A02. confidence: high

OrderLine           id, order_id, menu_item_id, name_snapshot_en, name_snapshot_ar, unit_price, qty, options (json)
                    evidence: S12. confidence: high

Payment             id, order_id, provider (gateway name), provider_ref, amount, status
                    (pending | authorised | captured | failed | refunded), raw_event_id
                    evidence: S08; source 8. confidence: medium

StatusEvent         id, order_id, status, actor (system | staff | customer), at
                    evidence: S10 timeline, A02. confidence: high

Media               id, kind (image | video), storage_key, alt_en, alt_ar, width, height, uploaded_by
                    evidence: A06, A03. confidence: high

Setting             key, value (json), updated_by, updated_at  (hours, zone polygons, payment toggles)
                    evidence: A07. confidence: high

AdminUser           id, email, name, role (owner | manager | cashier | kitchen), mfa_enabled
                    evidence: A01. confidence: medium

AuditLog            id, actor, action, entity, entity_id, before, after, at
                    evidence: needed for offer and price changes. confidence: guess (team practice)
```

Relationships: Restaurant 1-n Category 1-n MenuItem 1-n OptionGroup 1-n OptionChoice;
Customer 1-n Address; Customer 1-n Order; Order 1-n OrderLine; Order 1-n Payment;
Order 1-n StatusEvent; Offer 1-n OfferRedemption; Order 0-n OfferRedemption.

## Business rules to design for (from the sources and the brief)

- Discount audience: each offer says who may use it (guest, member or any). A guest cannot
  use a member-only offer; the cart shows a sign-in prompt instead of hiding it. Source 4 uses
  the same guest exclusion pattern.
- Payment choices: card (online), cash on delivery, pay on arrival (pickup). The restaurant
  turns each on or off in settings. Cash has a limit per order (setting).
- A discount is recomputed on the server at checkout, never trusted from the app.
- Stacking: offers have a priority; stackable offers add up, others are exclusive. Admin
  sees a dry-run with a sample cart before publishing.
- Tax: the label and the rate come from the country pack, not from the code. The first pack is the UAE
  (VAT, 5 percent under the public rules; confirm with the client's accountant). Prices shown to the
  customer include or exclude tax according to the setting.
- Currency: any ISO 4217 currency. The first pack is AED (two decimal places). The decimal places come
  from the currency table, so a three-decimal currency such as OMR or KWD works without code changes.
  Rounding is applied once, at the order total, to the currency's smallest unit.
- Language: every customer-visible text exists in EN and AR. RTL mirrors layout, icons with
  direction, and the tab order. Numbers stay Western digits unless the client asks otherwise.

## Feature matrix

See `features.csv`: 49 rows. Must 32, should 8, could 3, skip 6. Columns: feature, area, priority, original, clone, notes.

## Out of scope (cannot or should not be cloned)

- The multi-restaurant marketplace, restaurant onboarding and commission model (one restaurant only).
- Third-party riders and dispatch network (the client's own riders, or a delivery partner's API, are a separate decision).
- Bank card partnerships and promotions (Muzn, Oman Arab Bank, Mastercard): partner deals, not product.
- Wallet, super-app services and the loyalty network of competitors.
- Competitor logos, photos, menus, copy and icons. Only the client's own content is used.
- Direct integration with a national card network (for example Omannet in Oman or mada in Saudi Arabia):
  needs a certified gateway. Plan: use a gateway that supports the networks of each country and confirm
  the client's merchant account.

## Size

Customer screens 16, admin screens 9, flows 9, entities 18. Hard parts: (1) the online payment
flow with webhooks, retries and refunds; (2) the offer rules engine (audience, stacking, limits,
race conditions when two customers use the last redemption); (3) bilingual RTL content and layout;
(4) live order status across the customer app and the kitchen board; (5) delivery zones and
fees on a map. Size: L (a quarter for a solid first release with admin, payments and EN and AR).

## Open questions for the client (block the design, not the recon)

1. Delivery: own riders, or a delivery partner? Which zones and fees?
2. Payment: which gateway does the client already have, and which card networks does it need?
3. Offers: which combinations must stack? Is a guest allowed any offer?
4. Cash on delivery: maximum order amount? Who collects change?
5. Brand: the client's own name, logo, colours and photos (the replica does not use any brand's assets).

## Video reference (added 2026-10-29): 30-second phone recording of a multi-restaurant delivery app

Source: the user's screen recording (portrait 1284x2778, 30 s). Used as a design and flow reference only.
Frames are kept in `replica/screens/video-2026-10-29/` and are never shipped or committed.
This app is an aggregator with rupee pricing, so the screens below are used for patterns, not brand.

| ID | screen | seen at | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S17 | Home feed | 0-10 s | promotions and discovery | promo banner carousel with dots, category rail with icons, quick filter chips (filters, near and fast, no packaging charges), "recommended with deals" cards with rating and delivery time, bottom tabs | loaded, banner rotating |
| S18 | Filters and sorting sheet | 10-30 s | narrow results | sort by (relevance), time (schedule, near and fast), restaurant rating (three thresholds), offers, dish price ranges, trust markers (pure veg, no packaging charges, low plastic packaging), collections (previously ordered, new to you), clear all, show results | open, selections, showing results count |
| S19 | Search | 12-22 s | find a dish or restaurant | search field with voice icon, recent and suggested queries in the field placeholder, veg toggle in the header | typed query, empty, no result (inferred) |
| S20 | Results after filter | 25-30 s | results with the active filters | result count, filter chips, cards | filtered, empty (inferred) |

New flows (from the video, inferred at the level of taps):
- F10 Filter and sort: S17 -> filters chip -> S18 (choose sort, price, veg, offers) -> show results -> S20. Clear all resets.
- F11 Search a dish: S17 -> search field -> S19 (type) -> results -> dish.
- F12 Veg only: S17 -> veg toggle in the header -> the feed and results show only pure veg items.

New features to add to features.csv (for the single-restaurant app, the same ideas apply to our menu):
banner carousel of promotions; category rail; quick filter chips; sort options; filter sheet with price ranges and dietary flags;
veg-only toggle; packaging charge shown as a setting; collections "previously ordered" and "new to you"; delivery time shown on cards.

Architecture effects: menu queries take sort, dietary, price range and collection parameters (GET /v1/menu);
a search route (GET /v1/search?q=) returns items with the same filters; recent searches stay on the device;
packaging fee and free-delivery threshold become settings; collections are computed from order history.
Design effects: the video app uses a dark theme with a strong red accent. Our tokens stay light with our own accent;
a dark token set can be added later. No colours, icons or copy from the video are used.
