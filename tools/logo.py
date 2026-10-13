#!/usr/bin/env python3
"""Make a company logo sit in the page instead of on a sticker.

  python3 tools/logo.py shared/img/<dir>/logo.png [--keep-bg]

Writes next to it:
  logo-t.png      the logo with any plain outer background (white or near white, touching the
                  edges) made transparent and trimmed, so it can sit on any header colour
  logo-light.png  the version for dark headers and photos: dark or grey ink turns white,
                  saturated brand colours (a red crescent, a blue tagline) stay as they are
build.py picks both up on its own: the header shows the light logo over imagery and on dark
themes, the full-colour logo on light bars. No pills or circles behind logos.
"""
import argparse
import colorsys
from collections import deque
from pathlib import Path

from PIL import Image


def clear_outer_background(im, tol=28):
    """Flood-fill from the edges through near-white pixels and make them transparent."""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    lim = 255 - tol
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if a < 20 or (r >= lim and g >= lim and b >= lim):
            # soften the anti-aliased rim instead of a hard cut
            px[x, y] = (r, g, b, 0)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                    q.append((nx, ny))
    return im


def light_version(im):
    """Dark or grey ink turns white; saturated colour stays; ink printed on a white plate inside
    the mark (letters in a white disc or globe) keeps its colour, because the plate stays white."""
    import numpy as np
    from scipy import ndimage
    a = np.asarray(im).astype(np.float32) / 255
    rgb, alpha = a[..., :3], a[..., 3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    ink = (alpha > 0.05) & ((mx < 0.55) | (sat < 0.28)) & ~(mn > 0.86)
    plate = (alpha > 0.5) & (mn > 0.86)                       # white areas that are part of the logo
    # only a real plate counts (a white disc or globe), not the soft white rim of letters
    plate = ndimage.binary_opening(plate, iterations=3)
    on_plate = ndimage.binary_dilation(plate, iterations=5) if plate.mean() > 0.02 else np.zeros_like(plate)
    turn = ink & ~on_plate
    out = np.asarray(im).copy()
    out[turn, :3] = 255
    rim = (alpha > 0.05) & ~turn & ~on_plate & (sat < 0.45) & (mx < 0.8)  # anti-aliased edge of ink
    out[rim, :3] = 255
    return Image.fromarray(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("logo")
    ap.add_argument("--keep-bg", action="store_true", help="the background is part of the mark (a badge): leave it")
    ap.add_argument("--light-same", action="store_true", help="a self-contained badge that reads on dark as it is")
    ap.add_argument("--protect", help="x0:x1 fractions of the width to keep in full colour (an emblem beside a wordmark)")
    a = ap.parse_args()
    src = Path(a.logo)
    im = Image.open(src).convert("RGBA")
    if not a.keep_bg:
        im = clear_outer_background(im)
    box = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if box:
        im = im.crop(box)
    t = src.with_name(src.stem + "-t.png")
    im.save(t, optimize=True)
    light = im.copy() if a.light_same else light_version(im)
    if a.protect and not a.light_same:
        x0, x1 = (float(v) for v in a.protect.split(":"))
        box = (int(x0 * im.width), 0, int(x1 * im.width), im.height)
        light.paste(im.crop(box), box)
    light.save(src.with_name(src.stem + "-light.png"), optimize=True)
    print(t, im.size, "and", src.stem + "-light.png")


if __name__ == "__main__":
    main()
