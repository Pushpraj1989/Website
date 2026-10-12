#!/usr/bin/env python3
"""Render a scroll-driven section (film, converge, stack, scrub…) into a real video file by stepping
the scroll frame by frame in headless Chromium and capturing clean frames (header and nudges hidden).
Use the clips as promo-slider video slides or as social reels.

  python3 tools/serve.py &   # the site must be served over http
  python3 tools/record_film.py http://localhost:8080/sites/<slug>/index.html "#film-id" shared/img/<slug>/film-x.mp4 [--seconds 10] [--size 1280x720] [--from 0 --to 1]
Writes the .mp4 (H.264) and a .webm twin, plus a .jpg poster.
"""
import argparse, shutil, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

HIDE = """.site-header,.topbar,.dock,.action-bar,.offer,.ring,.to-top,.cursor,.toast,.cart,.cv-buy,.film-buy,.film-bar,.cv-cap,.cv-hint,.page-wipe,.loader,.progress{display:none!important}"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url"); ap.add_argument("selector"); ap.add_argument("out")
    ap.add_argument("--seconds", type=float, default=10); ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--size", default="1280x720"); ap.add_argument("--from", dest="a", type=float, default=0); ap.add_argument("--to", dest="b", type=float, default=1)
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    n = int(a.seconds * a.fps)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
        pg.goto(a.url, wait_until="load"); pg.wait_for_timeout(3500)
        pg.add_style_tag(content=HIDE)
        top = pg.evaluate(f"document.querySelector('{a.selector}').getBoundingClientRect().top + scrollY")
        span = pg.evaluate(f"document.querySelector('{a.selector}').offsetHeight") - h
        go = lambda f: pg.evaluate(f"T1.lenis.scrollTo({top + span * f}, {{immediate: true, force: true}})")
        go(a.a); pg.wait_for_timeout(1500)
        for i in range(n):
            t = i / (n - 1)
            e = t * t * (3 - 2 * t)  # ease in and out over the whole clip
            go(a.a + (a.b - a.a) * e)
            pg.wait_for_timeout(int(1000 / a.fps))
            pg.screenshot(path=str(tmp / f"f{i:04d}.jpg"), type="jpeg", quality=90)
        b.close()
    vf = f"scale={w}:-2:flags=lanczos,format=yuv420p"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(a.fps), "-i", str(tmp / "f%04d.jpg"), "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-movflags", "+faststart", str(out)], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(a.fps), "-i", str(tmp / "f%04d.jpg"), "-vf", vf, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-deadline", "good", "-cpu-used", "3", str(out.with_suffix(".webm"))], check=True)
    subprocess.run(["convert", str(tmp / f"f{int(n * 0.35):04d}.jpg"), "-resize", f"{w}x", "-quality", "80", str(out.with_suffix(".jpg"))], check=True)
    shutil.rmtree(tmp)
    print(out, out.stat().st_size // 1024, "KB")

if __name__ == "__main__":
    main()
