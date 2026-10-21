#!/usr/bin/env python3
"""Build the Tier 1 concept redesigns from data/*.json.

Each company picks a visual theme (data field "theme"); themes live in
build/templates/themes/<theme>.html.j2 and shared/css/<theme>.css.

Writes:
  sites/<slug>/*.html       home + about, listings, detail pages, locations, news, contact (+ assets/)
  index.html                hub page linking all sites
  VERIFY.md                 facts to check before a pitch, per company

Usage:  python3 build/build.py
Needs:  jinja2  (pip install jinja2)
"""

import datetime
import json
import os
import re
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

import art
import i18n
from i18n import en

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SHARED = ROOT / "shared"
SITES = ROOT / "sites"
TEMPLATES = ROOT / "build" / "templates"
YEAR = datetime.date.today().year
CREDITS = json.loads((DATA / "credits.json").read_text(encoding="utf-8")) if (DATA / "credits.json").exists() else {}

GF = "https://fonts.googleapis.com/css2?display=swap&family="
THEMES = {
    "ember": {"fonts": GF + "Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500", "theme_color": "#0e0b08",
              "label": "Ember", "motion": "Rising embers, condensed type, units that assemble, project panels that stack"},
    "cosmos": {"fonts": GF + "Space+Grotesk:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500", "theme_color": "#05040a",
               "label": "Cosmos", "motion": "3D particle sphere, scramble text, glass cards in a 3D fly-through"},
    "story": {"fonts": GF + "Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&family=Inter:wght@400;500;600", "theme_color": "#f4ede3",
              "label": "Story", "motion": "Numbered chapters, giant words behind imagery, liquid waves, orbiting centres"},
    "clinic": {"fonts": GF + "Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400", "theme_color": "#f7f9fb",
               "label": "Clinic", "motion": "Kinetic italic word swap, grid paper, horizontal departments, hover previews"},
    "editorial": {"fonts": GF + "Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Manrope:wght@400;500;600;700", "theme_color": "#1f0a0d",
                  "label": "Editorial", "motion": "Curtain reveal, horizontal business groups, company index with image follow"},
    "route": {"fonts": GF + "Unbounded:wght@400;600;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500", "theme_color": "#0d0d0f",
              "label": "Route", "motion": "Dotted globe with live arcs, conveyor marquee, route drawn on scroll"},
}

# 24px stroke icons, drawn in the same style so they match the type.
ICONS = {
    "pulse": '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    "heart": '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
    "layers": '<path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5"/>',
    "shield": '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    "leaf": '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19 13 11"/>',
    "chart": '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    "star": '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    "building": '<path d="M4 21V5a1 1 0 0 1 1-1h8v17M13 9h6a1 1 0 0 1 1 1v11M3 21h18M7 8h2M7 12h2M7 16h2M16 13h1M16 17h1"/>',
    "factory": '<path d="M3 21V10l5 3V10l5 3V6h3v15H3zM17 21V4h4v17"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    "pin": '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "truck": '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
}


def icon(name):
    body = ICONS.get(name, ICONS["layers"])
    return Markup(
        f'<svg class="ico ico-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        f"{body}</svg>"
    )


def digits(number):
    """'+968 2271 7171' -> '+96822717171' for tel: and wa.me links."""
    return "+" + "".join(ch for ch in number if ch.isdigit()) if number.strip().startswith("+") else number


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def item_image(site, item):
    for key in ("image", "bg"):
        if item.get(key) and item[key] in site.get("images", {}):
            return item[key]
    return None


