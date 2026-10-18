# Towers Real Estate: design and motion specification

Status: **proposal for approval.** No production code has been written. Step 10 of the brief
(homepage proof of concept) waits for your approval of this document.
Prepared 18 Oct 2026, Muscat. Facts marked **[unverified]** must be confirmed by Towers or an
official source before they appear on the site.

Skills used: `tower-genesis`, `property-video-director`, `real-estate-cinematic-web`,
`real-estate-quality-gates` (added to `.claude/skills/`; scanned, plain instruction text only).

---

## 0. What we have and what we are missing

| Input | Status |
| --- | --- |
| Four Towers skills (zip) | Received, checked, installed |
| Towers logo (SVG or PNG) | **Missing.** Needed before the Genesis finale can be designed |
| Approved photo of a tower Towers is marketing | **Missing.** The most important input |
| Developer-approved renders, plans, CAD or BIM | Missing (needed for accurate assembly and floor selector) |
| Project fact sheets (location, units, handover, approvals) | Missing |
| Towers' own copy, contact details, WhatsApp number, office address | Missing |
| Instagram screenshot described in the brief | Not among the uploads (see audit below) |

**Asset audit of the uploads folder** (checked 18 Oct):
- Six phone screenshots (1284×2778): a LinkedIn post, a hosting control panel (SSH key screen),
  three SignVerse app screens and one healthcare group homepage. **None shows a Towers logo,
  building or property.**
- `Oman_Website_Redesign_Prospects.docx`: a prospect list with no Towers entry.
- Nine screen recordings (`.mp4`, `.mov`). Their names suggest screen captures of other work.
  I did not review them frame by frame; tell me if one is Towers material and I will.

So the creative direction below is a **template for any approved tower**. It is not yet tied to a
real building. The brief itself asks for a real, developer-approved building as the first
decision. That decision is the first approval item (section 11).

---

## 1. Research

