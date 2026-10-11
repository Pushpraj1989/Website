#!/usr/bin/env python3
"""Start a new site: data/<slug>.json from a sector preset, the intake brief and the scrape.

    python3 tools/new_site.py --slug acme-bank --name "Acme Bank" --sector banking
    python3 tools/new_site.py --slug acme-bank --brief briefs/acme-bank.json --scrape research/acme-bank/summary.json

The result builds straight away (python3 build/build.py) with clearly marked TODO
placeholders. Then replace every TODO with real content from the scrape, keeping a
"src" on facts, and fill the catalogue, services, locations and news.
Nothing here invents facts: placeholders say TODO, and contacts come from the scrape.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TODO = "TODO"


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8")) if p else {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--name")
    ap.add_argument("--sector", help="preset name in presets/ (see ls presets)")
    ap.add_argument("--brief", help="intake answers JSON (see the skill's intake.md)")
    ap.add_argument("--scrape", help="research/<slug>/summary.json from tools/scrape.py")
    ap.add_argument("--force", action="store_true", help="overwrite an existing data file")
    a = ap.parse_args()

    brief, scrape = load(a.brief), load(a.scrape)
    sector = a.sector or brief.get("sector")
    if not sector or not (ROOT / "presets" / f"{sector}.json").exists():
        sys.exit("pick a sector: " + ", ".join(p.stem for p in sorted((ROOT / 'presets').glob('*.json'))))
    pre = load(ROOT / "presets" / f"{sector}.json")
    name = a.name or brief.get("name") or scrape.get("site_name", "").split(" - ")[0].split(" | ")[0].strip() or TODO
    short = brief.get("short") or name.split(" ")[0]
    out = ROOT / "data" / f"{a.slug}.json"
    if out.exists() and not a.force:
        sys.exit(f"{out} exists (use --force to overwrite)")

    phones = [{"label": "Call us", "number": p} for p in (brief.get("phones") or scrape.get("phones", [])[:2])] or [{"label": "Call us", "number": "+000 0000 0000"}]
    wa = brief.get("whatsapp")
    if wa:
        phones.append({"label": "WhatsApp", "number": wa, "whatsapp": True})
    brand = {"mode": "dark", "bg": "#111111", "fg": "#f4f1ea", "accent": "#e2733b", "accent_ink": "#111111"}
    brand.update(brief.get("brand") or {})
    if brand.get("mode") == "light" and "bg" not in (brief.get("brand") or {}):
        brand.update({"bg": "#f7f4ef", "fg": "#17140f", "accent_ink": "#ffffff"})

    rail_items = []
    for r in pre.get("rail", []):
        rail_items.append({"label": r["label"], "icon": r.get("icon", "arrow"), "sub": "", "href": "contact.html"})
    cat = pre.get("catalogue") or {}
    data = {
        "slug": a.slug, "tier": brief.get("tier", "Concept"), "name": name, "short": short,
        "sector": pre.get("label", sector), "meta": brief.get("tagline") or scrape.get("description") or TODO,
        "accent": brand["accent"], "theme": brief.get("theme", "studio"), "promo_fx": brief.get("promo_fx") or pre.get("promo_fx", "flow"),
        "img_dir": a.slug, "brand": brand,
        "cta": {"label": brief.get("cta", pre.get("rail", [{"label": "Contact us"}])[0]["label"]), "short": "Contact", "href": "contact.html"},
        "hero": {"eyebrow": "", "title": name, "lede": "", "primary": {"label": "Explore", "href": "about.html"}, "secondary": {"label": "Contact", "href": "contact.html"}},
        "images": {},
        "home": pre.get("home", []),
        "ticker": {"label": "Latest", "items": [{"tag": "News", "text": n["title"], "href": None} for n in scrape.get("news", [])[:5]]} if scrape.get("news") else None,
        "promos": [],
        "rail": {"title": brief.get("rail_title", "How can we help?"), "items": rail_items},
        "stats": [],
        "about": {"title": TODO + ": one-line story", "body": [scrape.get("description") or TODO]},
        "services": {"title": (pre.get("services") or {}).get("title", "Services"), "nav": (pre.get("services") or {}).get("nav", "Services"), "intro": "",
                     "items": [{"title": s["title"], "icon": "layers", "text": s.get("summary", ""), "detail": {"src": s["url"]}} for s in scrape.get("services", [])[:8]]},
        "catalogue": {"title": cat.get("title", "Products"), "nav": cat.get("nav", "Products"), "intro": "", "categories": cat.get("categories", []),
                      "compare": cat.get("compare", False),
                      "items": [{"title": p["title"], "category": "", "price": (p.get("prices") or [""])[0], "text": "", "src": p["url"]} for p in scrape.get("products", [])[:24]]},
        "assemble": [],
        "locations": {"title": (pre.get("locations") or {}).get("title", "Locations"), "nav": (pre.get("locations") or {}).get("nav", "Locations"), "intro": "",
                      "items": [{"name": re.sub(r"\s*[-|].*$", "", l["title"])[:40], "type": "Branch", "country": brief.get("country", TODO),
                                 "phone": (l.get("phones") or [""])[0], "src": l["url"]} for l in scrape.get("locations", [])[:20]]},
        "news": [{"title": n["title"], "date": n.get("date", "")[:10], "tag": "News", "summary": n.get("summary", ""), "src": n["url"],
                  "src_label": "Read on the official website"} for n in scrape.get("news", [])[:12]],
        "faq": [], "testimonials": [],
        "nudges": {"dock_label": "Talk to us"},
        "contact": {"title": "Contact", "intro": TODO, "address": brief.get("address", ""), "phones": phones,
                    "email": brief.get("email") or (scrape.get("emails") or [None])[0], "note": "Concept preview: connect the form before launch.",
                    "form": {"branch": bool(scrape.get("locations")), "topics": ["General enquiry", "Sales", "Support", "Careers"], "submit": "Send"}},
        "marquee": [], "socials": [{"name": re.sub(r"https?://(www\.)?([^/.]+).*", r"\2", s).title(), "url": s} for s in scrape.get("social", [])[:6]],
        "confirm": ["Everything marked TODO", "Every price, figure and date against the official site"] + pre.get("compliance", []),
        "sources": [f"{scrape['source']} (scraped {scrape['fetched']})"] if scrape.get("source") else [],
        "_preset_notes": {k: pre.get(k) for k in ("signature_graphics", "assemble_ideas", "scrape_focus", "extra_pages", "tools", "brand_hint")},
    }
    data = {k: v for k, v in data.items() if v is not None}
    for key in ("services", "catalogue", "locations"):
        if not data[key]["items"]:
            data.pop(key)
    if not data["news"]:
        data.pop("news")
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (ROOT / "shared" / "img" / a.slug).mkdir(parents=True, exist_ok=True)
    print(f"wrote {out.relative_to(ROOT)}  (sector {sector}, home: {', '.join(m if isinstance(m, str) else m['type'] for m in data['home'])})")
    print(f"next: put photos in shared/img/{a.slug}/, fill the TODOs, then ONLY={a.slug} python3 build/build.py")


if __name__ == "__main__":
    main()
