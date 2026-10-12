#!/usr/bin/env python3
"""Refresh the hub thumbnails: a 1440x900 shot of each site's home page, saved to shared/hub/<slug>.jpg.
  python3 tools/serve.py &      then      python3 tools/hub_shots.py [slug ...]"""
import subprocess, sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
slugs = sys.argv[1:] or [json.loads(p.read_text())["slug"] for p in sorted((ROOT / "data").glob("*.json")) if p.name != "credits.json"]
(ROOT / "shared" / "hub").mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    for s in slugs:
        pg.goto(f"http://localhost:8080/sites/{s}/index.html", wait_until="load")
        pg.wait_for_timeout(5000)
        pg.add_style_tag(content=".offer,.dock,.cursor,.to-top,.ring{display:none!important}")
        tmp = ROOT / "shared" / "hub" / f"{s}.png"
        pg.screenshot(path=str(tmp))
        subprocess.run(["convert", str(tmp), "-resize", "960x", "-quality", "80", str(tmp.with_suffix(".jpg"))], check=True)
        tmp.unlink()
        print("hub shot", s)
    b.close()
