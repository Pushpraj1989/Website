#!/usr/bin/env python3
"""Check built sites in a real browser before anyone sees them.

    python3 tools/qa.py demo-coffee                 # every page, desktop + phone
    python3 tools/qa.py badr-al-samaa --pages 20    # first 20 pages
    python3 tools/qa.py demo-coffee --shots         # also save screenshots to qa-shots/

For each page, at 1440x900 and 390x844, it fails on:
  - JavaScript errors and console errors
  - local files that return 4xx/5xx (missing CSS, JS, images)
  - horizontal scroll (content wider than the screen)
  - broken images
  - content that never appears after scrolling down and back up
Then it opens the home page with reduced motion and checks nothing stays hidden.
Exit code 1 if anything failed, so it can gate a deploy.

Needs: pip install playwright (uses the Chromium at $CHROMIUM or Playwright's own).
"""

import argparse
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
VIEWS = {"desktop": {"width": 1440, "height": 900}, "phone": {"width": 390, "height": 844}}

PROBE = """async () => {
  // Walk down the page; anything sitting in the middle of the screen must be visible after a moment.
  // (Reveals are bidirectional: content above the viewport is hidden again on purpose.)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const H = () => document.documentElement.scrollHeight;
  const go = (y) => (window.T1 && T1.lenis) ? T1.lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y);
  const stuck = new Map();
  const check = () => {
    document.querySelectorAll('[data-anim]').forEach((el) => {
      if (el.closest('.promo-copy:not(.is-on), [hidden], .q-item:not(.is-on), .mega')) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.top > innerHeight * 0.7 || r.bottom < innerHeight * 0.3) return;
      const cs = getComputedStyle(el);
      const key = el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0] + ' "' + (el.textContent || '').trim().slice(0, 40) + '"';
      if (cs.visibility === 'hidden' || +cs.opacity < 0.05) stuck.set(el, key); else stuck.delete(el);
    });
  };
  for (let y = 0; y < H(); y += innerHeight * 0.5) { go(y); await sleep(650); check(); }
  const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src'));
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    hidden: [...stuck.values()].slice(0, 5),
    hiddenCount: stuck.size,
    broken,
    webgl: !!document.querySelector('.promo.has-gl'),
  };
}"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root):
    handler = functools.partial(Quiet, directory=str(root))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="+")
    ap.add_argument("--pages", type=int, default=0, help="limit pages per site (0 = all)")
    ap.add_argument("--shots", action="store_true")
    a = ap.parse_args()

    httpd, port = serve(ROOT)
    exe = os.environ.get("CHROMIUM") or next((str(p) for p in Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome")), None)
    failures, report = 0, {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"]) if exe else p.chromium.launch()
        for slug in a.slugs:
            site = ROOT / "sites" / slug
            if not site.exists():
                print(f"no build for {slug}: run python3 build/build.py first"); failures += 1; continue
            pages = sorted(site.glob("*.html"), key=lambda f: (f.name != "index.html", f.name))
            if a.pages:
                pages = pages[: a.pages]
            report[slug] = []
            for view, vp in VIEWS.items():
                ctx = b.new_context(viewport=vp, is_mobile=view == "phone", has_touch=view == "phone")
                for f in pages:
                    pg = ctx.new_page()
                    errs, bad = [], []
                    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                    pg.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" and "Failed to load resource" not in m.text else None)
                    pg.on("response", lambda r: bad.append(f"{r.status} {r.url.split(str(port))[-1]}") if r.status >= 400 and f"127.0.0.1:{port}" in r.url and not r.url.endswith("favicon.ico") else None)
                    url = f"http://127.0.0.1:{port}/sites/{slug}/{f.name}"
                    try:
                        pg.goto(url, wait_until="load", timeout=45000)
                        pg.wait_for_timeout(1500 if f.name == "index.html" else 700)
                        r = pg.evaluate(PROBE)
                    except Exception as e:
                        r = {"overflow": 0, "hidden": [], "hiddenCount": 0, "broken": [], "webgl": False}
                        errs.append(f"load failed: {e}"[:160])
                    problems = []
                    if errs: problems.append(f"errors: {errs[:3]}")
                    if bad: problems.append(f"missing files: {bad[:4]}")
                    if r["overflow"] > 1: problems.append(f"horizontal overflow {r['overflow']}px")
                    if r["broken"]: problems.append(f"broken images: {r['broken'][:3]}")
                    if r["hiddenCount"]: problems.append(f"{r['hiddenCount']} elements never revealed: {r['hidden'][:3]}")
                    if a.shots and f.name == "index.html":
                        out = ROOT / "qa-shots" / slug; out.mkdir(parents=True, exist_ok=True)
                        pg.screenshot(path=str(out / f"{view}.png"), full_page=False)
                    report[slug].append({"page": f.name, "view": view, "problems": problems, "webgl": r.get("webgl")})
                    flag = "FAIL" if problems else " ok "
                    if problems:
                        failures += 1
                    print(f"[{flag}] {slug:<16} {view:<7} {f.name}" + (f"  -> {'; '.join(problems)}" if problems else ""))
                    pg.close()
                ctx.close()
            # reduced motion: nothing may stay hidden, no loader
            ctx = b.new_context(viewport=VIEWS["desktop"], reduced_motion="reduce")
            pg = ctx.new_page()
            pg.goto(f"http://127.0.0.1:{port}/sites/{slug}/index.html", wait_until="load"); pg.wait_for_timeout(800)
            hidden = pg.evaluate("[...document.querySelectorAll('[data-anim]')].filter(e => getComputedStyle(e).visibility === 'hidden').length")
            print(f"[{'FAIL' if hidden else ' ok '}] {slug:<16} reduced-motion  {hidden} hidden")
            failures += 1 if hidden else 0
            ctx.close()
        b.close()
    httpd.shutdown()
    (ROOT / "qa-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\n{'All clear' if not failures else str(failures) + ' problem(s)'} - details in qa-report.json")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