def build_pages(site):
    """Every site is multi-page: home plus about, listings, one page per item,
    locations, news and contact. Files are flat (about.html, svc-x.html) so the
    relative assets/ path works on every page."""
    pages = [{"file": "index.html", "kind": "home", "title": site["name"]}]
    nav = [{"file": "about.html", "label": "About"}]
    pages.append({"file": "about.html", "kind": "about", "title": "About " + site["short"]})

    def listing(key, prefix):
        block = site.get(key) or {}
        items = block.get("items") or []
        if not items or block.get("page") is False:
            return
        label = block.get("nav") or block.get("title") or key.title()
        file = slugify(en(block, "nav") or en(block, "title") or key.title()) + ".html"
        for it in items:
            it["_file"] = f"{prefix}-{slugify(en(it, 'title'))}.html"
            it["_img"] = item_image(site, it)
            it.setdefault("detail", {})
        pages.append({"file": file, "kind": "listing", "title": block.get("title") or label, "key": key, "label": label})
        for i, it in enumerate(items):
            pages.append({"file": it["_file"], "kind": "detail", "title": it["title"], "key": key, "label": label,
                          "listing": file, "item": it, "prev": items[i - 1], "next": items[(i + 1) % len(items)]})
        if block.get("in_nav", True):
            nav.append({"file": file, "label": label, "items": items, "title": block.get("title") or label})
        block["_file"] = file

    listing("services", "svc")
    listing("specialities", "sp")
    if site.get("specialities", {}).get("_file") and nav and nav[-1]["file"] == site["services"].get("_file"):
        nav[-1]["extra"] = {"file": site["specialities"]["_file"], "label": f"All {len(site['specialities']['items'])} specialities"}
    if site.get("doctors"):
        pages.append({"file": "doctors.html", "kind": "doctors", "title": site["doctors"]["title"], "label": "Doctors"})
        nav.append({"file": "doctors.html", "label": "Doctors"})
    if site.get("packages"):
        pages.append({"file": "packages.html", "kind": "packages", "title": site["packages"]["title"], "label": site["packages"].get("nav", "Packages")})
        nav.append({"file": "packages.html", "label": site["packages"].get("nav", "Packages")})
        if site.get("highlights"):
            site["highlights"]["_file"] = "packages.html"
    listing("highlights", "item")

    cat = site.get("catalogue")
    if cat and cat.get("items"):
        label = cat.get("nav", "Products")
        file = slugify(en(cat, "nav") or "Products") + ".html"
        cat["_file"] = file
        for it in cat["items"]:
            it["_file"] = "p-" + slugify(en(it, "title")) + ".html"
            it["_img"] = item_image(site, it)
            it["_cut"] = ("cut:" + it["_img"]) if it["_img"] and ("cut:" + it["_img"]) in site["images"] and cat.get("cutouts") else None
        cats = []
        for it in cat["items"]:
            if it.get("category") and it["category"] not in cats:
                cats.append(it["category"])
        cat["_categories"] = cat.get("categories") or cats
        pages.append({"file": file, "kind": "catalogue", "title": cat.get("title") or label, "label": label})
        items = cat["items"]
        for i, it in enumerate(items):
            pages.append({"file": it["_file"], "kind": "product", "title": it["title"], "label": label, "listing": file,
                          "item": it, "prev": items[i - 1], "next": items[(i + 1) % len(items)]})
        if cat.get("compare"):
            pages.append({"file": "compare.html", "kind": "compare", "title": cat.get("compare_title", "Compare " + label.lower()), "label": label, "listing": file})
        nav.append({"file": file, "label": label, "items": items, "title": cat.get("title") or label})

    shop = site.get("shop")
    if shop:
        plans = shop.get("plans")
        if plans:
            pages.append({"file": "plans.html", "kind": "plans", "title": plans.get("title", "Meal plans"), "label": plans.get("nav", "Meal plans")})
            nav.append({"file": "plans.html", "label": plans.get("nav", "Meal plans")})
        pages.append({"file": "checkout.html", "kind": "checkout", "title": shop.get("checkout_title", "Checkout")})
        pages.append({"file": "order.html", "kind": "order", "title": "Your order"})

    locations = (site.get("locations") or {}).get("items", [])
    if locations:
        label = site["locations"].get("nav", "Locations")
        file = slugify(en(site["locations"], "nav") or "Locations") + ".html"
        site["locations"]["_file"] = file
        pages.append({"file": file, "kind": "locations", "title": site["locations"].get("title") or label, "label": label})
        nav.append({"file": file, "label": label})
        if any(l.get("about") or l.get("address") for l in locations):
            for i, l in enumerate(locations):
                l["_file"] = "branch-" + slugify(en(l, "name")) + ".html"
            for i, l in enumerate(locations):
                pages.append({"file": l["_file"], "kind": "branch", "title": l.get("full_name") or l["name"], "label": label, "listing": file,
                              "item": l, "prev": locations[i - 1], "next": locations[(i + 1) % len(locations)]})
    if site.get("news"):
        for n in site["news"]:
            n["_file"] = "news-" + slugify(en(n, "title"))[:60] + ".html"
            n["_img"] = n.get("image") if n.get("image") in site.get("images", {}) else None
        pages.append({"file": "news.html", "kind": "news", "title": "News and updates", "label": "News"})
        for i, n in enumerate(site["news"]):
            pages.append({"file": n["_file"], "kind": "article", "title": n["title"], "label": "News", "listing": "news.html",
                          "item": n, "prev": site["news"][i - 1], "next": site["news"][(i + 1) % len(site["news"])]})
        nav.append({"file": "news.html", "label": "News"})
    pages.append({"file": "contact.html", "kind": "contact", "title": site["contact"].get("title", "Contact")})
    nav.append({"file": "contact.html", "label": "Contact"})
    def resolve(href):
        if not href or not href.startswith("@"):
            return href
        kind, _, text = href[1:].partition(":")
        pool = {"news": site.get("news") or [], "svc": (site.get("services") or {}).get("items", []),
                "sp": (site.get("specialities") or {}).get("items", []),
                "cat": (site.get("catalogue") or {}).get("items", [])}[kind]
        for it in pool:
            if en(it, "title").startswith(text):
                return it["_file"]
        raise SystemExit(f"{site['slug']}: no page for link {href}")
    for pr in site.get("promos") or []:
        for k in ("cta", "cta2"):
            if pr.get(k):
                pr[k]["href"] = resolve(pr[k]["href"])
    for r in (site.get("rail") or {}).get("items", []):
        r["href"] = resolve(r["href"])

    def walk(o):  # any "href" in home sections, nudges and assemble blocks can use @ shortcuts
        if isinstance(o, dict):
            for k, v in o.items():
                if k == "href" and isinstance(v, str):
                    o[k] = resolve(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(site.get("home")); walk(site.get("nudges")); walk(site.get("assemble"))
    for n in nav:
        n.setdefault("items", [])  # templates read n['items']; without the key Jinja finds dict.items
    site["_pages"] = pages
    site["_nav"] = nav
    site["_anchors"] = {"#contact": "contact.html", "#about": "about.html", "#top": "#top"}
    for key in ("services", "highlights", "locations", "catalogue"):
        if (site.get(key) or {}).get("_file"):
            site["_anchors"]["#" + key] = site[key]["_file"]


def prepare(site):
    """Derive display values so the template only renders, never decides."""
    site.setdefault("stats", []); site.setdefault("confirm", []); site.setdefault("sources", [])
    site.setdefault("images", {}); site.setdefault("img_dir", site["slug"])
    site.setdefault("about", {"title": site.get("meta", ""), "body": []})
    # cut-outs: shared/img/<dir>/cut/<stem>.webp (tools/cutout.py) become image "cut:<key>",
    # so real dishes and products can float on the page; catalogue items pick them up as _cut
    cut_dir = SHARED / "img" / site["img_dir"] / "cut"
    if cut_dir.exists():
        for key, im in list(site["images"].items()):
            stem = Path(im["src"]).stem  # cut-outs sit flat in cut/, whatever folder the photo is in
            if not key.startswith("cut:") and (cut_dir / (stem + ".webp")).exists():
                site["images"].setdefault("cut:" + key, {"src": f"cut/{stem}.webp", "alt": im.get("alt", ""), "cap": im.get("cap")})
    # logos blend into the page (tools/logo.py): a transparent cut for light bars, a light
    # version for photos and dark themes; templates show whichever suits the header's state
    b = site.get("brand") or {}
    if b.get("logo") in site["images"]:
        lg = site["images"][b["logo"]]
        stem = Path(lg["src"]).with_suffix("")
        d = SHARED / "img" / site["img_dir"]
        if (d / f"{stem}-t.png").exists():
            lg["src"] = f"{stem}-t.png"
        if (d / f"{stem}-light.png").exists():
            site["images"]["logo-light"] = {"src": f"{stem}-light.png", "alt": lg.get("alt", "")}
            b["_logo_light"] = "logo-light"
    for stat in site["stats"]:
        if "years_since" in stat:
            stat["value"] = YEAR - stat["years_since"]

    for phone in site["contact"]["phones"]:
        phone.setdefault("tel", digits(phone["number"]))

    locations = (site.get("locations") or {}).get("items", [])
    counts = {}
    for loc in locations:
        ph = (re.findall(r"\+?\d[\d ]{7,}\d", re.sub(r"\+\s+", "+", loc.get("phone") or "")) or [""])[0].replace(" ", "")
        m = re.fullmatch(r"\+(968|973|965|971|974)(\d{4})(\d{4})", ph)
        if m:
            loc["phone"] = f"+{m[1]} {m[2]} {m[3]}"
        q = f"{site['name']} {loc['name']} {loc['country']}".replace(" ", "+")
        loc["_map"] = loc.get("map") or f"https://www.google.com/maps/search/?api=1&query={q}"
        counts[loc["country"]] = counts.get(loc["country"], 0) + 1
    site["_countries"] = list(counts.items())
    site["_country_counts"] = counts
    site["_show_filter"] = len(counts) > 1

    build_pages(site)

    # branch data for the curved slider's detail panel (one JSON blob, read by fx.js)
    def map_embed(loc):
        q = f"{loc['lat']},{loc['lng']}" if loc.get("lat") else f"{site['name']} {loc.get('full_name') or loc['name']} {loc['country']}"
        return "https://maps.google.com/maps?q=" + q.replace(" ", "+") + "&z=15&output=embed"
    blob = []
    for loc in locations:
        phones = loc.get("phones") or ([{"label": "Phone", "number": loc["phone"]}] if loc.get("phone") else [])
        blob.append({"name": loc["name"], "full": loc.get("full_name") or "", "type": loc.get("type", ""), "country": loc["country"],
                     "addr": loc.get("address") or loc.get("note") or "", "hours": loc.get("hours") or [],
                     "phones": [{"label": ph["label"], "number": ph["number"], "tel": digits(ph["number"])} for ph in phones],
                     "er": bool(loc.get("emergency")), "opened": loc.get("opened"), "docs": loc.get("doctors"),
                     "specs": loc.get("specs") or [], "page": loc.get("_file") or "", "map": map_embed(loc),
                     "dir": (loc.get("links") or {}).get("directions") or loc["_map"],
                     "rev": (loc.get("links") or {}).get("reviews"), "ig": (loc.get("links") or {}).get("instagram")})
    site["_branch_json"] = json.dumps(blob, ensure_ascii=False).replace("</", "<\\/")

    form = site["contact"].get("form", {})
    form.setdefault("topics", ["General enquiry", "Partnership", "Careers", "Media"])
    form.setdefault("submit", "Send enquiry")
    form.setdefault("branch", False)
    site["contact"]["form"] = form
    site["_branch_options"] = [loc["name"] + " · " + loc["country"] for loc in locations]

    # layered product art: exploded "assemble" stacks and assembled catalogue thumbnails
    img_src = {k: "assets/img/" + v["src"] for k, v in site["images"].items()}
    for a in site.get("assemble") or []:
        a["_svg"], a["_h"], a["_n"] = art.stack(a["id"], a["layers"], img_src, explode=True)
        a["_parts"] = [l for l in a["layers"] if l.get("shape") != "glass"] + [l for l in a["layers"] if l.get("shape") == "glass"]
    for it in (site.get("catalogue") or {}).get("items", []):
        if it.get("layers"):
            it["_art"], it["_art_h"], _ = art.stack("p-" + slugify(en(it, "title")), it["layers"], img_src, explode=False)

    # shop: items with a numeric "amount" can be added to the cart; the same price list is
    # written to assets/shop.json, which server/shop_api.py uses to re-price every order
    shop = site.get("shop")
    if shop:
        cur = shop.setdefault("currency", "OMR")
        items = {}
        for it in (site.get("catalogue") or {}).get("items", []):
            if isinstance(it.get("amount"), (int, float)) and it["amount"] > 0:
                it["_sku"] = slugify(en(it, "title"))[:48]
                it.setdefault("price", f"{cur} {it['amount']:.3f}")
            items[slugify(en(it, "title"))[:48]] = {"t": it["title"], "a": it.get("amount") if it.get("_sku") else None,
                                                  "img": img_src.get(it.get("_cut") or it.get("_img")) or "", "url": it["_file"],
                                                  "cat": it.get("category", ""), "opts": [o["label"] for o in it.get("options") or []],
                                                  **{k[0]: float(re.sub(r"[^\d.]", "", x["value"]) or 0) for x in it.get("macros") or []
                                                     for k in [x["label"].lower()] if k in ("kcal", "protein")}}
        # a priced subscription (period x meals a day): each option is a cart item at its listed price
        sub = shop.get("plans") or {}
        if sub.get("mode") == "subscription":
            for p in sub["periods"]:
                for ml in sub["meals"]:
                    key = f"{p['key']}{ml['n']}"
                    if key in sub["tiers"]:
                        items["meal-sub-" + key] = {"t": f"{sub.get('product', 'Meal subscription')} · {p['label']} ({p['sub']}) · {ml['n']} meal{'s' if ml['n'] > 1 else ''} a day",
                                                    "a": sub["tiers"][key], "img": img_src.get("cut:" + ml["image"]) or img_src.get(ml["image"]) or "",
                                                    "url": "plans.html", "cat": sub.get("nav", "Meal plans"), "opts": []}
        wa = shop.get("whatsapp") or ""
        site["_shop"] = {"slug": site["slug"], "currency": cur, "items": items, "api": shop.get("api", "/api"),
                         "wa": digits(wa) if wa else "", "name": site["short"],
                         "delivery": shop.get("delivery") or {}, "pickup": shop.get("pickup") or {},
                         "payments": shop.get("payments") or ["cod"], "min": shop.get("minimum", 0)}
        site["_shop_json"] = json.dumps(site["_shop"], ensure_ascii=False)

    if site["theme"] == "studio":
        b = site.setdefault("brand", {})
        site["_theme"] = {"fonts": b.get("fonts_url") or GF + "Fraunces:opsz,wght@9..144,300..600&family=Inter:wght@400;500;600;700",
                          "theme_color": b.get("bg", "#111111"), "label": "Studio", "motion": "Data-driven sections"}
    else:
        site["_theme"] = THEMES[site["theme"]]

    # credits: every image this site uses, looked up from data/credits.json
    used = sorted({im["src"] for im in site.get("images", {}).values()})
    site["_credits"] = []
    for src in used:
        key = site["img_dir"] + "/" + src.rsplit(".", 1)[0]
        c = CREDITS.get(key)
        if c and not c.get("owner") and not c["license"].upper().startswith("CC0"):
            site["_credits"].append({**c, "modified": True})
        elif c:
            site["_credits"].append(c)
    return site


AR_FONTS = {  # display, body (Google Fonts); a site can set brand.ar_display / brand.ar_body
    "default": ("Noto Kufi Arabic", "IBM Plex Sans Arabic"),
}
AR_WEIGHTS = {"IBM Plex Sans Arabic": "400;500;600;700", "Noto Kufi Arabic": "400;500;600;700;800", "Cairo": "400;600;700;800;900",
              "Amiri": "400;700", "El Messiri": "400;500;600;700", "Tajawal": "400;500;700;800", "Almarai": "400;700;800",
              "Noto Naskh Arabic": "400;500;600;700", "Readex Pro": "400;500;600;700", "Lalezar": "400", "Reem Kufi": "400;500;600;700"}


def ar_fonts(site):
    b = site.get("brand") or {}
    disp, body = b.get("ar_display") or AR_FONTS["default"][0], b.get("ar_body") or AR_FONTS["default"][1]
    fam = lambda f: f.replace(" ", "+") + ":wght@" + AR_WEIGHTS.get(f, "400;700")  # only weights the font has, or Google refuses the request
    site["_ar_fonts"] = GF + fam(disp) + ("&family=" + fam(body) if body != disp else "")
    site["_ar_display"] = f'"{disp}", "Noto Kufi Arabic", sans-serif'
    site["_ar_body"] = f'"{body}", "IBM Plex Sans Arabic", sans-serif'


def render_lang(env, site, lang):
    """sites/<slug>/<lang>/*.html: same pages and file names, assets shared one folder up."""
    out_dir = SITES / site["slug"] / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.html"):
        old.unlink()
    ui = i18n.load_ui(lang)
    site["_ui_json"] = json.dumps(ui.get("exact", {}), ensure_ascii=False).replace("</", "<\\/")
    if site.get("_shop"):
        sh = dict(site["_shop"], cur_label=ui.get("currency", {}).get(site["_shop"]["currency"], ""),
                  items={k: dict(v, img=("../" + v["img"]) if v.get("img") else "") for k, v in site["_shop"]["items"].items()})
        (SITES / site["slug"] / "assets" / f"shop-data.{lang}.js").write_text(
            "window.T1SHOP=" + json.dumps(sh, ensure_ascii=False).replace("</", "<\\/") + ";\n", encoding="utf-8")
    shutil.copy(SHARED / "css" / "rtl.css", SITES / site["slug"] / "assets" / "rtl.css")
    for page in site["_pages"]:
        tpl = f"themes/{site['theme']}.html.j2" if page["kind"] == "home" else f"pages/{page['kind']}.html.j2"
        html = env.get_template(tpl).render(s=site, page=page, year=YEAR)
        if page["kind"] not in ("home", "contact"):
            for anchor, target in site["_anchors"].items():
                html = html.replace(f'href="{anchor}"', f'href="{target}"')
        html = html.replace('src="assets/shop-data.js"', f'src="assets/shop-data.{lang}.js"')
        (out_dir / page["file"]).write_text(i18n.localize_html(html, ui), encoding="utf-8")


def render_site(env, site):
    out_dir = SITES / site["slug"]
    if (out_dir / "assets").exists():
        shutil.rmtree(out_dir / "assets")
    (out_dir / "assets" / "img").mkdir(parents=True)
    shutil.copy(SHARED / "css" / "core.css", out_dir / "assets" / "core.css")
    shutil.copy(SHARED / "css" / f"{site['theme']}.css", out_dir / "assets" / f"{site['theme']}.css")
    shutil.copy(SHARED / "css" / "styles.css", out_dir / "assets" / "styles.css")
    for js in ("core.js", "fx.js"):
        shutil.copy(SHARED / "js" / js, out_dir / "assets" / js)
    if site.get("_shop"):
        shutil.copy(SHARED / "js" / "shop.js", out_dir / "assets" / "shop.js")
        (out_dir / "assets" / "shop.json").write_text(site["_shop_json"], encoding="utf-8")
        (out_dir / "assets" / "shop-data.js").write_text("window.T1SHOP=" + site["_shop_json"].replace("</", "<\\/") + ";\n", encoding="utf-8")
    shutil.copytree(SHARED / "vendor", out_dir / "assets" / "vendor")
    for im in {im["src"] for im in site.get("images", {}).values()}:
        src = SHARED / "img" / site["img_dir"] / im
        if not src.exists():
            raise SystemExit(f"missing image for {site['slug']}: {src}")
        (out_dir / "assets" / "img" / im).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, out_dir / "assets" / "img" / im)
    # scroll-scrubbed footage: videos and frame folders named in home sections
    media = []
    for m in site.get("home") or []:
        if isinstance(m, dict) and m.get("type") == "scrub":
            for k in ("video", "video_m"):
                if m.get(k):
                    media.append(m[k])
                    webm = m[k].rsplit(".", 1)[0] + ".webm"
                    if (SHARED / "img" / site["img_dir"] / webm).exists():
                        media.append(webm)
            if m.get("frames"):
                media.append(m["frames"]["dir"])
    for pr in site.get("promos") or []:
        if pr.get("video"):
            media.append(pr["video"])
            webm = pr["video"].rsplit(".", 1)[0] + ".webm"
            if (SHARED / "img" / site["img_dir"] / webm).exists():
                media.append(webm)
    if (site.get("intro") or {}).get("video"):
        media.append(site["intro"]["video"])
        media.append(site["intro"]["video"].rsplit(".", 1)[0] + ".webm")
    for name in dict.fromkeys(media):
        src = SHARED / "img" / site["img_dir"] / name
        if not src.exists():
            raise SystemExit(f"missing media for {site['slug']}: {src}")
        dst = out_dir / "assets" / "media" / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dst) if src.is_dir() else shutil.copy(src, dst)
    for old in out_dir.glob("*.html"):
        old.unlink()
    for page in site["_pages"]:
        tpl = f"themes/{site['theme']}.html.j2" if page["kind"] == "home" else f"pages/{page['kind']}.html.j2"
        html = env.get_template(tpl).render(s=site, page=page, year=YEAR)
        if page["kind"] not in ("home", "contact"):
            # section anchors from the data point at the matching page off the home page
            for anchor, target in site["_anchors"].items():
                html = html.replace(f'href="{anchor}"', f'href="{target}"')
        (out_dir / page["file"]).write_text(html, encoding="utf-8")


