"""One-off seed: copy the Azaiba Gardens sample buildings and flat rents into the portal content.

Reads data/azaiba-gardens.json (the sample the client already has) and writes one JSON file per
building and per flat listing under content/. After this, the CMS is the source of truth.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parents[1] / "data" / "azaiba-gardens.json"
COVERS = {"facade": "own-street.jpg", "living": "own-living.jpg", "window": "own-balcony.jpg", "bedroom": "own-bedroom.jpg"}
FLAT_COVERS = {"1 BHK": "concept-flat-1bhk.jpg", "2 BHK": "concept-flat-2bhk.jpg", "3 BHK": "concept-flat-3bhk.jpg"}


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    for building in data["buildings"]["items"]:
        bid = slug(building["name"])
        size_numbers = [int(re.search(r"\d+", f["size"]).group()) for f in building["flats"]]
        record = {
            "id": bid,
            "name": building["name"],
            "area": building["area"],
            "floors": building["floors"],
            "units": building["units"],
            "status": building["status"],
            "description": building["text"],
            "cover": COVERS.get(building.get("image"), "own-street.jpg"),
            "gallery": ["own-pool.jpg", "own-play.jpg", "own-night.jpg"],
            "video": "azaiba-building-motion.mp4",
        }
        write(ROOT / "content" / "buildings" / f"{bid}.json", record)
        for flat, size in zip(building["flats"], size_numbers):
            bhk = flat["type"]
            lid = f"{bid}-{slug(bhk)}"
            listing = {
                "id": lid,
                "title": f"{bhk} flat, {building['name']}",
                "building": bid,
                "bhk": bhk,
                "measures": {"build": {"value": size, "unit": "sqm"}, "carpet": None},
                "price": {"amount": int(re.search(r"\d+", flat["rent"]).group()), "currency": "OMR", "period": "month"},
                "status": "Available",
                "available_from": "",
                "cover": FLAT_COVERS.get(bhk, "own-living.jpg"),
                "gallery": ["own-bedroom.jpg", "own-kitchen.jpg", "own-bathroom.jpg"],
                "video": "",
                "description": f"A {bhk} flat in {building['name']}, Azaiba. Sample listing: confirm size and rent before publishing.",
                "featured": bhk == "2 BHK",
            }
            write(ROOT / "content" / "listings" / f"{lid}.json", listing)


def write(path, record):
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
