# Launch video: storyboard and motion specification

**Free Restaurant Ordering.** A 48-second LinkedIn launch film, built as code (Remotion) in `src/`.

## Formats

| Format | Size | Composition |
| --- | --- | --- |
| Master | 1920 × 1080 | `Launch` |
| Feed variant | 1080 × 1350 | `LaunchFeed` |

Both run at 30 fps, 1440 frames.

## Ground rules

- **Real data only.** Every number and name on screen comes from the real app's demo data: 7 dishes, the offers
  WELCOME10, FREEDEL and the AED 5 voucher, and 40 orders over six months.
- **Real product.** Phone screens are real screenshots of the app. The console cards are drawn in code to match the
  real console, with the same demo numbers.
- **Honest claims.**
  - "Ready for the stores" carries fine print: build with Flutter, publish with your own Apple and Google
    developer accounts.
  - "0% commission" is accurate. There is no per-order fee in the software; the server and card fees belong to the
    owner.
- **Original work.** The style borrows the reference's grammar (described below) but none of its brand, words or
  screens.

## Script (on-screen text, no voice-over)

| # | Time | On screen (accent word in *italics*) |
| --- | --- | --- |
| 1 | 0.0–3.2 | Still paying for / your restaurant's *app?* |
| 2 | 3.2–7.4 | Meet / your *own* / ordering app. → logo |
| 3 | 7.4–10.6 | Free. Open source. / *0%* commission. |
| 4 | 10.6–16.4 | ① Deploy on *your server.* (one command; live) |
| 5 | 16.4–22.6 | ② Add your *restaurant.* / Add your *dishes.* |
| 6 | 22.6–28.6 | ③ Run *offers.* → *vouchers.* → *campaigns.* (new order arrives) |
| 7 | 28.6–35.2 | Watch it *grow.* (sales dashboard; orders board) |
| 8 | 35.2–41.0 | ④ Ready for the *stores.* · iOS · Android · Web |
| 9 | 41.0–44.4 | Website. App. *Admin.* |
| 10 | 44.4–48.0 | Logo · 0% commission · Apache 2.0 · repo link |

## Scene by scene

### 1. Hook (frames 0–96)
- **Backdrop:** cream; a large yellow-saffron brush glow enters from the top right and drifts slowly
  (about 40 px a second, rotating about 2°).
- **Text:** "Still paying for" rises in word by word, each word 14 frames apart. Each word comes up 40 px with
  opacity 0→1 and blur 8→0 px, eased out over 18 frames.
- **Accent:** "app?" lands last in orange, with a 6% scale settle (spring, damping 14).
- **Out:** at frame 84, everything blurs out (0→14 px) and fades over 12 frames.

### 2. Brand reveal (96–222)
- **Words:** "Meet", then "your **own**", then "ordering app." swap in place one per beat (18 frames each), blurring
  in and out, like the reference's word-per-beat cadence.
- **Logo:** at frame 152 the logo mark draws on and holds for about 2 seconds. The bowl stroke draws first (path length, 20 frames), then the
  heart-shaped steam rises 30 px and fills; the wordmark slides in 24 px from the left.
- **Glow:** the brush sweeps across the frame behind the logo.

### 3. Promise (222–318)
- "Free. Open source." types in with a blinking caret, about 2 characters a frame.
- "0% commission." scales in under it. "0%" counts down 30→0 with a monospace tick, and an orange underline draws
  left to right under "commission" (12 frames, ease in-out).
- **Footnote** (small, muted): "No subscription. No per-order fee."

### 4. Step 1: deploy (318–492)
- **Card A, the terminal:** a dark card rises in (y 60 → 0, 20 frames) on the left. The install command types out
  (`curl … install.sh | sudo DOMAIN=… bash`), then three progress lines tick in:
  Database ✓, HTTPS ✓, Website · Console · App ✓.
- **Card B, "Your restaurant is live":** slides in from the right 10 frames later, showing the address
  `order.yourrestaurant.com` and three green "live" pills.
- **Camera:** pushes in 6% and pans 120 px toward card B (ease in-out).
- **Header (top left):** a step badge "1" with "Deploy on *your server.*"

### 5. Step 2: restaurant and dishes (492–678)
- **Restaurant card:**
  - the name field types "Saffron House";
  - a colour row shows 6 swatches; the cursor moves to saffron and clicks (click ripple);
  - a phone with the real app screenshot slides up beside it.
