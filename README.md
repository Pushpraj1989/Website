# Premium website kit

Build a premium, multi-page website with real motion for any company, from its existing
website. Banks, insurers, hospitals, cafés, protein brands, contractors, couriers, hotels,
schools: one data file per company, one command to build, static files to host anywhere.

Works with any AI assistant: Claude Code picks up the skill automatically
(`.claude/skills/premium-website/`, or type `/premium-website`). Other tools read `AGENTS.md`.
People can follow the same steps by hand.

## What a build includes

- **Multi-page by default:** home, about, a page per service, a product catalogue with a page per item
  and a compare table, locations with a page per branch (live map, timings, phones,
  actions), news with articles, and contact. Sector extras include a doctor directory,
  priced packages, projects and investor pages.
- **Home sections you order in data:** a WebGL promo slider with six transition styles, a quick-action
  rail, stats, a services grid, a draggable product strip, a product that assembles layer
  by layer as you scroll, split features, testimonials, a partners marquee, news, a 3D curved
  locations slider with a detail panel, FAQ, and BMI or loan calculators.
- **Nudges:** a news-flash ticker with an emergency pill, a floating contact dock, an action bar
  on phones, a one-time offer slide-in, and a scroll progress ring.
- **Motion:** smooth scroll, reveals in both scroll directions, page transitions, a mega menu with
  previews, and scroll-scrubbed graphics. Reduced-motion and no-JavaScript fallbacks are included.
- **Online ordering:** a cart drawer, checkout (delivery or pickup; card through Thawani Pay, cash on
  delivery, pay at the counter, WhatsApp), an order status page, a meal-plan builder and a small order
  service (`server/shop_api.py`) that re-prices every order and verifies payments. See
  `.claude/skills/premium-website/references/commerce.md`.
- **Real content:** scraped from the company's site, with sources and a `VERIFY.md` of open questions.

## Quick start

```
pip install jinja2 pillow playwright        # Playwright only for QA

# 1. answer the intake (the skill asks you), saved as briefs/<slug>.json
# 2. research the current site
python3 tools/scrape.py https://www.example.com --slug example --images
# 3. start the data file from a sector preset
python3 tools/new_site.py --slug example --sector banking --scrape research/example/summary.json
# 4. fill the TODOs with real content, add photos to shared/img/example/, then build and test
ONLY=example python3 build/build.py
python3 tools/qa.py example
# 5. deploy
./deploy/deploy.sh root@<server-ip>          # or GitHub Pages / any static host
```

Open `sites/<slug>/index.html`, or the hub `index.html` that lists every site.

## Reference builds in this repo

| Site | Theme | Shows |
| --- | --- | --- |
| `badr-al-samaa` | story | 90 pages from real content: 337-doctor directory, 41 priced packages, 36 specialities, 19 branch pages with maps, 18 news posts, glass anatomy |
| `demo-coffee` | studio | Fictional café: menu with drawn product art, product pages with options and nutrition, a compare table, a latte and a sandwich that assemble on scroll |
| `healthy-lab` | studio | 99 pages: a restaurant with no website, built from its Talabat menu (90 dishes with prices and macros), online ordering with Thawani Pay, meal-plan builder; its own salad photo opens into labelled ingredients, its own burger splits into real layers, cut-out lineup |
| `dar-global` | studio | 81 pages: real-estate developer, tower in drifting clouds, construction stages, scrubbed walk-through, offices with maps |
| `galfar` | ember | Industrial: rising embers, project panels |
| `national-gas` | cosmos | Energy: particle sphere, 3D fly-through |
| `starcare` | clinic | Clinical: kinetic type, horizontal departments |
| `assarain` | editorial | Conglomerate: curtains, company index |
| `asyad-express` | route | Logistics: globe arcs, route drawn on scroll |

## Where things live

| Path | What it is |
| --- | --- |
| `.claude/skills/premium-website/` | The skill: workflow, intake questionnaire, sector guide, data schema, module catalogue, content rules, QA and deploy |
| `presets/<sector>.json` | 16 sector presets: pages, home order, rail, tools, signature graphics, scrape focus, questions, compliance |
| `tools/scrape.py` | Crawls any site (robots-aware): pages, headings, text, prices, phones, emails, socials, news, products, locations, large photos |
| `tools/new_site.py` | Writes `data/<slug>.json` from a preset + brief + scrape, ready to build |
| `tools/cutout.py` | Cuts real product photos out of their background (BiRefNet) so food and products float on the page |
| `tools/split_layers.py` | Splits one real product photo into its layers (burger, salad bowl) for the exploded `stack` and `converge` scenes |
| `tools/serve.py` | Local preview that also forwards `/api/` to the order service |
| `server/shop_api.py` | Order and payment service for sites with a `shop` block (standard library, systemd on the server) |
| `tools/qa.py` | Browser QA of every page on desktop and phone, plus reduced motion; exits 1 on problems |
| `data/<slug>.json` | One company's content and settings. `data/credits.json` holds image credits |
| `build/build.py` | Renders every site (all pages), the hub and `VERIFY.md`. `ONLY=<slug>` builds one |
| `build/art.py` | Draws layered product art for the assemble module and product cards |
| `build/templates/` | `base`, `partials/` (header, footer, nudges, macros for every module), `pages/` (one template per page type), `themes/` (studio plus six signature themes) |
| `shared/css`, `shared/js` | `core.css` and `core.js` for structure and site-wide behaviour, `fx.js` for effects (WebGL slider, assemble, curved slider, canvases), and theme CSS |
| `shared/vendor/` | GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13 (no CDN needed) |
| `deploy/` | `deploy.sh` (over SSH) and `install.sh` (on the server): nginx block for the server IP |

## Rules the kit follows

Real facts only, each with a source. Prices are shown as published, with a date. No made-up reviews. Licensed images
with credits. "Illustrative" on stock photos. Concepts and demos are labelled as such.
Details are in `.claude/skills/premium-website/references/content-rules.md`.

Arabic and RTL layouts are not built in yet. Add them per site if the client needs them.
