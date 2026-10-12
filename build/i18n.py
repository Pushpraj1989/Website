"""Second-language builds (Arabic first): sites/<slug>/ar/*.html, right to left.

How it works
  1. tools/i18n.py extract <slug>  lists every translatable string in data/<slug>.json
     (i18n/<slug>.strings.json). Translate them into data/i18n/<slug>.ar.json: {"English": "Arabic"}.
  2. build.py translates a copy of the raw data with that table, keeping the English titles
     and labels as _en_<key> so file names, cart SKUs and @links stay the same as English.
  3. The rendered pages get the kit's interface strings (build/i18n/ar.json) and their asset
     paths moved one folder up, plus lang/dir. Strings missing from a table stay English.
"""
import copy
import html as html_lib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent

# keys whose string values are identifiers, files, links or settings, never shown as text
SKIP_KEYS = {
    "src", "image", "images_key", "href", "icon", "gallery", "email", "website", "web", "map", "directions",
    "sources", "confirm", "reviews", "instagram", "facebook", "twitter", "linkedin", "youtube", "url", "video", "video_m",
    "poster", "slug", "theme", "img_dir", "logo", "mode", "front", "back", "back_kind", "moments", "promo_fx",
    "style", "accent", "accent2", "accent_ink", "font_display", "font_body", "fonts_url", "bg", "fg", "alt_bg", "tint",
    "color", "id", "kind", "home", "payments", "card_logos", "currency", "fit", "dish", "key", "layer", "file",
    "frames", "dir", "embed", "tel", "number", "whatsapp", "wa", "api", "lang", "flav", "sheen", "reflect", "variant",
    "credits", "footer_note_src", "tiers", "periods_key", "ar_display", "ar_body",
}
# keys whose value may be a title another block refers to: keep the English as _en_<key>
NAME_KEYS = ("title", "nav", "name", "label", "short")
_ID = re.compile(r"^(?:[a-z0-9_:-]+|#[0-9a-fA-F]{3,8}|https?://\S+|mailto:\S+|tel:\S+|@\S.*|[\w./-]+\.(?:jpg|jpeg|png|webp|svg|mp4|webm|html|pdf))$")


def is_text(key, value):
    if not isinstance(value, str) or key in SKIP_KEYS:
        return False
    t = value.strip()
    return len(t) > 1 and bool(re.search(r"[A-Za-z]{2}", t)) and not _ID.match(t)


def extract(data):
    out, seen = [], set()

    def walk(o, k=None):
        if isinstance(o, dict):
            for kk, v in o.items():
                if not kk.startswith("_"):
                    walk(v, kk)
        elif isinstance(o, list):
            for v in o:
                walk(v, k)
        elif is_text(k, o) and o.strip() not in seen:
            seen.add(o.strip()); out.append(o.strip())
    walk(data)
    return out


def translate(data, table):
    """A translated deep copy of raw site data, plus the list of strings with no translation."""
    missing = []

    def tr(k, v):
        if not is_text(k, v):
            return v
        t = table.get(v.strip())
        if t is None:
            missing.append(v.strip()); return v
        return t

    def walk(o, k=None):
        if isinstance(o, dict):
            for kk in list(o.keys()):
                v = o[kk]
                if kk.startswith("_"):
                    continue
                if kk in NAME_KEYS and isinstance(v, str):
                    o["_en_" + kk] = v
                if isinstance(v, (dict, list)):
                    walk(v, kk)
                else:
                    o[kk] = tr(kk, v)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                if isinstance(v, (dict, list)):
                    walk(v, k)
                else:
                    o[i] = tr(k, v)
    d = copy.deepcopy(data)
    walk(d)
    return d, sorted(set(missing))


def en(o, key):
    """The English value of a translated field (file names and links are built from it)."""
    return o.get("_en_" + key, o.get(key)) if isinstance(o, dict) else None


def load_ui(lang):
    p = HERE / "i18n" / f"{lang}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"exact": {}, "patterns": []}


_SKIP_BLOCK = re.compile(r"(<script\b.*?</script>|<style\b.*?</style>|<svg\b.*?</svg>)", re.S | re.I)
_ATTR = re.compile(r'\b(aria-label|placeholder|title|alt|content|data-label|value)="([^"]*[A-Za-z][^"]*)"')
_TEXT = re.compile(r">([^<>]*[A-Za-z][^<>]*)<")
_ASSET = re.compile(r'(?<=\s)([\w:-]+)="(assets/[^"]*)"')  # any attribute pointing into assets/


def localize_html(html, ui, up="../"):
    """Interface strings to the second language, asset paths one folder up."""
    exact = ui.get("exact", {})
    pats = [(re.compile(p), r) for p, r in ui.get("patterns", [])]
    inline = [(re.compile(p), r) for p, r in ui.get("inline", [])]

    def word(t):
        core = html_lib.unescape(t.strip())
        if not core:
            return t
        rep = exact.get(core)
        if rep is None:
            for rx, r in pats:
                if rx.fullmatch(core):
                    rep = rx.sub(r, core); break
        out = core if rep is None else rep
        for rx, r in inline:
            out = rx.sub(r, out)
        if out == core:
            return t
        lead, trail = t[:len(t) - len(t.lstrip())], t[len(t.rstrip()):]
        return lead + html_lib.escape(out, quote=False) + trail

    kept = []  # script, style and svg blocks stay as they are (a placeholder keeps the text boundaries)

    def keep(m):
        kept.append(m.group(0)); return f"<!--k{len(kept) - 1}-->"
    html = _SKIP_BLOCK.sub(keep, html)
    html = _TEXT.sub(lambda m: ">" + word(m.group(1)) + "<", html)
    html = _ATTR.sub(lambda m: f'{m.group(1)}="{word(m.group(2))}"', html)
    html = re.sub(r"<!--k(\d+)-->", lambda m: kept[int(m.group(1))], html)
    html = _ASSET.sub(lambda m: f'{m.group(1)}="{up}{m.group(2)}"', html)
    html = re.sub(r"url\((['\"]?)assets/", lambda m: f"url({m.group(1)}{up}assets/", html)
    return html