def render_hub(env, sites):
    if (ROOT / "assets").exists():
        shutil.rmtree(ROOT / "assets")
    (ROOT / "assets").mkdir()
    shutil.copy(SHARED / "css" / "hub.css", ROOT / "assets" / "hub.css")
    if (SHARED / "hub").exists():
        shutil.copytree(SHARED / "hub", ROOT / "assets" / "hub")
    (ROOT / "assets" / "hub" / "logos").mkdir(parents=True, exist_ok=True)
    for site in sites:
        site["_thumb"] = (SHARED / "hub" / f"{site['slug']}.jpg").exists()
        logo = (site.get("brand") or {}).get("_logo_light") or (site.get("brand") or {}).get("logo")  # light version: it sits on the photo
        site["_logo"] = None
        if logo and logo in site.get("images", {}):  # the client's real logo on its card
            src = SHARED / "img" / site["img_dir"] / site["images"][logo]["src"]
            if src.exists():
                shutil.copy(src, ROOT / "assets" / "hub" / "logos" / (site["slug"] + src.suffix))
                site["_logo"] = "assets/hub/logos/" + site["slug"] + src.suffix
    # client sites only (demos opt out with "hub": false), in the order the pitch pack wants
    order = ["badr-al-samaa", "macroboost", "healthy-lab", "dar-global", "galfar", "starcare", "assarain", "national-gas", "asyad-express"]
    sites = sorted([x for x in sites if x.get("hub", True)], key=lambda x: order.index(x["slug"]) if x["slug"] in order else 99)
    html = env.get_template("hub.html.j2").render(sites=sites, year=YEAR, fonts=GF + "Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700")
    (ROOT / "index.html").write_text(html, encoding="utf-8")


