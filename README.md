# Tier 1 concept redesigns

Six concept redesigns for the Tier 1 prospects in the Oman prospects document.
Each company has its own visual language and motion, modelled on the reference
recordings (Active Theory, Pour/Play, Ember and the "No developers" reel).

These are **concept pages for internal pitch use**. They are not the companies'
official sites and are not published anywhere.

| Company | Theme | Style and motion |
| --- | --- | --- |
| Galfar Engineering & Contracting | `ember` | Charcoal and fire, condensed type. Rising embers over Salalah Airport, count-up figures, business units that fly in and assemble, iconic projects as full-screen panels that stack over each other. |
| National Gas Company | `cosmos` | Deep space, lime light. A rotating 3D particle sphere (an LPG sphere drawn in light) that disperses on scroll, scramble-decode text, glowing pill nav, glass cards in a pinned 3D fly-through. |
| Badr Al Samaa Group | `story` | Cream, teal and coral serif. Arch-framed hero with a giant word in front of and behind the image, drifting crosses, liquid waves, numbered chapters with a sticky image, eight centres orbiting a core, tilted package cards, country cards that filter the branch list. |
| Starcare Hospital | `clinic` | Clinical white on grid paper. Kinetic italic word swap ("Specialist care for newborns / recovery / surgery / pain relief"), departments in a pinned horizontal scroll, site list with a cursor-following city preview. |
| Assarain Group | `editorial` | Oxblood, parchment and brass. Curtains part over Nizwa Fort, business groups in a pinned horizontal scroll, an 18-company index with image follow. |
| Asyad Express | `route` | Night logistics, courier orange. A dotted globe with delivery arcs flying out of Muscat, a conveyor-belt marquee that reacts to scroll speed, a route line that draws itself with a parcel riding it. |

Shared across all six: smooth inertial scrolling (Lenis), an opening loader,
GSAP ScrollTrigger reveals (line, word and character splits; image wipes),
a custom cursor and magnetic buttons on desktop, a hide-on-scroll header, and
a full-screen mobile menu.

## Open them

- `index.html` – hub page with a preview of each concept.
- `sites/<slug>/index.html` – one site each. Every site folder is self-contained
  (`assets/` holds its CSS, JS, vendored libraries and only its own images).

## Rebuild

```
pip install jinja2
python3 build/build.py              # all sites, hub and VERIFY.md
ONLY=galfar python3 build/build.py  # one site while iterating
python3 build/snap.py               # optional: refresh hub previews (needs Playwright)
```

## Where things live

| Path | What it is |
| --- | --- |
| `data/<slug>.json` | All company content: facts, stats, services, locations, contact, image roles and captions, theme choice, and the `confirm` list. Edit facts here, not in HTML. |
| `data/credits.json` | Source, creator and licence for every photo. Each site's footer lists its credits automatically. |
| `build/build.py` | Renders each site with its theme, copies its assets, writes the hub and `VERIFY.md`. |
| `build/templates/base.html.j2` | Shared page frame: loader, cursor, header, contact, footer. |
| `build/templates/themes/<theme>.html.j2` | The layout for each theme. |
| `shared/css/core.css` + `shared/css/<theme>.css` | Shared structure, then each theme's palette, type and layout. |
| `shared/js/core.js` | Motion engine: smooth scroll, loader, split-text reveals, counters, parallax, velocity marquee, cursor, magnetic buttons, header, menu, location filter, form validation. |
| `shared/js/fx.js` | Effects (embers, particle sphere, floaters, dotted globe, scramble, word swap, tilt, hover preview, horizontal scroll, stacked panels, assemble, route, waves, fly-through) and each theme's choreography. |
| `shared/vendor/` | GSAP 3.12.5, ScrollTrigger and Lenis 1.1.13, vendored so the sites need no CDN. |
| `shared/img/` | Downloaded photography, resized. |
| `VERIFY.md` | Generated. Every unconfirmed or conflicting fact, per company, with sources. Read this before any pitch. |

## Images

Photography comes from Openverse: CC0 images from StockSnap and rawpixel, and
CC BY / CC BY-SA images from Wikimedia Commons and Flickr. Each site credits its
images in the footer, with licence links. Real Oman locations are used where
they exist (Salalah Airport, Duqm Fishing Port, Muscat Expressway, Nizwa Fort,
Muttrah, Seeb, Barka) plus Manama, Kuwait City, Dubai, Sharjah and Kozhikode.
Anything that does not show the actual company, project or place is captioned
"Illustrative" on the page. Generated graphics (the particle sphere, globe,
embers, floating crosses) are drawn live in canvas.

## Data rules used

- Only facts from each company's homepage (read 11 Oct 2026) or the prospects
  document appear on the page. Concept copy, such as Asyad's four-step flow, is
  labelled as such on the page and listed in `VERIFY.md`.
- Where sources conflict (Badr's facility count, Asyad's centre count), the
  concept shows one figure and lists the conflict in `VERIFY.md`.
- Galfar's counters showed `+ 0` in the page code, so they are not shown.
- Years since founding and copyright years are calculated, so they do not go stale.
- The Sultan Qaboos reference from the earlier audit is not carried over.

## Accessibility and fallbacks

- `prefers-reduced-motion` turns off smooth scroll, pinning, canvases and the loader; all content shows statically.
- If the motion libraries fail to load, the page falls back to a static, readable layout.
- Count-up numbers are written into the HTML, so no-JS readers see the real figures.
- Skip link, focus styles, keyboard-closable menu, labelled form fields.
- Checked at 1440px and 390px wide: no horizontal scroll and no console errors on any page.

## Before any of these are shown to a prospect

1. Work through `VERIFY.md` for that company.
2. Swap the concept palettes for the company's brand colours and logo.
3. Replace stock and illustrative photography with the client's own.
4. Have clinical copy (Badr, Starcare) reviewed.
5. Connect the forms to a real endpoint (`data-endpoint` on the form) or remove them.
6. Arabic and RTL versions are not built yet. Both matter for Omani clients.
