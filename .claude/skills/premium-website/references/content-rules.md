# Content, images and ethics

## Facts

- Use only what the company publishes (site, reports, press releases) or what the person
  gives you. Keep the source URL in `src` or `sources`.
- When sources disagree (400 vs 700 doctors), show the most authoritative one and put the
  conflict in `confirm`.
- Prices: exactly as published, with "as listed on <date>" in a note. Never compute a premium,
  rate or fee the company did not publish.
- Hours, phone numbers, addresses: copy, then check them against a second page when possible.
  If hours are not published, say "call to confirm"; never guess.
- People (doctors, leaders): names and titles as published. Check that leadership and any
  reference to a ruler or government are current.
- Testimonials and reviews: only ones the company published, with their date. Never write
  new ones, even for a demo; a demo brand can simply leave the section out.
- Concept copy you write (taglines, section intros) is fine, but it must not state new facts.
- Fix their site's errors silently in the copy (old names, broken claims) and list them in `confirm`.

## Scraping

- Honour robots.txt and use a delay (tools/scrape.py does both). Use `--ignore-robots` only
  with the owner's permission.
- Do not scrape behind logins or paywalls. Do not collect personal data beyond what is
  published for contact (staff directories are fine when the company publishes them).

## Images

Priority: the company's own photos (from their site, with `"owner": true` in credits) →
photos the person supplies → free stock under CC0 or CC BY (Openverse, Wikimedia Commons,
StockSnap, rawpixel public domain) → drawn art (assemble layers, SVG, canvas effects).
- Resize to max 1800 px wide, JPEG quality ~78; product cutouts as PNG/WebP with transparency.
- Every stock photo gets a credit entry; CC BY needs the creator and licence link (the footer
  lists them automatically).
- Caption any photo that does not show the actual company, product or place "Illustrative".
- Never present stock photos as the company's own premises, staff or patients.
- Wikimedia: request standard thumbnail widths (…/1920px-file.jpg) and slow down on 429s.

## Pitch concepts and demos

- Footer of a concept says it is a concept redesign, not the official site (default text).
- A demo brand must be fictional and say so (`footer_note`).
- Do not publish a concept as if it were the company's real site, or put it on a domain that
  looks official.
