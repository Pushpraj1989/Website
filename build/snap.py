#!/usr/bin/env python3
"""Optional: capture hub preview images of each built site into shared/hub/.
Needs Playwright with a Chromium build (pip install playwright).
Usage: python3 build/snap.py  (then re-run build/build.py)"""
import os, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "shared" / "hub"
OUT.mkdir(parents=True, exist_ok=True)
exe = os.environ.get("CHROME") or ("/opt/pw-browsers/chromium-1194/chrome-linux/chrome" if pathlib.Path("/opt/pw-browsers/chromium-1194/chrome-linux/chrome").exists() else None)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch()
    for site in sorted((ROOT / "sites").iterdir()):
        if not (site / "index.html").exists():
            continue
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto((site / "index.html").as_uri(), wait_until="load")
        page.wait_for_timeout(4200)  # let the opening loader and hero intro finish
        page.screenshot(path=str(OUT / f"{site.name}.jpg"), type="jpeg", quality=72)
        page.close()
        print("snap", site.name)
    browser.close()
