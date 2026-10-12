#!/usr/bin/env python3
"""Cut real product photos out of their background (transparent WebP), so dishes,
packs and products can float on the page instead of sitting in boxes.

Uses rembg with the BiRefNet model (open source, runs locally; first run downloads ~220 MB).
  pip install rembg onnxruntime

  python3 tools/cutout.py shared/img/<slug>/*.jpg --out shared/img/<slug>/cut
  python3 tools/cutout.py photo.jpg --out shared/img/<slug>/cut --model isnet-general-use   # faster

Writes <name>.webp trimmed to the subject (small margin), max 1400 px, plus a
<name>.json with the subject's box so pages can place shadows. Existing files are skipped.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="birefnet-general-lite")
    ap.add_argument("--size", type=int, default=1400)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    from rembg import new_session, remove  # imported late so --help works without rembg

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    session = new_session(a.model)
    for src in map(Path, a.images):
        dst = out / (src.stem + ".webp")
        if dst.exists() and not a.force:
            continue
        im = Image.open(src).convert("RGB")
        cut = remove(im, session=session, post_process_mask=True)
        alpha = cut.getchannel("A").point(lambda v: 0 if v < 12 else v)  # drop faint halo
        cut.putalpha(alpha)
        box = alpha.getbbox()
        if not box:
            print("empty cutout:", src, file=sys.stderr)
            continue
        pad = int(max(box[2] - box[0], box[3] - box[1]) * 0.03)
        box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, cut.width), min(box[3] + pad, cut.height))
        cut = cut.crop(box)
        cut.thumbnail((a.size, a.size), Image.LANCZOS)
        cut.save(dst, "WEBP", quality=82, method=6)
        cover = sum(1 for v in cut.getchannel("A").getdata() if v > 128) / (cut.width * cut.height)
        (out / (src.stem + ".json")).write_text(json.dumps({"w": cut.width, "h": cut.height, "fill": round(cover, 3)}))
        print(dst, cut.size)


if __name__ == "__main__":
    main()
