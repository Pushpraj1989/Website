---
name: premium-website
description: Build a premium, multi-page, motion-rich website for any company (hospital, bank, insurer, café, food or protein brand, contractor, courier, hotel, school, government) from its existing website and brand. Starts with an intake questionnaire, scrapes the current site for real content and photos, picks a sector preset, then builds detail pages, product catalogues, scroll motion, WebGL sliders and product-assembly graphics, tests on desktop and phone, and deploys. Use whenever someone asks to build, redesign, rebuild or pitch a website, a landing page for a company, or a "high class / premium / animated" site.
---

# Premium website builder

This repository is a complete kit. A site is one data file (`data/<slug>.json`); the
engine (`build/build.py`, `shared/`) turns it into a multi-page static site with motion.
Badr Al Samaa (`data/badr-al-samaa.json`, 90 pages) and the demo café
(`data/demo-coffee.json`, 30 pages) are the reference builds: match or beat them.

Never ship a single page. The quality bar is in "Definition of done" below.

## The workflow (do every step, in order)

### 1. Intake: ask before you build

Ask the questions in [references/intake.md](references/intake.md), in four short rounds.
- Use the AskUserQuestion tool when you have it (up to 4 questions per call, with
  sensible options plus "Other"). Without it, send one message with numbered questions.
- If the person already answered something (in this chat, a brief, a document),
  do not ask again: confirm what you understood and ask only what is missing.
- Add the sector questions from `presets/<sector>.json` → `questions`.
- Save the answers as `briefs/<slug>.json` (format in intake.md). Everything later reads it.
- If they want you to proceed without answering, use the preset defaults and say which
  defaults you used.

### 2. Research: real content first

1. Scrape the existing site:
   `python3 tools/scrape.py <url> --slug <slug> --images` (add `--exclude '/ar/'` for duplicate
   language trees). Output: `research/<slug>/summary.json`, `pages.jsonl`, `images/`.
   If pages come back with no headings or paragraphs, the site is a JavaScript app (React,
   Next, Angular, Vue): rerun with `--render`. It drives headless Chromium, scrolls each page,
   saves the JSON the app fetches (`api/`) and lists every image and video it loads (`media.json`).
   For catalogues (projects, products, doctors), write a small Playwright collector that visits
   the listing and each item page; take item names from the listing cards, not page taglines.
   If the site blocks robots or the script, read pages with WebFetch or curl, and use web search
   for press coverage. Respect robots.txt unless the owner gave permission.
2. Go deeper where the preset's `scrape_focus` says (doctors, menu, products with prices,
   branches with phones/hours/maps, projects, rates, news). Delegate big sites to sub-agents,
   one per area, each writing JSON with a `src` on every item.
3. Study the references they gave (sites, Figma, videos, Instagram reels). For videos, pull
   frames (`ffmpeg -i clip.mp4 -vf fps=1.5,scale=300:-1 f%02d.jpg`) and look at them. List the
   motion, layout and style ideas you will reuse and map each to a module in
   [references/modules.md](references/modules.md) or a style in [references/craft.md](references/craft.md).
4. Collect footage: project films, product clips, reels. Encode clips for scrubbing with
   `tools/encode.sh` (MP4 + WebM) or turn them into frames with `tools/frames.sh`.
   Optional paid helpers (Apify for Instagram, generation tools): [references/integrations.md](references/integrations.md).
5. Note every error or contradiction on their current site (old names, conflicting numbers,
   dead links). These go into `confirm` and you never copy them as fact.

### 3. Plan: pages, sections, signature graphic

Read [references/craft.md](references/craft.md) first. Pick the preset (`ls presets/`, see
[references/sectors.md](references/sectors.md)) and decide:
- theme: `studio` (data-driven; default for any new company) or a signature theme
  (story, clinic, ember, cosmos, editorial, route) when they want that exact look;
- `home`: the ordered list of sections;
- pages: services, catalogue (menu/products/plans), locations with branch pages, news, plus
  sector extras (doctor directory, packages, compare, projects…);
- design style `brand.style`: glass, liquid, neumorph, clay, skeuo, brutal, minimal, maximal, bento, spatial;
- slider transition `promo_fx`: flow, burn, pixel, blinds, streak, ripple;
- page grammar, feeling curve and the one peak (craft.md);
- the signature graphic: layered `depth` hero, scroll-scrubbed `scrub` film, `stages` story,
  product `assemble`, anatomy, globe, particles, embers…
