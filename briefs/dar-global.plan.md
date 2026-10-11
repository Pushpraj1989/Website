# Dar Global website plan (kit test)

## Brief
- Goal: test the kit end to end on a real-estate developer. Internal only.
- Languages: English. Motion: cinematic. Forms: preview only.
- Brief file: briefs/dar-global.json

## Sources
- Current site: https://darglobal.co.uk (Next.js app, rendered with `tools/scrape.py --render`, 11 Oct 2026)
- Project portfolio, partner pages, press and FAQ collected with headless Chromium (research/dar-global/)
- Reference: Instagram reel "Real Estate Websites in 2026": building in clouds, construction scrub, full-screen video hero

## Direction
- Preset: real-estate · Theme: studio · Style: liquid (glass) on dark charcoal, gold accent
- Type: Cormorant Garamond + Manrope · Slider: flow (video slide first, so crossfade)
- Grammar: filmic · Signature move: the Dubai tower rising through drifting cloud planes
- Feeling curve:
  1. Promo film: aspiration (Marea lifestyle footage)
  2. Rail: control (find a project fast)
  3. Depth hero: awe (tower above the clouds)
  4. Stats: trust (32 years, US$23B GDV)
  5. Projects strip: desire (brands and places)
  6. Stages: confidence (real contract milestones to handover)
  7. Scrub: intimacy, the peak (walk through a Marea residence)
  8. Partners marquee: status · 9. Investors: credibility · 10. Partners grid, news, offices, FAQ: answers
  Peak: Step inside Marea (scrub)

## Sitemap
- index (sections above)
- about · partners (+11 pages) · projects (+39 pages, compare) · offices (+8 pages with maps) · news (+15 articles) · contact
- 81 pages in total

## Assets
- 168 Dar Global images (owner: Dar Global), recompressed
- Films: hero-marea (playback, MP4 + WebM), walk (scrub, keyframe-dense, MP4 + WebM, desktop + phone)

## Status
- [x] intake [x] research [x] data [x] build [x] visual check desktop + phone [ ] QA pass (running) [ ] deployed
- Open questions: see `confirm` in data/dar-global.json (indicative stats, office phones by country code, no prices, renders in the stages story)
- Next step: `python3 tools/qa.py dar-global`, then deploy with the other concept sites if wanted