- **Header:** swaps "restaurant." → "dishes." (word cycle, like the reference's "customer → feature → team").
- **Dishes card:** replaces the restaurant card with a blur crossfade. Rows slide in one by one, 6 frames apart:
  - Garden salad, AED 18.00
  - Lentil soup, AED 15.00
  - Grilled chicken plate, AED 45.00
  - Beef kebab, AED 52.00
  - Mint lemonade, AED 12.00

  Each row has a photo thumbnail and an "On the menu" toggle that switches on.

### 6. Step 3: offers and campaigns (678–858)
- **Header:** "Run *offers.*" → "*vouchers.*" → "*campaigns.*" (word cycle, 30 frames each).
- **Offer cards** fan in, staggered:
  - a ticket "10% OFF · WELCOME10" (min AED 30, max AED 20);
  - a "Free delivery · FREEDEL" pill;
  - an "AED 5 voucher" card.
- **Toast:** at frame 820 a notification slides down from the top right: "New order #41 · AED 95.00 · Pickup".

### 7. Proof: the dashboard (858–1056)
- **Header:** "Watch it *grow.*"
- **Dashboard card:**
  - The total counts 0 → AED 2,237.00. The orders tiles count up: received 40, collected 32, average AED 62.14,
    customers 36.
  - Monthly bars grow in sequence (May–Oct); the latest bar is highlighted.
- **Cursor:** moves to the "This year" tab and clicks.
- **Camera:** pans down to the orders board; its rows slide in, and one shows a "Preparing" pill.

### 8. Step 4: stores (1056–1230)
- **Header:** "Ready for the *stores.*"
- **Phones:** two phones with real app screenshots rise in a slight 3D tilt (rotateY ±8°, parallax: the back phone
  moves 0.6× as fast).
- **Platforms:** three chips pop in: iOS, Android, Web.
- **Fine print:** "Built with Flutter. Publish with your own Apple and Google developer accounts."

### 9. Recap (1230–1332)
- Website, App and Admin in three small cards. Each tilts in and settles with a spring, 8 frames apart.
- The glow sweeps under them.

### 10. End card (1332–1440)
- The logo, large, centred: the mark scales 0.9 → 1 and the wordmark fades up.
- Tags: "0% commission" (filled), "Free & open source", "Apache 2.0".
- The URL `github.com/Pushpraj1989/free-restaurant-ordering` types in.
- The glow settles behind. The last 10 frames hold.

## Motion system (shared, in `src/motion.ts`)

| Element | Specification |
| --- | --- |
| Ease | Cubic out for entrances, cubic in-out for moves and camera; springs (damping 14–18) for pops. |
| Blur transition | Out: blur 0→14 px and opacity 1→0 over 12 frames. In: blur 10→0 px and opacity 0→1 over 16 frames. |
| Counters | Eased count over 30–40 frames; tabular figures, so digits don't jitter. |
| Cursor | Bezier path (cubic in-out); click ripple = a circle that scales 0→1.6 while fading 0.5→0 over 14 frames. |
| Camera | One `Camera` wrapper per scene: scale 1→1.06 plus a translate, cubic in-out. No spins, no hard zooms. |
| Glow | Two blurred radial blobs (saffron #F6B93B, amber #F59E0B, about 35% opacity) on cream #FFFBF3. They drift continuously and sweep on scene changes. |
| Persistent brand | The logo mark and name stay bottom left at 70% opacity in every scene except the end card. |
| Type | Inter 600/700, tracking −0.03 em. Accent colour #C2410C (saffron-orange). Ink #1C1917. |
| Legibility | At least 44 px for text in the 1080-wide feed version; headlines 96–120 px. |

## The logo: "Heart & Steam"

The mark is a bowl drawn with one confident stroke. The steam rising from it curls into a heart: *passion*, the
heart, rising from *satisfaction*, a full warm bowl. The colours run from a saffron-to-chilli gradient (#F59E0B →
#DC2626) for the heart to deep ink for the bowl. It works in one colour and at favicon size. The wordmark is
"Free Restaurant Ordering" in Inter 700. Files: `public/logo.svg`, `public/logo-mark.svg`.

## Timing sheet

| Scene | Frames | Seconds |
| --- | --- | --- |
| 1 Hook | 0–96 | 0.0–3.2 |
| 2 Brand | 96–222 | 3.2–7.4 |
| 3 Promise | 222–318 | 7.4–10.6 |
| 4 Deploy | 318–492 | 10.6–16.4 |
| 5 Restaurant + dishes | 492–678 | 16.4–22.6 |
| 6 Offers | 678–858 | 22.6–28.6 |
| 7 Dashboard | 858–1056 | 28.6–35.2 |
| 8 Stores | 1056–1230 | 35.2–41.0 |
| 9 Recap | 1230–1332 | 41.0–44.4 |
| 10 End | 1332–1440 | 44.4–48.0 |

## LinkedIn caption

> Are you still paying a developer, or a platform's commission, for your restaurant's ordering app?
>
> I've open-sourced a complete one. It's free, with 0% commission and no subscription.
>
> What's in the repo:
> → A customer website and app (web now; iPhone and Android builds with Flutter)
> → An admin console: live orders, sales dashboard, menu and dishes, offers, vouchers, delivery areas
> → English and Arabic, guest ordering, cash or card (your own Stripe)
>
> How it works:
> 1. Run one command on your own server.
> 2. Add your restaurant, logo, colours and dishes.
> 3. Run your offers and campaigns.
> 4. Build the app for the stores with your own developer accounts.
>
> You keep your customers, your data and every dirham of every order. Your only costs are a small server, and card
> fees if you take cards.
>
> It's Apache 2.0: free for restaurants, and for the developers and agencies who set them up.
>
> 👉 github.com/Pushpraj1989/free-restaurant-ordering
>
> If you run a restaurant or build for one, try it and tell me what's missing. Comments and pull requests welcome.
>
> #restaurants #opensource #foodtech #smallbusiness #flutter
