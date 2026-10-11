#!/usr/bin/env python3
"""Build the Tier 1 concept redesigns from data/*.json.

Each company picks a visual theme (data field "theme"); themes live in
build/templates/themes/<theme>.html.j2 and shared/css/<theme>.css.

Writes:
  sites/<slug>/index.html   one page per company (+ assets/)
  index.html                hub page linking all sites
  VERIFY.md                 facts to check before a pitch, per company

Usage:  python3 build/build.py
Needs:  jinja2  (pip install jinja2)
"""

import datetime
import json
import os
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

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
        '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        f"{body}</svg>"
    )


def digits(number):
    """'+968 2271 7171' -> '+96822717171' for tel: and wa.me links."""
    return "+" + "".join(ch for ch in number if ch.isdigit()) if number.strip().startswith("+") else number


def prepare(site):
    """Derive display values so the template only renders, never decides."""
    for stat in site["stats"]:
        if "years_since" in stat:
            stat["value"] = YEAR - stat["years_since"]

    for phone in site["contact"]["phones"]:
        phone.setdefault("tel", digits(phone["number"]))

    locations = (site.get("locations") or {}).get("items", [])
    counts = {}
    for loc in locations:
        counts[loc["country"]] = counts.get(loc["country"], 0) + 1
    site["_countries"] = list(counts.items())
    site["_country_counts"] = counts
    site["_show_filter"] = len(counts) > 1

    form = site["contact"].get("form", {})
    form.setdefault("topics", ["General enquiry", "Partnership", "Careers", "Media"])
    form.setdefault("submit", "Send enquiry")
    form.setdefault("branch", False)
    site["contact"]["form"] = form
    site["_branch_options"] = [loc["name"] + " · " + loc["country"] for loc in locations]

    nav = [{"id": "about", "label": "About"}]
    if site.get("services", {}).get("items"):
        nav.append({"id": "services", "label": site["services"].get("nav", "Services")})
    if site.get("highlights"):
        nav.append({"id": "highlights", "label": site["highlights"].get("nav", "Highlights")})
    if locations:
        nav.append({"id": "locations", "label": site["locations"].get("nav", "Locations")})
    nav.append({"id": "contact", "label": "Contact"})
    site["_nav"] = nav
    site["_theme"] = THEMES[site["theme"]]

    # credits: every image this site uses, looked up from data/credits.json
    used = sorted({im["src"] for im in site.get("images", {}).values()})
    site["_credits"] = []
    for src in used:
        key = site["img_dir"] + "/" + src.rsplit(".", 1)[0]
        c = CREDITS.get(key)
        if c and not c["license"].upper().startswith("CC0"):
            site["_credits"].append({**c, "modified": True})
        elif c:
            site["_credits"].append(c)
    return site


def render_site(env, site):
    out_dir = SITES / site["slug"]
    if (out_dir / "assets").exists():
        shutil.rmtree(out_dir / "assets")
    (out_dir / "assets" / "img").mkdir(parents=True)
    shutil.copy(SHARED / "css" / "core.css", out_dir / "assets" / "core.css")
    shutil.copy(SHARED / "css" / f"{site['theme']}.css", out_dir / "assets" / f"{site['theme']}.css")
    for js in ("core.js", "fx.js"):
        shutil.copy(SHARED / "js" / js, out_dir / "assets" / js)
    shutil.copytree(SHARED / "vendor", out_dir / "assets" / "vendor")
    for im in {im["src"] for im in site.get("images", {}).values()}:
        src = SHARED / "img" / site["img_dir"] / im
        if not src.exists():
            raise SystemExit(f"missing image for {site['slug']}: {src}")
        shutil.copy(src, out_dir / "assets" / "img" / im)
    html = env.get_template(f"themes/{site['theme']}.html.j2").render(s=site, year=YEAR)
    (out_dir / "index.html").write_text(html, encoding="utf-8")


def render_hub(env, sites):
    if (ROOT / "assets").exists():
        shutil.rmtree(ROOT / "assets")
    (ROOT / "assets").mkdir()
    shutil.copy(SHARED / "css" / "hub.css", ROOT / "assets" / "hub.css")
    if (SHARED / "hub").exists():
        shutil.copytree(SHARED / "hub", ROOT / "assets" / "hub")
    for site in sites:
        site["_thumb"] = (SHARED / "hub" / f"{site['slug']}.jpg").exists()
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
        site = prepare(json.loads(path.read_text(encoding="utf-8")))
        sites.append(site)
        render_site(env, site)
        print(f"built sites/{site['slug']}/index.html")

    if only:
        return
    render_hub(env, sites)
    write_verify(sites)
    print("built index.html and VERIFY.md")


if __name__ == "__main__":
    main()
