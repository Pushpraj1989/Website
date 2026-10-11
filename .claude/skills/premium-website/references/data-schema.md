# Data schema: `data/<slug>.json`

One file per site. Only `slug`, `name`, `short`, `theme`, `contact` are required; every
other block switches on a feature when present. Working examples:
`data/demo-coffee.json` (studio theme, catalogue, assemble), `data/badr-al-samaa.json`
(doctors, packages, branches, news, everything).

## Identity and look

```json
"slug": "acme", "name": "Acme Coffee Co.", "short": "Acme", "sector": "Café",
"meta": "One-sentence description for search engines and the footer.",
"theme": "studio",            // or story | clinic | ember | cosmos | editorial | route
"promo_fx": "ripple",         // slider transition: flow | burn | pixel | blinds | streak | ripple
"accent": "#d48c4f",
"brand": {                     // studio theme only
  "mode": "dark",              // dark | light
  "bg": "#130e0b", "fg": "#f4ebe1", "accent": "#d48c4f", "accent_ink": "#130e0b", "alt": "#1b1410",
  "font_display": "\"Fraunces\", Georgia, serif", "font_body": "\"Inter\", system-ui, sans-serif",
  "fonts_url": "https://fonts.googleapis.com/css2?display=swap&family=Fraunces...&family=Inter..."
},
"img_dir": "acme",             // photos live in shared/img/<img_dir>/
"cta": {"label": "Order ahead", "short": "Order", "href": "contact.html"},
"footer_note": "optional override of the concept disclaimer"
```

## Home page order (studio theme)

```json
"home": ["promo", "rail",
  {"type": "statement", "kicker": "Acme", "text": "One big sentence."},
  {"type": "assemble", "id": "signature-latte"},
  "catalogue",
  {"type": "split", "image": "cafe", "kicker": "The café", "title": "…", "body": ["…"], "points": ["…"], "cta": {"label": "…", "href": "…"}, "flip": false},
  "services", "stats", "testimonials", "partners", "news", "locations", "emi", "bmi", "faq"]
```
Section types: promo, rail, statement, stats, services, catalogue, assemble, split, news,
testimonials, partners, locations, faq, bmi, emi. Order is yours.

## Images

```json
"images": {"cafe": {"src": "cafe.jpg", "alt": "Café interior with arched windows", "cap": "Illustrative"}}
```
Refer to images by key everywhere else. Credits go in `data/credits.json` under
`"<img_dir>/<file stem>"` with title, creator, license, license_url, landing, and
`"owner": true` for the company's own photos.

## Top of page

```json
"ticker": {"label": "Latest", "items": [{"tag": "New", "text": "Headline", "href": "news-x.html"}],
           "emergency": {"label": "Ambulance 24/7", "number": "+968 2479 9760", "tel": "+96824799760"}},
"promos": [{"image": "latte", "tag": "Signature", "kicker": "Spanish latte", "short": "Tab label",
            "title": "Slide headline", "text": "One or two lines.",
            "cta": {"label": "Read", "href": "@news:Title prefix"}, "cta2": {"label": "Menu", "href": "menu.html"}}],
"rail": {"title": "How can we help?", "items": [{"label": "Book", "sub": "In two minutes", "icon": "check", "href": "contact.html"}]}
```
Link shortcuts resolve at build time: `@news:<title start>`, `@svc:<title start>`,
`@sp:<speciality>`, `@cat:<product title start>`, and `#section-id` on the home page.
Icons: pulse, heart, layers, shield, leaf, chart, star, building, factory, globe, pin,
phone, mail, truck, clock, arrow, check.

## Content blocks

```json
"stats": [{"value": 20, "suffix": "+", "label": "Branches"}, {"years_since": 2002, "label": "Years"}],
"about": {"title": "…", "body": ["…"], "more": ["…"],
          "timeline": [{"year": "2002", "title": "…", "text": "…"}],
          "values": [{"title": "Vision", "text": "…"}], "points": [{"title": "…", "text": "…"}]},
"services": {"title": "…", "nav": "Services", "intro": "…", "items": [
   {"title": "Cardiology", "icon": "pulse", "text": "Short line", "image": "img-key",
    "detail": {"intro": "First paragraph", "body": ["…"], "points": ["…"], "points_title": "Procedures",
               "facts": [{"label": "Doctors", "value": "12"}], "src": "https://source"}}]},
"specialities": { same shape as services, "in_nav": false },
"highlights": { same shape, "page": false to keep it home-only }
```

## Catalogue (menu, products, plans, accounts, rooms, models, projects)

