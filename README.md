# Tier 1 concept redesigns

Six concept redesigns for the Tier 1 prospects in the Oman prospects document:
Badr Al Samaa, Assarain, Starcare, National Gas Company, Galfar and Asyad Express.

These are **concept pages for internal pitch use**. They are not the companies'
official sites and are not published anywhere.

## Open them

- `index.html` – hub page linking all six concepts (open it in a browser).
- `sites/<slug>/index.html` – one concept site each. Each is self-contained
  (its own `assets/`), so it can be deployed on its own.

## Rebuild

```
pip install jinja2
python3 build/build.py
```

The build reads `data/*.json`, renders `build/templates/*.j2`, copies the shared
CSS and JS, and writes `VERIFY.md`.

## Where things live

| Path | What it is |
| --- | --- |
| `data/<slug>.json` | All company content: names, stats, services, locations, contact, and the `confirm` list. Edit facts here, not in HTML. |
| `build/build.py` | Renders the sites and calculates derived values (years since founding, nav items, country counts). |
| `build/templates/site.html.j2` | Page layout. Each section renders only if its data exists. |
| `shared/css/site.css` | Design system. Per-site colour is the `accent` field in the data file. |
| `shared/js/motion.js` | Motion layer: scroll reveal, count-up figures, parallax hero, card spotlight, location filter, mobile menu, enquiry form validation. |
| `VERIFY.md` | Generated. Every unconfirmed or conflicting fact, per company, with sources. Read this before any pitch. |

## What the design does

- Sticky header with a scroll progress bar, mobile menu, and an active-section highlight.
- Hero with staggered word reveal, drifting gradient, and a subtle parallax.
- Count-up figures. The final numbers are in the HTML, so no-JS readers see the real values, not a `+0`.
- Scroll-reveal sections, a looping marquee, and spotlight cards.
- Location list with a country filter and a live result count (Badr: 19 branches, 4 countries).
- Enquiry form with validation. With no endpoint set it shows "Preview only" and does not pretend to send.
- Phone-width layout checked at 390px; no horizontal scroll on any page.
- Motion is switched off for `prefers-reduced-motion`.

## Data rules used

- Only facts from the company's homepage (read 11 Oct 2026) or the prospects document appear on the page.
- Where sources conflict (for example Badr's facility count, Asyad's centre count), the concept shows one figure and lists the conflict in `VERIFY.md`.
- Galfar's counters showed `+ 0` in the page code, so they are not shown.
- Years since founding are calculated from the current year, so copyright years and "years of experience" do not go stale.
- The Sultan Qaboos reference from the earlier audit is not carried over.

## Before any of these are shown to a prospect

1. Work through `VERIFY.md` for that company.
2. Replace the placeholder accent colours with the company's brand colours.
3. Replace the abstract hero with real photography, if the client supplies it.
4. Have clinical copy (Badr, Starcare) reviewed.
5. Connect the forms to a real endpoint (`data-endpoint` on the form) or remove them.
6. Arabic and RTL versions are not built yet. Both matter for Omani clients.

## Known gaps

- Asyad Express: its own site blocked automated access, so its contact details and service lines are unverified. Its locations section is hidden until a list is supplied.
- National Gas: only the total of 11 plants is published, so the footprint shows countries rather than sites.
- Starcare: several branches share one address in the source; they are flagged, not guessed.