Sources (search results, not full reviews):
- Real-estate web patterns: [contra.com examples (2026)](https://contra.com/p/bYNrYbeO-real-estate-website-a-cinematic-animation-driven),
  [FireArt roundup](https://fireart.studio/blog/great-real-estate-website-examples/). These are mostly
  freelancer portfolio pieces, so they are design references, not verified live sites. The
  FireArt piece reports a 98+ Lighthouse score on a cinematic site; that figure is their claim.
- Trend context: the sources listed in `motion-2026.md` (scroll-linked motion, kinetic type,
  pointer response, restraint).
- Oman ownership and residency (news, not yet checked against an official source):
  - [Oman Observer](https://www.omanobserver.om/ampArticle/1191803) and
    [Metropolitan Real Estate](https://metropolitan.realestate/media/news/oman-property-owner-visa-sponsor-free-2026/)
    report **Decision No. 87/2026**: sponsor-free visas for property owners. Owners of registered
    residential units can get a Property Owner Residency. Buyers of unregistered land or unfinished
    units can get six-month to one-year renewable visas. Residency depends on the property; if it
    is sold, the permits lapse.
  - [Muscat Daily (19 Aug 2026)](https://www.muscatdaily.com/2026/08/19/what-foreign-buyers-get-wrong-about-omans-new-property-rules/)
    reports that foreign ownership is **not open in all areas**, and that a Real Estate Registry
    Law (Royal Decree 56/2026) took effect 18 May 2026. The sources disagree on scope.
  - **[unverified]** Minimum investment, taxes, which areas are open, and eligibility conditions.
    None of these may appear on the site until Towers' counsel confirms them against the Ministry
    of Housing and Urban Planning.

What we take from the research:
1. Cinematic hero plus a clear route to enquiry, not a search-first homepage.
2. Dark, warm, restrained surfaces; large type; one accent colour.
3. Performance is a design constraint: video is a poster with a short loop, not a background
   film on every device.
4. Legal and eligibility copy must be labelled and sourced. It must not read as a sales claim.

---

## 2. Kit reuse: how much of the existing design helps

The kit in this repository is a static site generator (Python, Jinja2, GSAP, Lenis, Playwright QA).
It already solves several problems in this brief. Reuse is high for motion patterns, quality
checks and bilingual handling. It is low for the application layer (CMS, lead routing, property
data), which the brief needs.

| Need in this brief | Already in the kit | Reuse |
| --- | --- | --- |
| Scroll-scrubbed video (Tower Genesis, day-night) | `scrub` module, `tools/encode.sh` (MP4 + WebM), `tools/frames.sh` | **High** |
| Layered hero with depth and pointer lean | `depth` module | **High** |
| Stage-by-stage build (foundation → structure → facade) | `stages` (clip-path wipes), `assemble` (layer build) | **Medium.** Works on still photos, not 3D |
| Cutout of building or product from a photo | `tools/cutout.py` (BiRefNet) | **High.** Use for building masks |
| Layer split of one image | `tools/split_layers.py` | Medium (food-tuned; test on buildings) |
| WebGL transitions | `promo_fx` in `fx.js` | Medium (reuse the shader approach) |
| Logo blended with the site (light and dark variants) | `tools/logo.py` | **High** |
| Arabic RTL and extraction-based translation | `build/i18n.py`, `shared/css/rtl.css` | **High** for static pages; the brief needs native Arabic review |
| Reduced motion, no-JS fallback | Built in (`T1.motion`, `no-motion` class) | **High** |
| Playwright QA at desktop and phone, reduced motion | `tools/qa.py` | **High** |
| Enquiry form, shop-style server | `server/shop_api.py` pattern | Medium. Enquiries need CRM routing, not orders |
| Property catalogue, filters, residence explorer, floor selector | Catalogue and detail pages (static data) | Low. Needs a structured data model and a CMS |
| Next.js, TypeScript, React Three Fiber | Not in the kit | New |

**Decision needed:** keep the static kit for a homepage proof of concept (fastest, already
tested), or start a Next.js project now. Recommendation in section 9.

---

## 3. Three visual concepts

All three use the same content rules and the same accessibility gates. They differ in mood and
in how much the site moves.

### Concept A: Architecture in Motion (recommended)
- Cinematic. Midnight navy hero, a Tower Genesis film, champagne-gold light used sparingly.
- Motion is the signature: the building is the story; scroll controls its construction and light.
- Best for: a flagship tower launch and for winning premium developer briefs.
- Risk: most motion; needs the strictest budget and mobile fallbacks.

### Concept B: Editorial Ivory
- Light and calm. Warm ivory base, large serif headings, gold rules and captions, few animations.
- Photography leads; the film is one short loop; reveals are simple fades.
- Best for: a trusted, long-established feel and Arabic-first readers.
- Risk: less distinctive; gold must be used only as decoration, never for text on ivory (2.04:1).

### Concept C: Investor Ledger
- Data-forward. Plans, floor selector, unit grid and investment guide come first; film is secondary.
- Motion is functional: floor selection, filters and the investment guide's steps.
- Best for: investors who compare options and want the facts first.
- Risk: weaker emotional pull; relies on approved data that Towers may not yet have.

**Recommendation:** Concept A as the direction, with Concept C's floor selector and investment
guide as its functional core. Concept B's typography and light layout for the Arabic and
investment-guide pages. This keeps one visual system with three moods on different pages.

---

## 4. Wireframes

### Homepage (desktop, 1440 wide; mobile stacks the same order)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Towers   Properties  Oman investment  Developers  About   EN | ع   [Enquire] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   [ Tower Genesis film, pinned, scroll-scrubbed; poster on mobile ]  │
│                                                                      │
│   Headline (serif, 2 lines max)                                      │
│   One sentence on what Towers offers (no claims)                     │
│   [ Explore properties ]   [ Invest in Oman ]                        │
│                                                       scroll cue ↓   │
├──────────────────────────────────────────────────────────────────────┤
│ 02  Featured residence  (one approved project, large photo + facts)  │
│     location · handover [unverified] · "Enquire about this project"  │
├──────────────────────────────────────────────────────────────────────┤
│ 03  Property collection  (horizontal cards, filters, enquiry on each)│
├──────────────────────────────────────────────────────────────────────┤
│ 04  Why invest in Oman  (scroll chapters: ownership, process, risks) │
│     every point sourced; "Confirm with a consultant" link            │
├──────────────────────────────────────────────────────────────────────┤
│ 05  Developers  (logo row, approved names only)                      │
├──────────────────────────────────────────────────────────────────────┤
│ 06  Concierge  (3 questions → suggested route → enquiry, not a bot)  │
├──────────────────────────────────────────────────────────────────────┤
│ Footer: contact, WhatsApp, legal, language, privacy                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Property detail (one project)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Header (compact)                                                     │
├──────────────────────────────────────────────────────────────────────┤
│ Hero: approved photo, slow parallax; project name, location          │
│ [ Enquire ]  [ WhatsApp ]  [ Download brochure (after form) ]        │
├──────────────────────────────────────────────────────────────────────┤
│ Facts table: type · size · handover · status  (all [unverified]     │
│ until Towers supplies them; empty cells say "Ask us", never guess)   │
├──────────────────────────────────────────────────────────────────────┤
│ Floor selector: stacked floors (left) · selected floor plan (right)  │
│ keyboard: ↑ ↓ to change floor, Enter to open the unit               │
├──────────────────────────────────────────────────────────────────────┤
│ Gallery: approved photos and renders, labelled "Render" or "Photo"   │
├──────────────────────────────────────────────────────────────────────┤
│ Location map (static image by default; interactive map on request)  │
├──────────────────────────────────────────────────────────────────────┤
│ Developer card · Documents (approved only) · Legal notes · Enquiry   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tower Genesis: five-stage storyboard

Rules that apply to every stage:
- **Identity lock.** The building's silhouette, floor count, window grid and roof must match the
  approved photo. Nothing is added, removed or morphed. If the approved photo does not show a
  feature, the animation does not show it either.
- **Disclosure.** Any frame that is not the real building (assembly, glow, sky) is labelled
  "Visualisation" in the site UI and in the legal footnote.
- **Logo last.** The Towers logo is an SVG overlay, never generated by an AI video tool.
- **Duration.** 6 to 10 seconds of motion per stage on desktop; mobile plays a 3-second poster
  loop and a scroll-scrubbed still sequence.

### Stage 1: Genesis (0–1.5 s of the scroll)
- **Look:** dark frame; a faint architectural grid lights up on the ground plane; the site outline draws.
- **Trigger:** page load, after the loader; the scroll position starts the scrub.
- **Camera:** static, low, slightly above ground. Lens 35 mm equivalent.
- **Lighting:** near-black sky; cool grid lines in ivory at 20% opacity; gold only on the outline.
- **Mode:** deterministic CSS/SVG grid over the approved photo's ground plane (no AI needed).
- **Fallback:** the grid is a still image; no motion; text reads at once.

### Stage 2: Assembly (1.5–4 s)
- **Look:** structure appears floor by floor from the foundation up; columns and slabs first, then glass.
- **Trigger:** scroll progress 15%–40% of the film section.
- **Camera:** slow push-in, 4° orbit at most, to keep the building's real angle.
- **Lighting:** flat daylight matched to the approved photo; no added sun.
- **Mode:** **Mode A (generated video)** if Towers approves the visualisation, otherwise **Mode B**
  (layered masks from the approved photo, revealed bottom-up with `stages`). Mode B needs no
  invented geometry and is the default.
- **Fallback:** the approved photo with the same reveal, or the final frame as a still.

### Stage 3: Energy wave (4–7 s)
- **Look:** a champagne-gold light band climbs the facade in a shallow spiral, lighting window
  rows as it passes; it fades once it reaches the top.
- **Trigger:** scroll 40%–70%.
- **Camera:** locked; the light does the movement.
- **Lighting:** gold `#C8A66B` at additive blend; max 35% intensity; no lens flare.
- **Mode:** WebGL shader over a **facade mask** generated from the approved photo with
  `tools/cutout.py` and hand-checked. The mask is the only geometry the wave needs.
- **Fallback:** a static "lit" frame (the approved photo with a gold gradient at the top edge).
  Reduced motion uses the fallback.

### Stage 4: Crown reveal (7–9 s)
- **Look:** the roof edge lights up; the top floors glow for a moment, then settle to a daylight
  or dusk state matching the photo.
- **Trigger:** scroll 70%–85%.
- **Camera:** a slow 6–8° pullback begins (the camera moves away, not the building).
- **Lighting:** a roof mask with soft gold light; night variant only if the approved photo is at night.
- **Mode:** roof mask (hand-drawn in the same mask file) plus CSS opacity. No 3D needed.
- **Fallback:** a still of the lit roof.

### Stage 5: Investment reveal (9–11 s and after)
- **Look:** the pullback reveals the building in its surroundings; the Towers logo fades in on
  the sky side, centred, at 40% of the frame width; the page then moves to the collection.
- **Trigger:** scroll 85%–100%; the logo appears at 92%.
- **Camera:** pullback ends on the approved wide view; no invented neighbouring buildings. If
  the approved photo has no context, the frame stays tight on the building.
- **Lighting:** settles; the logo is a flat SVG.
- **Mode:** logo as an SVG layer; surroundings only from approved photos.
- **Fallback:** the wide still with the logo already placed.

### Provider-neutral prompts (only for Mode A, only with approval)

Shot 2 (assembly), 16:9, 6 s:
> Photorealistic architectural visualisation of the building in the attached reference image.
> The structure builds upward floor by floor from the foundation. Keep the exact silhouette,
> floor count, window grid and roof shape of the reference. Camera: slow push-in, 35 mm
> equivalent, no more than 4 degrees of orbit. Lighting: flat daylight matching the reference.
> Start frame: foundation only. End frame: the reference image.

Negative prompt (all shots): *melting architecture, extra floors, missing floors, warped windows,
changed roof, phantom people, flicker, changing neighbouring buildings, distorted lettering,
logos, text, watermarks, camera shake, lens flare, over-saturated colour.*

Shot 3 (energy wave): **do not generate with AI.** Build it in WebGL from the facade mask (Stage 3).
This keeps the light path exact and the file small.

Each Mode A clip is listed in `asset-manifest` with its prompt, the model used, the date and the
label "Visualisation". Nothing is published without the disclosure.

---

## 6. Other animations: trigger, timeline, camera, lighting, fallback

Each candidate from the brief is evaluated for reliability and cost. "Use" means it goes in the
proof of concept; "Defer" means later; "No" means not in this build.

| Animation | Use? | Trigger | Timeline | Camera / lighting | Fallback | Mode |
| --- | --- | --- | --- | --- | --- | --- |
| Building assembly | Yes (Genesis 2) | scroll 15–40% | 2.5 s | push-in ≤4° orbit; daylight | last frame | Mask reveal (B) or generated video (A) |
| Scroll-scrubbed architecture | Yes | section scroll | scrub, no ease | none | poster | GSAP ScrollTrigger + scrubbed WebM |
| Camera parallax (depth) | Yes, hero only | pointer or scroll | continuous | 3 planes at different rates | single image | CSS transforms, GSAP |
| Facade illumination | Yes (Genesis 3) | scroll 40–70% | 3 s | gold, max 35% | lit still | WebGL shader on mask |
| Day-to-night | Defer | scroll or toggle | 4 s | only with an approved night photo | day still | Two approved photos, crossfade (no AI night) |
| Cinematic masks (image reveals) | Yes | enters viewport | 1.2 s | none | static image | CSS clip-path, `data-anim="img"` |
| Interactive floor selector | Yes (residence page) | hover, click, ↑↓ keys | 0.4 s | none | list of floors | DOM + SVG, data-driven |
| Smooth page transitions | Yes, subtle | navigation | 0.6 s fade | none | normal navigation | CSS view transitions where supported; otherwise fade |
| WebGL effects beyond the wave | No | — | — | — | — | Not needed; costs battery and LCP |
| Full 3D building (R3F) | Defer | residence explorer | — | orbit within limits | 2D floor plan | Only if approved CAD or GLB exists |
| Magnetic buttons, tilt | Yes, desktop only | pointer | 0.4 s | none | plain buttons | GSAP, fine pointer only |
| Pointer spotlight on cards | Yes | pointer | — | soft accent light | none | CSS + JS (from the kit) |

Decision rule (from the brief): **generative video for cinematic sequences; deterministic 3D only
where geometry is verified.** We have no verified geometry yet, so the assembly and light effects
in this table use masks from the approved photo, not 3D models.

---

## 7. Design system

### Colour tokens

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--midnight` | `#081522` | Base dark background | — |
| `--navy-raised` | `#1B2A3A` | Cards on dark | — |
| `--gold` | `#C8A66B` | Accent on dark; rules; icons | 8.00:1 on midnight (text OK) |
| `--ivory` | `#F5F1E8` | Base light background; text on dark | 16.33:1 on midnight |
| `--slate-text` | `#56646F` | Body text on ivory | 5.40:1 on ivory |
| `--slate-muted` | `#6E7E8C` | Captions on dark only | 4.41:1 on midnight |
| `--ink` | `#081522` | Text on ivory | 16.33:1 |

Rules (from the contrast check):
- Gold is never body text on ivory (2.04:1). Use it as a rule, icon or large display accent only.
- The brief's slate `#667786` fails AA on ivory (4.10:1) and on midnight (3.99:1). It is replaced
  by `--slate-text` for text. `#667786` may be used for non-text shapes only.
- Verify every new colour pair before it ships; `real-estate-quality-gates` requires this.

### Typography
- **Display:** an elegant serif for headings (one family; choose and license it before build;
  must include Arabic or be paired with an Arabic display face). Tight tracking at display sizes.
- **Body:** a clean sans with strong legibility; one Arabic companion face for Arabic.
- Body measure 45–75 characters; line height 1.5–1.7 (Arabic 1.7–1.9).
- Headline length: no more than four lines on a 390 px phone.

### Spacing and layout
- 8 px base; section padding 96–160 px desktop, 64–96 px phone; 16 px phone gutter.
- 12-column grid desktop, 4-column phone. RTL mirrors the grid, not the imagery.

### Components (inventory)

| Component | Purpose | States to design |
| --- | --- | --- |
| Header + language switch | Navigation, EN/AR | default, scrolled, open (mobile), focus |
| Hero (film or still) | Opening | film playing, poster, reduced motion, error |
| Genesis player | Scroll-scrubbed film with logo | scrub, poster, fallback still, reduced motion |
| Property card | Collection item | default, hover (spotlight), sold/unavailable [unverified status], focus |
| Filter bar | Location, type, status | empty results, active filter chip |
| Featured residence block | One approved project | with/without approved photo |
| Floor selector | Choose floor | idle, hover, selected, keyboard focus, disabled floor |
| Unit list | Units on floor | available / reserved / unknown (never guess) |
| Facts table | Approved data | filled, "Ask us", not yet confirmed |
| Gallery with label | Photo vs render | photo, render, video poster |
| Concierge (3 questions) | Route to enquiry | step, summary, enquiry hand-off |
| Enquiry form | Lead capture | default, error, success, consent required |
| WhatsApp button | Direct contact | default, offline hours [unverified] |
| Legal note | Disclosure | visualisation label, eligibility notice |
| Developer card | Approved developer details | with logo, text-only |
| Footer | Legal, privacy, language | — |

### Motion tokens
- Durations: 150 ms (micro), 400 ms (UI), 800–1200 ms (reveals), 3–6 s (film scenes).
- Easing: `expo.out` for reveals (as in the kit), `power2.inOut` for scrubs.
- Reduced motion: no scroll-driven transforms; crossfades only at 150 ms; film replaced by stills.

---

## 8. Quality gates (from `real-estate-quality-gates`)

Every gate is measured on desktop and a throttled mobile profile, in English and Arabic.

| Gate | Target | How |
| --- | --- | --- |
| LCP (75th percentile) | ≤ 2.5 s | Lighthouse and field data; hero poster is the LCP image |
| INP | ≤ 200 ms | Interaction tests on floor selector and filters |
| CLS | ≤ 0.1 | Fixed media aspect ratios; no late-loading banners |
| Hero video | Poster first; mobile never loads the desktop WebM | Network check on 390 px |
| Accessibility | WCAG 2.2 AA | Keyboard path, focus order, alt text, contrast table above, form errors |
| Reduced motion | No scroll-driven motion; stills shown | Browser setting test |
| Arabic | True RTL; native review of every string | Reviewer sign-off |
| Factual accuracy | Every number and claim has a source or "unverified" label | Content audit before release |
| Imagery | Photo vs render vs visualisation is labelled | Editorial review |
| Legal | Eligibility and investment copy reviewed by counsel | Written sign-off |
| Forms | Spam protection, consent, data minimisation, safe uploads | Security review |
| Jank and flashing | No strobe; no vertigo-inducing camera; 60 fps target on mid-range phones | Recording review |

The kit's `tools/qa.py` (Playwright, desktop, phone, reduced motion) is reused as the automated
part of these gates. Manual checks (imagery, legal, Arabic) remain manual.

Budgets (proposed, to confirm in the proof of concept):
- Homepage first load ≤ 1.5 MB on phone, excluding the film, which loads after the poster.
- Film: desktop WebM ≤ 6 MB for 10 s at 1920 wide; mobile WebM ≤ 2 MB at 1080 wide; poster ≤ 150 KB.
- JavaScript on the homepage ≤ 200 KB compressed before the film.

---

## 9. Technical architecture

### Recommendation
- **Homepage proof of concept:** keep the static kit's proven pipeline for speed of review, or
  start Next.js (TypeScript) now. My recommendation is **Next.js + TypeScript** from the start,
  because the property platform needs a CMS, localized routes, lead routing and schema markup
  (`RealEstateAgent`, `Residence`), which the static kit does not provide.
- **Motion:** GSAP + ScrollTrigger (already used in the kit; reliable with Lenis).
- **3D:** not on the homepage. R3F and Three.js only for the residence explorer, and only when
  approved CAD or GLB exists. Otherwise WebGL shaders (the Stage 3 wave) and plain SVG.
- **Video:** pre-rendered WebM and MP4 with posters. Scrubbing uses an image sequence or a
  short video; no autoplay audio.
- **Google Flow / Veo:** usable only for Mode A, and only through a connected tool with access
  granted by Towers. This document does not confirm current Flow or Veo capabilities;
  verify on the vendor's site before relying on them.

### Alternatives considered

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Static kit (current) | Tested, fast to build, already has motion and QA | No CMS, no routing for property data, weak for lead management | Good for a quick mock-up only |
| Next.js + TypeScript + GSAP | CMS and i18n routing, SEO, forms, schema | More setup; team must maintain it | **Recommended** |
| WordPress + theme | Familiar to clients | Motion work becomes custom code anyway; weaker control | Not recommended |
| Full 3D everywhere (R3F) | Impressive | Heavy on phones; needs geometry we do not have | Rejected |

### Asset pipeline
1. Intake: approved photos, logo, fact sheets, renders, plans (stored with source and approval date).
2. Labelling: every asset is tagged Photo, Render, Visualisation or Plan.
3. Masks: building and facade masks made with `tools/cutout.py`, checked by hand.
4. Video: generated or captured clips → frames → WebM and MP4 (`tools/encode.sh`, `tools/frames.sh`).
5. Export: responsive sizes (AVIF/WebP plus JPEG fallback), posters, lazy loading.
6. Manifest: `asset-manifest` lists each file, its source, prompt if generated, date and label.

### Content model (for the CMS)
- **Project:** name (EN/AR), developer, location, status, handover [unverified until confirmed],
  approved facts, legal notes, photos and renders with labels, floor data.
- **Floor:** number, plan image, units, status (available / reserved / unknown).
- **Unit:** type, area, orientation, view, price (only when Towers provides it and it is current).
- **Developer:** name, approved logo, approved description, approved projects.
- **Enquiry:** source page, language, consent flag, timestamp, route (sales, investor, developer).
- **Guide section (Oman):** claim, source, date checked, reviewer, "confirm with consultant" flag.

### Lead flow
Short form (name, contact, interest, timeline) → CRM route by enquiry type → confirmation in the
language the visitor chose. WhatsApp link opens with a prefilled, non-personal message. No chatbot.

### Privacy and consent
Cookie consent before analytics; no tracking before consent. Data minimisation on forms. Uploads
are scanned and limited by type and size. API keys stay on the server.

---

## 10. Content rules

- No prices, availability, returns, handover dates or approvals unless Towers supplies them
  with a date. Empty fields say "Ask us".
- No eligibility claims. The residency section explains the published framework and links to
  the official source, with a reviewer's name and date on it.
- No invented neighbourhood facts, building statistics or developer claims.
- Visualisations are labelled. Renders are labelled. Photos are credited.
- Arabic copy is written and reviewed by a native speaker, not translated word for word.

---

## 11. Approval items (please answer before step 10)

1. **Direction:** Concept A, with C's floor selector and guide, and B's typography for Arabic and the guide? Or a different mix?
2. **First building:** one developer-approved tower (photo, logo rights, fact sheet). This is the first decision in the brief.
3. **Brand files:** Towers logo (SVG preferred) and any brand guidelines.
4. **Genesis mode:** Mode B (deterministic masks, no invented geometry) as default, with Mode A only with approval? Or Mode A?
5. **Platform:** static kit for a quick mock-up, or Next.js + TypeScript from the start? (Recommendation: Next.js.)
6. **Legal:** who at Towers will confirm Decision 87/2026 scope, the Registry Law and every investment figure before publication?
7. **Arabic:** a native reviewer named for every page.
8. **Contact routing:** which WhatsApp number, office address and CRM (or email) enquiries go to.

Once these are answered, step 10 (homepage proof of concept) starts with the approved building.
