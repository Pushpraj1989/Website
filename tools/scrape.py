#!/usr/bin/env python3
"""Crawl a company's existing website and save what a redesign needs.

    python3 tools/scrape.py https://www.example.com --slug example
    python3 tools/scrape.py https://www.example.com --slug example --max 200 --images

Writes research/<slug>/:
  pages.jsonl     one record per page: url, kind, title, description, headings,
                  paragraphs, list items, prices, phones, emails, images, JSON-LD
  summary.json    site name, nav, contacts, socials, page counts by kind, top images,
                  news candidates, product candidates, location candidates
  images/         (with --images) photos at least --min-width px wide, plus _map.json

Polite by default: honours robots.txt, one request at a time with a delay, and a
clear user agent. Only standard library (+ Pillow for --images).
Everything it saves is raw material. A person (or the AI following the skill)
curates it into data/<slug>.json, keeping a source URL on every fact.
"""

import argparse
import gzip
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import Counter, deque
from html.parser import HTMLParser
from pathlib import Path

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 site-kit-research"
KINDS = [  # first match wins; tested against the URL path and the page title
    ("news", r"news|press|media|blog|article|event|stories|announcement|insight"),
    ("product", r"product|menu|shop|store|item|catalog|collection|package|plan|offer|account|card|loan|policy|insurance-|model|range"),
    ("service", r"service|speciali|department|solution|capabilit|division|business|sector|industr|what-we-do|treatment|procedure"),
    ("location", r"location|branch|store-locator|find-us|centre|center|clinic|hospital|office|network|contact"),
    ("people", r"doctor|team|leadership|management|board|people|profile|our-chef|staff"),
    ("about", r"about|history|story|vision|mission|values|who-we-are|overview|award|accredit|quality"),
    ("careers", r"career|job|vacanc|join-us|recruit"),
    ("faq", r"faq|help|support|question"),
    ("legal", r"privacy|terms|cookie|legal|disclaimer|sitemap"),
]
SOCIAL = r"(facebook|instagram|twitter|x\.com|linkedin|youtube|tiktok|snapchat|wa\.me|whatsapp|t\.me|pinterest)"
PHONE = re.compile(r"(?:\+|00)\d[\d\s().-]{7,16}\d")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PRICE = re.compile(r"(?:(?:USD|EUR|GBP|AED|OMR|SAR|QAR|KWD|BHD|INR|RO|Rs\.?|\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|AED|OMR|SAR|QAR|KWD|BHD|INR|RO))")
SKIP_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|avi|mov|ics|xml|json|css|js|woff2?|ttf|ico)(\?|$)", re.I)