```json
"catalogue": {"title": "Menu", "nav": "Menu", "intro": "…", "home_title": "Today's menu",
  "categories": ["Coffee", "Bakery"], "compare": true, "compare_title": "Compare drinks",
  "cta": "Order ahead", "note": "Prices as of …", "specs_title": "Details", "nutrition_title": "Nutrition",
  "items": [{
    "title": "Spanish latte", "category": "Coffee", "price": "OMR 1.900", "price_note": "12 oz",
    "badge": "Signature", "featured": true, "text": "One line.", "body": ["Longer copy"],
    "image": "photo-key",                        // or "layers" for drawn art
    "layers": [ {...see assemble...} ],
    "specs": [{"label": "Size", "value": "12 oz"}],       // also feeds the compare table
    "nutrition": [{"label": "Energy", "value": "260 kcal", "pct": 13}], "serving": "per cup",
    "options": [{"label": "Milk", "values": ["Whole", "Oat"]}],
    "tags": ["Vegan option"], "cta": {"label": "Apply", "href": "contact.html"}, "src": "https://…"
  }]}
```
Pages: `<nav>.html` (filters + search), `p-<title>.html` per item, `compare.html`.

## Product assembly

```json
"assemble": [{"id": "signature-latte", "product": "Spanish latte",   // product: also shows on that product page
  "kicker": "Signature drink", "title": "How we build a Spanish latte", "intro": "…",
  "price": "OMR 1.900", "price_label": "Spanish latte", "cta": {"label": "Order", "href": "contact.html"},
  "on_catalogue": false,
  "layers": [   // bottom first
    {"name": "Condensed milk", "note": "A spoon at the base", "shape": "liquid", "color": "#e9d6b4", "h": 22, "w": 0.86},
    {"name": "Glass", "shape": "glass", "h": 30, "w": 1.08, "wb": 0.86}
  ]}]
```
Shapes: disc, dome (`dots` for sesame), leaf, sauce, drip, foam, dust, ice, liquid, glass
(container drawn over the stack), card (`chip: true`), bar, scoop, image (`"image": "packshot-key"`).
`h` = thickness, `w` = width factor (1 = full), `overlap` pulls the next layer down.

## Places, people, proof

```json
"locations": {"title": "…", "nav": "Branches", "intro": "…", "book_label": "View branch", "items": [
  {"name": "Ruwi", "full_name": "Acme Hospital - Ruwi", "type": "Hospital", "country": "Oman", "image": "key",
   "address": "…", "phone": "+968 …", "email": "…", "about": "…",
   "lat": "23.59", "lng": "58.54",              // map embed; else a search by name
   "links": {"directions": "https://goo.gl/maps/…", "reviews": "…", "instagram": "…", "website": "…"},
   "phones": [{"label": "Reception", "number": "+968 …"}, {"label": "Emergency", "number": "…"}],
   "hours": [{"label": "Emergency", "value": "Open 24/7"}, {"label": "Clinics", "value": "Sat–Thu 8am–10pm"}],
   "emergency": true, "opened": 2002, "doctors": 54, "specs": ["Cardiology", "ENT"]}]},
"doctors": {"title": "Find a doctor", "intro": "…", "items": [{"name": "Dr. …", "title": "…", "q": "MBBS, MD", "branch": "Ruwi", "spec": "Cardiology"}]},
"packages": {"title": "…", "nav": "Packages", "intro": "…", "items": [{"name": "…", "price": "OMR 35", "country": "Oman", "text": "…", "incl": ["…"], "at": ["Ruwi"], "image": "key"}]},
"news": [{"title": "…", "date": "September 29, 2026", "tag": "Press release", "summary": "…", "image": "key", "body": ["…"], "src": "https://…", "sample": false}],
"testimonials": [{"name": "…", "date": "…", "text": "…"}], "testimonials_note": "As published on …",
"partners": {"kicker": "Partners", "intro": "Headline", "partners": ["NAME", "NAME"]},
"faq": [{"q": "…", "a": "…"}], "faq_title": "Questions people ask",
"emi": {"title": "…", "currency": "OMR", "min": 1000, "max": 100000, "value": 20000, "rate": 6, "months": 48, "cta": "Apply", "href": "contact.html"}
```

## Contact, nudges, verification

```json
"contact": {"title": "Book an appointment", "intro": "…", "address": "…", "email": "…",
  "phones": [{"label": "24/7 helpline", "number": "+968 2271 7171"}, {"label": "WhatsApp", "number": "+968 9393 2255", "whatsapp": true}],
  "note": "Preview form", "form": {"branch": true, "topics": ["…"], "submit": "Send"}},
"nudges": {"dock_label": "Book or call",
  "offer": {"id": "pk35", "kicker": "Preventive health", "title": "Check-ups from OMR 35", "text": "…", "cta": "Compare", "href": "packages.html", "image": "key"}},
"cta_band": "Sentence on the call-to-action band of inner pages.",
"detail_cta": {"title": "…", "text": "…"},
"confirm": ["Every open question, conflict or unverified figure"],
"sources": ["https://… (read 11 Oct 2026)"]
```
`confirm` and `sources` are written to `VERIFY.md` on every full build.
