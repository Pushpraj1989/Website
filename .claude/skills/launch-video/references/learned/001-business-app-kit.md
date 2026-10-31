# 001: Business App Kit launch film

- **Source:** a premium LinkedIn product-launch reference (a short clip and a 12-frame storyboard package with a written
  brief) sent by the user, and the original film built from it for Business App Kit (a free, open-source ordering
  system). The reference's brand, words and screens were not used.
- **Format:** 1920×1080 master plus 1080×1350 feed version, 30 fps, 52.6 s, ten scenes, silent.

## Arc (scene by scene)
| Time | Purpose | On screen | Motion |
| --- | --- | --- | --- |
| 0–3 s | Hook: the pain as a question | "Still paying for your business app?" | Words rise one by one, last word accent |
| 3–7 s | Brand reveal | "Meet / your own / ordering app." then the logo and name | Beats blur out and in; logo draws on |
| 7–10 s | The promise | "Free. Open source. 0% commission." | Typing; number counts down; underline draws |
| 10–16 s | Step 1: deploy | Terminal types one command; checks tick; "your app is live" | Camera drifts in; cards slide |
| 16–22 s | Step 2: set up | Name typed, colour picked by cursor, product list appears with toggles | Cursor path and click ripple; card cross-blur |
| 22–28 s | Step 3: offers | Offer, voucher and campaign cards pop in; a "new order" toast | Springs with rotation; toast drops in |
| 28–35 s | Proof | Dashboard counts up, a filter is clicked, camera drops to live orders | Counters, bars grow, camera move |
| 35–41 s | Step 4: stores | iOS / Android / Web chips, two phones rise, fine print | Phones rise with perspective |
| 41–49 s | Every business | Ring of nine real apps, one per business; label names each | Curved slide, 22 frames a step |
| 49–53 s | End | Logo, name, tagline, tags, the link types in | Pop, then hold |

## Grammar
Pale warm background with drifting glows; Inter type, one accent word per headline; corner brand from scene 3;
white cards drawn in code with real demo data; real phone screens; one camera move per scene; blur crossfades between
scenes; silent; honest fine print wherever a claim needs one.

## Compared with the house style
This film *is* the house style. Confirmed by it: step-numbered "do this in four moves" arcs work well in 50 seconds; the
carousel of real apps lands "works for every business" better than any list; checking both sizes catches most layout bugs.

## Lessons from building it
- Two sizes from one composition (`usePortrait`) is far cheaper than two films; check the 4:5 frames separately.
- Screens must be re-captured after any app change; offline-fallback captures slipped in once.
- Free photos from Wikimedia Commons (CC0 / public domain) were enough for nine sectors, but searching is slow
  (rate limits): start the searches first, in the background.
- The user supplied stock photos from Google; they carried stock IDs and watermarks and were declined.
- The product was renamed mid-project; the name lives in `BRAND` and `COPY` only, so renaming is one file plus a re-render.

## Not taken
The reference's brand, copy, music and screens.

## Variant
`product-launch` (default): `hook, brand, promise, deploy, details, offers, dashboard, stores, sectors, end`.
Shorter for a product without an install step or a dashboard: `hook, brand, promise, details, stores, sectors, end`.