Write `briefs/<slug>.plan.md` ([references/plan-template.md](references/plan-template.md)).
Show the person a short sitemap and home section list. Continue unless they object.

### 4. Build the data

1. `python3 tools/new_site.py --slug <slug> --brief briefs/<slug>.json --scrape research/<slug>/summary.json`
   writes a data file that already builds, with TODO markers.
2. Replace every TODO with researched content. Schema: [references/data-schema.md](references/data-schema.md).
   - Promos and the news ticker come from real news, campaigns and offers.
   - Every catalogue item: title, category, price (as published, dated), text, specs or nutrition.
   - Branches: address, phones, hours, map coordinates or a directions link.
   - Selling online: catalogue items get a numeric `amount`, plus a `shop` block (payments, delivery,
     pickup, plans). Read [references/commerce.md](references/commerce.md).
   - Realism: cut out real product photos (`python3 tools/cutout.py … --out shared/img/<slug>/cut`) and use
     `converge`, `stack`, `lineup` with them; split one hero product into its real layers with
     `tools/split_layers.py`; drawn `assemble` art only when no photos exist (craft.md §7).
   - `assemble`: 1–2 hero products, bottom layer first, 4–7 layers, each with a name and a
     one-line note. Use `image` layers with transparent packshots when the brand has them.
3. Run the copy pass on everything you wrote: [references/copy.md](references/copy.md).
4. Keep the image budget sane: about 150 photos and 25 MB per site at most (1280 px, JPEG ~66–74),
   films encoded with `tools/encode.sh`.
5. Photos go in `shared/img/<slug>/` (max 1800 px wide, JPEG ~78). Add each to `images`
   with alt text and a caption; add licence info to `data/credits.json` (company-owned:
   `"owner": true`; stock: CC0 / CC BY with creator). Caption non-literal photos "Illustrative".
   Rules: [references/content-rules.md](references/content-rules.md).

### 5. Build, test, look

```
ONLY=<slug> python3 build/build.py      # build one site
python3 tools/qa.py <slug>              # every page, desktop + phone + reduced motion
```
QA must pass (exit code 0). Then look at screenshots yourself: home at several scroll points,
a product or detail page, the locations slider, on 1440 px and 390 px. Fix what looks
weak, not only what errors. Checklist: [references/qa-deploy.md](references/qa-deploy.md).

### 6. Deliver

Full build (`python3 build/build.py`), commit, push, deploy (`deploy/` scripts, GitHub
Pages or any static host) and send the person one link per site plus the `VERIFY.md`
items they must confirm. Say plainly what is sample or unverified.

## Definition of done (the Badr standard)

- Multi-page: home, about, a page per service, catalogue with a page per product (when they
  sell products/plans), locations with a page per branch (map, timings, phones, actions),
  news with articles, contact. Sector extras from the preset.
- Home has at least 8 sections, including: promo slider (WebGL transition), quick-action
  rail, stats, catalogue strip or services grid, one signature graphic, social proof or news,
  locations, FAQ.
- Nudges: news-flash ticker, floating contact dock, phone action bar, one honest offer slide-in.
- Motion: reveals animate when scrolling down and back up; a layered hero or scrubbed film;
  at least one scroll-scrubbed graphic; page transitions; same graphic level on phones.
- Craft: one grammar, one peak, one style, typography floor (craft.md); copy pass done.
- Real content with sources; nothing invented; `confirm` lists every open question.
- Shops: add to cart, checkout, a cash order and a test card payment all work end to end.
- `tools/qa.py` passes: no errors, no missing files, no sideways scroll, nothing stuck hidden,
  reduced motion shows everything.

## Hard rules

- Never invent facts, prices, people, reviews or awards. Unknown → leave out or mark TODO
  and add to `confirm`. Testimonials only when published by the company.
- Concepts for a pitch are labelled as concepts in the footer; demo brands as demos.
- Do not ask for passwords or tokens in chat. Deploy with the person's own access.
- Do not use paid image generation without the person's approval.
- Keep pages fast: vendored libraries only, lazy images, no frameworks needed.
