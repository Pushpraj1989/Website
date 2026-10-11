# Modules, pages and motion catalogue

What the engine can render, and when to use each. Map every reference (site, Figma,
video) the person shares to items here; build new modules only for what is missing.

## Home sections (studio `home` list)

| Type | What it is | Use when |
| --- | --- | --- |
| promo | Full-screen slider, WebGL transition (`promo_fx`), tabs with progress, swipe, pause | always (top of home) |
| rail | "How can we help?" quick actions overlapping the slider | always |
| statement | One huge sentence, words reveal | brand story, manifesto |
| stats | Count-up figures on an accent band | real numbers exist |
| services | Card grid; hover reveals photo; links to detail pages | services, departments, divisions |
| catalogue | Draggable strip of product cards (photo or drawn art) | products, menu, plans |
| assemble | Pinned section: product explodes and builds layer by layer as you scroll, parts list lights up, price pops in | food, drinks, protein, cards, devices, buildings |
| split | Big photo + copy + checklist + CTA, parallax | story, place, feature |
| testimonials | Rotating quotes | published testimonials only |
| partners | Two marquee rows of names | insurers, clients, brands |
| news | Three latest articles | news exists |
| locations | 3D curved slider + live detail panel (map, timings, phones, actions) | branches, stores |
| faq | Accordion | always useful |
| bmi / emi | On-device calculators | health / finance, property, cars |

## Pages (generated from data)

about · services listing + one page per service · specialities · catalogue + one page per
product + compare · doctors directory (search, filters, show more) · packages (country tabs,
inclusions) · locations (curve slider + full list) + one page per branch (map, timings,
phones, specialities, doctors, links) · news + articles · contact (form preselects the branch).

## Site-wide

Loader on first visit, page wipe transitions, mega menu with image preview, news ticker with
emergency pill, floating contact dock, phone action bar, offer slide-in (once), scroll
progress ring, smooth scroll (Lenis), custom cursor and magnetic buttons on desktop,
reduced-motion and no-JS fallbacks.

## Motion techniques available

| Technique | Where |
| --- | --- |
| WebGL displacement transitions (6 styles) | promo slider (`promo_fx`) |
| Scroll-scrubbed pinned timeline | assemble, chapters, stacked panels, horizontal scroll |
| Bidirectional reveals (lines, words, chars, wipe, scale) | any element with `data-anim` |
| 3D curved carousel with drag/swipe | locations |
| Particle sphere, embers, floaters, dotted globe with arcs | canvases in signature themes (`data-fx`) |
| Glass anatomy SVG with hotspots | story theme |
| Velocity marquees | partners, ticker, marquee |
| Parallax (`data-speed`), drift of giant words (`data-drift`) | images, headings |
| Tilt on hover (`data-tilt`), magnetic buttons (`data-magnetic`) | cards, CTAs |
| Count-up numbers (`data-count`) | stats |

## Building something new

When a reference needs a technique not listed (for example scroll-scrubbed video frames,
3D model viewer, text-mask video):
1. Add a macro in `build/templates/partials/macros.j2` and a `module()` branch for it.
2. Add CSS in `shared/css/core.css` (theme tokens only: --bg, --fg, --accent, --line,
   --surface, --muted, --font-display) and JS in `shared/js/fx.js` (GSAP + ScrollTrigger are
   loaded; check `T1.motion` and give a static fallback).
3. Document it here and in data-schema.md so the next build can use it.
Vendored libraries: GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.13 (`shared/vendor/`).
