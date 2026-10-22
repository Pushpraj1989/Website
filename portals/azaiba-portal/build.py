"""Build the Azaiba Gardens rental portal into dist/ as plain HTML.

Content lives in content/ (JSON, edited through the CMS at admin/). Run:

    python3 build.py            # writes dist/
    python3 -m http.server -d dist 8000
"""
import json
import shutil
import subprocess
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
DIST = ROOT / "dist"


UNIT_LABELS = {"sqm": "sq m", "sqyd": "sq yd", "sqft": "sq ft"}
CURRENCY_DECIMALS = {"OMR": 3, "KWD": 3, "BHD": 3}


def format_amount(value, currency):
    places = CURRENCY_DECIMALS.get(currency, 2)
    return f"{value:,.{places}f}".rstrip("0").rstrip(".")


def decorate_listing(listing):
    """Turns the stored measures and price into the text the pages print, plus numbers for sorting."""
    price = listing["price"]
    listing["rent_omr"] = price["amount"]
    listing["rent_text"] = f"{price['currency']} {format_amount(price['amount'], price['currency'])}"
    listing["period_text"] = {"month": "/ month", "year": "/ year"}.get(price.get("period"), "/ month")
    parts = []
    for key, label in (("build", "Build"), ("carpet", "Carpet")):
        m = (listing.get("measures") or {}).get(key)
        if m:
            parts.append(f"{label} {format_amount(m['value'], '')} {UNIT_LABELS.get(m['unit'], m['unit'])}")
    listing["size_text"] = " · ".join(parts)
    return listing


def load_folder(name):
    records = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((CONTENT / name).glob("*.json"))]
    return records


def export_data(site, buildings, listings):
    """Public JSON for the React build: no internal fields, nothing a visitor should not see."""
    data = DIST / "data"
    data.mkdir(parents=True, exist_ok=True)
    rows = [{k: v for k, v in b.items() if k != "listings"} for b in buildings]
    flats = [{k: v for k, v in l.items() if k != "building_record"} for l in listings]
    for name, payload in (("site", site), ("buildings", rows), ("listings", flats)):
        (data / f"{name}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    site = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
    buildings = load_folder("buildings")
    listings = [decorate_listing(item) for item in load_folder("listings")]
    by_building = {b["id"]: b for b in buildings}
    for listing in listings:
        listing["building_record"] = by_building.get(listing["building"], {})
    for building in buildings:
        building["listings"] = [item for item in listings if item["building"] == building["id"]]
        building["from_rent"] = min((item["rent_omr"] for item in building["listings"]), default=None)

    listings.sort(key=lambda item: (item["rent_omr"], item["id"]))
    featured = [item for item in listings if item.get("featured")] or listings[:4]

    # The hero film plays as WebM where a WebM copy exists (every browser plays it), MP4 otherwise.
    site["hero_webm"] = ""
    if site.get("hero_video"):
        sibling = site["hero_video"].rsplit(".", 1)[0] + ".webm"
        if (CONTENT / "media" / sibling).exists():
            site["hero_webm"] = sibling

    env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    export_data(site, buildings, listings)

    def render(template, target, **context):
        path = DIST / target
        path.parent.mkdir(parents=True, exist_ok=True)
        root = "../" * (len(Path(target).parts) - 1)  # pages in sub-folders link back to the root
        html = env.get_template(template).render(site=site, root=root, **context)
        path.write_text(html, encoding="utf-8")
        print("built", target)

    render("index.html.j2", "index.html", buildings=buildings, featured=featured, listings=listings, active="home")
    render("search.html.j2", "search.html", buildings=buildings, listings=listings, active="search",
           data=[{"id": i["id"], "title": i["title"], "bhk": i["bhk"], "rent": i["rent_omr"], "rent_text": i["rent_text"], "period_text": i["period_text"], "size": i["size_text"],
                  "building": i["building"], "status": i["status"], "href": f"listing/{i['id']}.html",
                  "cover": f"media/{i['cover']}"} for i in listings])
    render("page.html.j2", "about.html", title="About", body=site["about_text"], heading=site["about_title"], active="about")
    render("contact.html.j2", "contact.html", active="contact")
    for building in buildings:
        render("building.html.j2", f"building/{building['id']}.html", building=building, active="search")
    for listing in listings:
        render("listing.html.j2", f"listing/{listing['id']}.html", listing=listing, active="search")

    shutil.copytree(ROOT / "static", DIST / "static")
    shutil.copytree(CONTENT / "media", DIST / "media")
    for name in ("robots.txt", "_headers"):
        shutil.copy(ROOT / "deploy" / name, DIST / name)
    build_react()
    print(f"done: {len(buildings)} buildings, {len(listings)} listings")


def build_react():
    """The React app (react/) builds into dist/app/. Skipped with a warning if Node is not installed."""
    react = ROOT / "react"
    if not (react / "node_modules").exists():
        print("react: run `npm ci` in react/ once, then build.py builds it")
        return
    subprocess.run(["npx", "vite", "build"], cwd=react, check=True)


if __name__ == "__main__":
    main()