class Page(HTMLParser):
    """Collects text by element, links, images and JSON-LD without third-party parsers."""

    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.title = ""
        self.meta = {}
        self.headings = []
        self.paras = []
        self.items = []
        self.links = []
        self.images = []
        self.jsonld = []
        self.nav = []
        self._stack = []
        self._buf = []
        self._skip = 0
        self._in_nav = 0
        self._script_ld = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "noscript", "svg", "template"):
            self._skip += 1
            self._script_ld = tag == "script" and "ld+json" in (a.get("type") or "")
        if tag in ("nav", "header"):
            self._in_nav += 1
        if tag == "meta":
            k = a.get("property") or a.get("name")
            if k and a.get("content"):
                self.meta[k.lower()] = a["content"].strip()
        if tag == "a" and a.get("href"):
            href = urllib.parse.urljoin(self.base, a["href"].strip())
            self.links.append(href)
            self._stack.append(("a", href))
        if tag == "img":
            src = a.get("data-src") or a.get("data-lazy-src") or a.get("src") or ""
            srcset = a.get("srcset") or a.get("data-srcset") or ""
            if srcset:  # prefer the largest candidate
                cands = [c.strip().split(" ") for c in srcset.split(",") if c.strip()]
                best = max(cands, key=lambda c: int(re.sub(r"\D", "", c[1]) or 0) if len(c) > 1 else 0)
                src = best[0] or src
            if src and not src.startswith("data:"):
                self.images.append({"src": urllib.parse.urljoin(self.base, src), "alt": (a.get("alt") or "").strip(),
                                    "w": a.get("width"), "h": a.get("height")})
        style = a.get("style") or ""
        m = re.search(r"url\(['\"]?([^'\")]+)", style)
        if m and not m.group(1).startswith("data:"):
            self.images.append({"src": urllib.parse.urljoin(self.base, m.group(1)), "alt": "", "bg": True})
        if tag in ("h1", "h2", "h3", "h4", "p", "li", "td", "th", "title", "dt", "dd", "figcaption", "blockquote", "address"):
            self._flush()
            self._stack.append((tag, None))

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "template"):
            self._skip = max(0, self._skip - 1)
            self._script_ld = False
        if tag in ("nav", "header"):
            self._in_nav = max(0, self._in_nav - 1)
        if tag in ("h1", "h2", "h3", "h4", "p", "li", "td", "th", "title", "dt", "dd", "figcaption", "blockquote", "address"):
            self._flush(tag)
        if tag == "a" and self._stack and self._stack[-1][0] == "a":
            _, href = self._stack.pop()
            text = " ".join("".join(self._buf).split())
            if self._in_nav and text and len(text) < 40:
                self.nav.append({"text": text, "href": href})

    def handle_data(self, data):
        if self._script_ld:
            self.jsonld.append(data)
            return
        if not self._skip:
            self._buf.append(data)

    def _flush(self, tag=None):
        text = " ".join("".join(self._buf).split())
        self._buf = []
        while self._stack and self._stack[-1][0] not in ("h1", "h2", "h3", "h4", "p", "li", "td", "th", "title", "dt", "dd", "figcaption", "blockquote", "address"):
            if self._stack[-1][0] == "a":
                break
            self._stack.pop()
        if not tag or not text:
            if tag and self._stack and self._stack[-1][0] == tag:
                self._stack.pop()
            return
        if self._stack and self._stack[-1][0] == tag:
            self._stack.pop()
        if tag == "title":
            self.title = text
        elif tag in ("h1", "h2", "h3", "h4"):
            self.headings.append({"tag": tag, "text": text})
        elif tag in ("p", "blockquote", "figcaption", "address", "dd"):
            if len(text) > 25:
                self.paras.append(text)
        elif len(text) > 2 and not self._in_nav:
            self.items.append(text)


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
        ctype = r.headers.get("Content-Type", "")
        charset = re.search(r"charset=([\w-]+)", ctype)
        return r.geturl(), ctype, raw.decode(charset.group(1) if charset else "utf-8", errors="replace")


