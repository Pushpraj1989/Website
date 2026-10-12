# Healthy Lab website plan

## Brief
- Goal: Healthy Lab's first website, with online ordering and a local payment gateway.
- Languages: English (Arabic name in the statement and footer). Motion: rich.
- Brief file: briefs/healthy-lab.json

## Sources
- No website. Menu, prices, photos, best sellers, rating and payment methods from the Talabat
  listing (branch 669005, Al Ghubra Ash Shamaliyyah), read 12 Oct 2026.
- Local checkout references: MacroBoost and Muscle House (Visa, Mastercard, OmanNet, cash on delivery).
- Thawani Pay e-commerce API (official docs + UAT test).

## Direction
- Preset: food · Theme: studio · Style: glass on deep green-black, logo lime accent
- Type: Bricolage Grotesque + Inter · Slider: ripple (video slide first, so crossfade)
- Grammar: appetite and numbers · Signature: the kitchen film scrubbed by scroll
- Feeling curve: promo film (appetite) → rail (control) → statement (identity) → best sellers (desire)
  → kitchen scrub (trust, the peak) → lean burger assembly (delight) → stats (proof) → meal plans
  (commitment) → Proffee assembly → branch → FAQ

## Sitemap
- index · about · menu (+90 dish pages) · meal plans · branches (+1 branch page) · checkout · order · contact
- 99 pages

## Commerce
- Cart drawer, add buttons, checkout (delivery/pickup; card via Thawani Pay, cash on delivery,
  pay at counter, WhatsApp once a number is known), order status page, meal-plan builder.
- server/shop_api.py re-prices from assets/shop.json, saves orders, creates Thawani sessions,
  verifies payment, accepts signed webhooks, admin order list.

## Status
- [x] intake [x] research [x] data [x] build [x] order flow tested with Thawani UAT [ ] owner review [ ] live keys
- Open questions: `confirm` in data/healthy-lab.json
