# Capturing the real product, and where photos come from

## Screens
The film shows the real product. Start it locally (or use a demo deployment) with demo data you are allowed to show.

```bash
node tools/capture.mjs --url https://app.local/ --out public/shots/app-home.png --device phone --wait 6000 --click "195,620" --click2 "40,318"
node tools/capture.mjs --url https://app.local/console --out public/shots/console-dashboard.png --device desktop
```
- `phone` = 390×844 at 3× (iPhone 13 look), touch: files are 1170×2532, what the `Phone` frame expects. `desktop` = 1600×1000 at 2×.
- `--host-map "app.local=127.0.0.1"` lets a made-up hostname point to a local server (self-signed certificates are accepted).
- Close welcome pop-ups and choose "guest" with `--click`, because the film should show the product's best honest state.
- **Look at every capture.** Two traps we hit: (1) the server was not running, so the app showed its offline fallback
  and seven "different" businesses all looked the same; (2) a pop-up covered the page. Make one contact sheet of all
  captures and check each is what you think it is before rendering.
- Shoot after the data is final: names, prices and photos in the demo must be the ones you want on screen.
- Keep capture servers from clashing with tests: stop them when done (a leftover server on the test port fails the tests).
- Tools run in the background have time limits (a server needs the longest allowed); long renders go in the background too.

## Setting a product up as different businesses (the carousel)
Script it: one setup script per product that resets the demo database and loads a sector's name, colour, products and
photos from a JSON file, then capture. Re-capture every sector after any change to the app. Keep the script out of the
public repo if it contains personal paths.

## Photos
Default: **free CC0 / public-domain only, with the source recorded.**
- **Good sources:** Wikimedia Commons (filter by licence: structured data `P275` = CC0 `Q6938433` or public domain
  `Q19652`; many CC0 files there are mirrors of Pexels/Unsplash-style studio shots, so search with plain nouns such as
  "croissant", "bouquet", "capsules", "cappuccino"). Openverse (`license=cc0,pdm`) indexes the same.
- **Etiquette and limits:** send a descriptive User-Agent. Commons rate-limits a shared IP hard (429 with `Retry-After`):
  run searches one at a time in the background, wait, use its standard thumbnail sizes (330 px for contact sheets, 960 px
  for finals). If a CDN blocks automated downloads behind a bot check, do not try to get around it: use another source.
- **Choose by looking:** make a contact sheet of the candidates and view it. Reject watermarks, logos, visible brands,
  timestamps, faces of private people, text in a language you can't vouch for.
- **Record every photo** in `public/sectors/SOURCES.md` (title, page link, licence, author). The repo for the product
  can credit them; the personal film project stays private.
- **Photos the user sends from Google Images:** do not assume they are free. Stock-library ID numbers, watermarks and
  Lens icons mean they are not. Say so, and offer: Pexels/Unsplash/Pixabay page links (their licences allow free
  commercial use; the link records the source), Google's "Creative Commons licenses" filter with the page link, or AI
  generation.
- **Paid or credit-using routes** (Figma `generate_image`, other image APIs): only after telling the user it may use
  their credits, and only if free photos fail for that subject. Label AI imagery as illustration where it could mislead.
- Never fabricate a product photo for something the product doesn't sell.