def write_verify(sites):
    lines = [
        "# Verify before pitching",
        "",
        f"Built {datetime.date.today().isoformat()}. Facts come from each company's homepage",
        "read on 11 Oct 2026 and from the prospects document. Anything below is unconfirmed",
        "or conflicting and should be checked against the live site, or with the client, first.",
        "",
    ]
    for site in sites:
        lines += [f"## {site['name']}", ""]
        lines += [f"- {item}" for item in site["confirm"]]
        lines += ["", "Sources:"]
        lines += [f"- {src}" for src in site["sources"]]
        lines += [""]
    (ROOT / "VERIFY.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(["html", "j2"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.globals["icon"] = icon
    env.globals["digits"] = digits

    only = os.environ.get("ONLY")  # e.g. ONLY=galfar to rebuild one site while iterating
    sites = []
    for path in sorted(DATA.glob("*.json")):
        if path.name == "credits.json" or (only and path.stem != only):
            continue
        raw = json.loads(path.read_text(encoding="utf-8"))
        table_p = DATA / "i18n" / f"{path.stem}.ar.json"
        site = prepare(json.loads(json.dumps(raw)))
        if table_p.exists():
            site["_alt"] = {"lang": "ar", "prefix": "ar/", "label": "العربية"}
        sites.append(site)
        render_site(env, site)
        print(f"built sites/{site['slug']}/  ({len(site['_pages'])} pages)")
        if table_p.exists():  # Arabic: translated copy of the data, right to left, in sites/<slug>/ar/
            data_ar, missing = i18n.translate(raw, json.loads(table_p.read_text(encoding="utf-8")))
            site_ar = prepare(data_ar)
            site_ar["lang"] = "ar"
            site_ar["_alt"] = {"lang": "en", "prefix": "../", "label": "English"}
            ar_fonts(site_ar)
            render_lang(env, site_ar, "ar")
            print(f"built sites/{site['slug']}/ar/  ({len(site_ar['_pages'])} pages, {len(missing)} strings untranslated)")
        elif (SITES / site["slug"] / "ar").exists():
            shutil.rmtree(SITES / site["slug"] / "ar")

    if only:
        return
    render_hub(env, sites)
    write_verify(sites)
    print("built index.html and VERIFY.md")


if __name__ == "__main__":
    main()