class Renderer:
    """Headless Chromium for JavaScript-rendered sites (pip install playwright)."""

    def __init__(self, out):
        import os
        from playwright.sync_api import sync_playwright
        self.out = out
        self.api_dir = out / "api"
        self.api_dir.mkdir(parents=True, exist_ok=True)
        self.media = {}
        self.pw = sync_playwright().start()
        exe = os.environ.get("CHROMIUM") or next((str(p) for p in Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome")), None)
        self.browser = self.pw.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else self.pw.chromium.launch()
        self.ctx = self.browser.new_context(user_agent=UA, viewport={"width": 1440, "height": 900})
        self.n_api = 0

    def fetch(self, url):
        pg = self.ctx.new_page()
        def on_resp(r):
            try:
                ct = r.headers.get("content-type", "")
                u = r.url
                if r.status >= 400:
                    return
                if re.search(r"\.(mp4|webm|m3u8)(\?|$)", u, re.I) or ct.startswith("video/"):
                    self.media.setdefault(u.split("?")[0], {"type": "video", "page": url})
                elif ct.startswith("image/") and not re.search(r"logo|icon|sprite|favicon|\.svg", u, re.I):
                    self.media.setdefault(u, {"type": "image", "page": url})
                elif "json" in ct and r.request.resource_type in ("xhr", "fetch"):
                    body = r.text()
                    if len(body) > 200:
                        self.n_api += 1
                        name = re.sub(r"[^a-z0-9]+", "-", urllib.parse.urlparse(u).path.lower()).strip("-")[:80] or "api"
                        (self.api_dir / f"{self.n_api:03d}-{name}.json").write_text(json.dumps({"url": u, "page": url, "body": json.loads(body)}, ensure_ascii=False), encoding="utf-8")
            except Exception:
                pass
        pg.on("response", on_resp)
        try:
            pg.goto(url, wait_until="networkidle", timeout=45000)
        except Exception:
            pass
        for _ in range(14):  # scroll so lazy images, videos and data load
            pg.mouse.wheel(0, 900); pg.wait_for_timeout(250)
        pg.wait_for_timeout(800)
        for v in pg.eval_on_selector_all("video, video source", "els => els.map(e => e.currentSrc || e.src || e.getAttribute('src')).filter(Boolean)"):
            self.media.setdefault(urllib.parse.urljoin(url, v).split("?")[0], {"type": "video", "page": url})
        html, final = pg.content(), pg.url
        pg.close()
        return final, "text/html", html

    def close(self):
        (self.out / "media.json").write_text(json.dumps(self.media, indent=2, ensure_ascii=False), encoding="utf-8")
        self.browser.close(); self.pw.stop()


def sitemap_urls(root, rp, limit):
    out, seen = [], set()
    queue = deque()
    for sm in (rp.site_maps() or []) + [urllib.parse.urljoin(root, "/sitemap.xml"), urllib.parse.urljoin(root, "/sitemap_index.xml"), urllib.parse.urljoin(root, "/wp-sitemap.xml")]:
        queue.append(sm)
    while queue and len(out) < limit * 3:
        sm = queue.popleft()
        if sm in seen:
            continue
        seen.add(sm)
        try:
            _, _, xml = fetch(sm)
        except Exception:
            continue
        for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml):
            loc = loc.replace("&amp;", "&")
            (queue.append(loc) if loc.endswith(".xml") or "sitemap" in loc else out.append(loc))
    return out


def kind_of(url, title):
    path = urllib.parse.urlparse(url).path.lower()
    if path in ("", "/") or re.fullmatch(r"/(en|ar|home|index\.\w+)/?", path):
        return "home"
    hay = path + " " + (title or "").lower()
    for k, pat in KINDS:
        if re.search(pat, hay):
            return k
    return "page"


def ld_objects(blocks):
    out = []
    for b in blocks:
        try:
            data = json.loads(b)
        except Exception:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            o = stack.pop()
            if isinstance(o, dict):
                if "@graph" in o:
                    stack.extend(o["@graph"])
                out.append(o)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--max", type=int, default=150, help="maximum pages to fetch")
    ap.add_argument("--delay", type=float, default=0.6)
    ap.add_argument("--images", action="store_true", help="download large photos")
    ap.add_argument("--min-width", type=int, default=900)
    ap.add_argument("--max-images", type=int, default=80)
    ap.add_argument("--out", default="research")
    ap.add_argument("--render", action="store_true", help="load pages in headless Chromium (JavaScript apps: React, Angular, Next, Vue); also saves the JSON the app fetches and every image/video it requests")
    ap.add_argument("--exclude", default="", help="regex of URLs to skip, e.g. '/ar/' for a duplicate Arabic tree")
    ap.add_argument("--ignore-robots", action="store_true", help="only with the site owner's permission")
    args = ap.parse_args()

    out = Path(args.out) / args.slug
    out.mkdir(parents=True, exist_ok=True)
    start = args.url if "://" in args.url else "https://" + args.url
    try:
        final, _, _ = fetch(start)
    except Exception as e:
        sys.exit(f"cannot reach {start}: {e}")
    root = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(final))
    host = urllib.parse.urlparse(root).netloc.replace("www.", "")

    rp = urllib.robotparser.RobotFileParser(urllib.parse.urljoin(root, "/robots.txt"))
    try:
        rp.read()
    except Exception:
        pass
    allowed = (lambda u: True) if args.ignore_robots else (lambda u: rp.can_fetch(UA, u) if rp.default_entry or rp.entries else True)

    def internal(u):
        p = urllib.parse.urlparse(u)
        return p.scheme in ("http", "https") and p.netloc.replace("www.", "").endswith(host) and not SKIP_EXT.search(p.path)

    renderer = Renderer(out) if args.render else None
    get = renderer.fetch if renderer else fetch
    queue = deque([final])
    for u in sitemap_urls(root, rp, args.max):
        if internal(u):
            queue.append(u)
    seen, records = set(), []
    with open(out / "pages.jsonl", "w", encoding="utf-8") as fh:
        while queue and len(records) < args.max:
            url = queue.popleft().split("#")[0]
            key = url.rstrip("/").replace("://www.", "://")
            if key in seen or not internal(url) or not allowed(url) or (args.exclude and re.search(args.exclude, url)):
                continue
            seen.add(key)
            try:
                got, ctype, html = get(url)
            except (urllib.error.URLError, TimeoutError, ValueError, ConnectionError) as e:
                print(f"skip {url}: {e}", file=sys.stderr)
                continue
            if "html" not in ctype:
                continue
            p = Page(got)
            try:
                p.feed(html)
            except Exception:
                pass
            text = " ".join(p.paras + p.items)
            rec = {
                "url": got, "kind": kind_of(got, p.title), "title": p.title,
                "description": p.meta.get("description") or p.meta.get("og:description", ""),
                "og_image": p.meta.get("og:image", ""),
                "published": p.meta.get("article:published_time", ""),
                "headings": p.headings[:40], "paragraphs": p.paras[:80], "items": p.items[:150],
                "prices": sorted(set(PRICE.findall(text)))[:40],
                "phones": sorted(set(m.strip() for m in PHONE.findall(text + " " + " ".join(l for l in p.links if l.startswith("tel:")))))[:20],
                "emails": sorted(set(e for e in EMAIL.findall(text + " " + " ".join(p.links)) if not e.endswith((".png", ".jpg"))))[:20],
                "images": [i for i in p.images if not re.search(r"logo|icon|sprite|favicon|avatar|placeholder|blank|pixel", i["src"], re.I)][:60],
                "links": sorted(set(l for l in p.links if internal(l)))[:300],
                "social": sorted(set(l for l in p.links if re.search(SOCIAL, l)))[:20],
                "jsonld": ld_objects(p.jsonld)[:20],
                "nav": p.nav[:60],
            }
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            records.append(rec)
            print(f"[{len(records):>3}] {rec['kind']:<8} {got}")
            seen.add(got.rstrip("/").replace("://www.", "://"))
            for l in rec["links"]:
                if l.rstrip("/").replace("://www.", "://") not in seen:
                    queue.append(l)
            time.sleep(args.delay)

    if renderer:
        renderer.close()
        print(f"rendered mode: {renderer.n_api} JSON responses in {out}/api/, {len(renderer.media)} media files listed in media.json")

    # ---- summary ----
    GENERIC = re.compile(r"^(search|menu|navigation|main menu|close|share|follow us|contact us|quick links|related|newsletter)$", re.I)

    def main_title(r):
        hs = [h["text"] for h in r["headings"] if not GENERIC.match(h["text"])]
        h1 = [h["text"] for h in r["headings"] if h["tag"] == "h1" and not GENERIC.match(h["text"])]
        return (h1 or hs or [re.split(r"\s[-|–]\s", r["title"])[0]])[0]

    home = next((r for r in records if r["kind"] == "home"), records[0] if records else {})
    counts = Counter(r["kind"] for r in records)
    phones = Counter(ph for r in records for ph in r["phones"])
    emails = Counter(e for r in records for e in r["emails"])
    socials = sorted(set(s for r in records for s in r["social"]))
    imgs = Counter(i["src"] for r in records for i in r["images"])
    orgs = [o for r in records for o in r["jsonld"] if o.get("@type") in ("Organization", "LocalBusiness", "Hospital", "MedicalOrganization", "Restaurant", "CafeOrCoffeeShop", "BankOrCreditUnion", "InsuranceAgency", "Store", "Corporation")]
    summary = {
        "source": root, "fetched": time.strftime("%Y-%m-%d"), "pages": len(records), "by_kind": dict(counts),
        "site_name": home.get("title", ""), "description": home.get("description", ""), "og_image": home.get("og_image", ""),
        "nav": home.get("nav", []),
        "phones": [p for p, _ in phones.most_common(12)], "emails": [e for e, _ in emails.most_common(8)],
        "social": socials, "organisation_ld": orgs[:5],
        "news": [{"title": main_title(r), "url": r["url"], "date": r["published"], "summary": r["description"] or (r["paragraphs"][0] if r["paragraphs"] else ""), "image": r["og_image"]} for r in records if r["kind"] == "news"][:40],
        "products": [{"title": main_title(r), "url": r["url"], "prices": r["prices"][:5], "image": r["og_image"]} for r in records if r["kind"] == "product"][:80],
        "services": [{"title": main_title(r), "url": r["url"], "summary": r["description"]} for r in records if r["kind"] == "service"][:60],
        "locations": [{"title": main_title(r), "url": r["url"], "phones": r["phones"][:3]} for r in records if r["kind"] == "location"][:60],
        "top_images": [u for u, _ in imgs.most_common(60)],
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(records)} pages -> {out}/pages.jsonl, summary.json  {dict(counts)}")

    if args.images:
        try:
            from PIL import Image
        except ImportError:
            sys.exit("--images needs Pillow: pip install pillow")
        idir = out / "images"
        idir.mkdir(exist_ok=True)
        seen_img, saved = set(), {}
        cands = [(i, r["url"]) for r in records for i in r["images"]] + [({"src": r["og_image"], "alt": r["title"]}, r["url"]) for r in records if r["og_image"]]
        if (out / "media.json").exists():
            cands += [({"src": u, "alt": ""}, m["page"]) for u, m in json.loads((out / "media.json").read_text()).items() if m["type"] == "image"]
        for img, page in cands:
            if len(saved) >= args.max_images:
                break
            src = img["src"]
            if src in seen_img:
                continue
            seen_img.add(src)
            try:
                req = urllib.request.Request(urllib.parse.quote(src, safe=":/?=&%#+,;"), headers={"User-Agent": UA, "Referer": page})
                data = urllib.request.urlopen(req, timeout=30).read()
                im = Image.open(io.BytesIO(data))
                if im.width < args.min_width:
                    continue
                im = im.convert("RGB")
                if im.width > 1800:
                    im = im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS)
                name = re.sub(r"[^a-z0-9]+", "-", Path(urllib.parse.urlparse(src).path).stem.lower()).strip("-")[:50] or f"img{len(saved)}"
                while (idir / f"{name}.jpg").exists():
                    name += "-2"
                im.save(idir / f"{name}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
                saved[f"{name}.jpg"] = {"url": src, "page": page, "alt": img.get("alt", ""), "size": list(im.size)}
                print(f"img {name}.jpg {im.size}")
                time.sleep(args.delay / 2)
            except Exception:
                continue
        (idir / "_map.json").write_text(json.dumps(saved, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{len(saved)} images -> {idir}")


if __name__ == "__main__":
    main()
