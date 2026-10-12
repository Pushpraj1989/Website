#!/usr/bin/env python3
"""Split ONE real product photo (already cut out with tools/cutout.py) into its layers, so the
`stack` module can open the company's own burger, sandwich or cake instead of stock parts.

Each layer is picked by colour (HSV, OpenCV scale: hue 0-180, sat/val 0-255) and/or a region
of the image (fractions of height/width). Pixels go to the first layer in `order` that claims
them; the rest go to the layer marked "rest". Gaps where a layer was hidden behind another are
closed and filled from the layer's own texture (inpainting), so it looks whole when it moves apart.

  pip install opencv-python-headless numpy
  python3 tools/split_layers.py shared/img/<slug>/cut/burger.webp spec.json --out shared/img/<slug>/cut

spec.json:
{"name": "burger",
 "order": ["cheese", "tomato", "lettuce", "bun"],            # claim priority (front-most first)
 "layers": {
   "cheese":  {"hsv": [[8, 26, 110, 255, 140, 255]]},          # [hmin, hmax, smin, smax, vmin, vmax], several allowed
   "tomato":  {"hsv": [[0, 7, 120, 255, 80, 255], [172, 180, 120, 255, 80, 255]], "y": [0.6, 1]},
   "lettuce": {"hsv": [[28, 90, 40, 255, 30, 255]], "y": [0.65, 1]},
   "bun":     {"y": [0, 0.44]},
   "beef":    {"rest": true, "close": 45, "fill": true}},      # close = gap-filling kernel in px; fill = fill all holes
 "stack": ["lettuce", "tomato", "beef", "cheese", "bun"]}       # bottom to top, written as <name>-<n>-<layer>.webp
Also writes <name>.layers.json (aspect + each layer's place in the photo) for the `stack` module.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def mask_for(spec, hsv, h, w):
    m = np.zeros((h, w), bool)
    if spec.get("hsv"):
        for hmin, hmax, smin, smax, vmin, vmax in spec["hsv"]:
            m |= cv2.inRange(hsv, (hmin, smin, vmin), (hmax, smax, vmax)) > 0
    else:
        m[:] = True
    y0, y1 = spec.get("y", [0, 1]); x0, x1 = spec.get("x", [0, 1])
    region = np.zeros((h, w), bool)
    region[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
    if spec.get("circle"):  # [cx, cy, r] as fractions of width/height/width: a pot, a cup, a sauce dish
        cx, cy, r = spec["circle"]
        yy, xx = np.ogrid[:h, :w]
        region &= (xx - cx * w) ** 2 + (yy - cy * h) ** 2 <= (r * w) ** 2
    return m & region


def clone_fill(bgr, own, holes):
    """Fill hidden parts of a layer with its own texture, clone-stamp style: copy pixels from the
    same layer at a range of offsets (organic textures such as meat, bread or leaves hide the
    seams), then soften the seams; whatever is left is inpainted."""
    out, todo = bgr.copy(), holes.copy()
    h, w = own.shape
    own = cv2.erode(own.astype(np.uint8), np.ones((11, 11), np.uint8)) > 0  # sample well inside, away from a neighbour's fringe
    for r in (70, 100, 140, 190, 250, 40):
        for ang in range(0, 360, 30):
            dx, dy = int(r * np.cos(np.radians(ang))), int(r * np.sin(np.radians(ang)) * 0.5)
            M = np.float32([[1, 0, dx], [0, 1, dy]])
            src_ok = cv2.warpAffine(own.astype(np.uint8), M, (w, h), flags=cv2.INTER_NEAREST) > 0
            take = todo & src_ok
            if take.any():
                out[take] = cv2.warpAffine(bgr, M, (w, h))[take]
                todo &= ~take
        if not todo.any():
            break
    if todo.any():
        out = cv2.inpaint(out, todo.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
    soft = cv2.GaussianBlur(out, (5, 5), 0)
    edge = cv2.dilate(holes.astype(np.uint8), np.ones((5, 5), np.uint8)) & ~cv2.erode(holes.astype(np.uint8), np.ones((5, 5), np.uint8))
    out[edge > 0] = soft[edge > 0]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("spec"); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    rgba = cv2.imread(a.image, cv2.IMREAD_UNCHANGED)
    if rgba.shape[2] == 3:
        raise SystemExit("needs a cut-out with transparency (tools/cutout.py)")
    h, w = rgba.shape[:2]
    bgr, alpha = rgba[:, :, :3], rgba[:, :, 3] > 40
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    free = alpha.copy()
    masks = {}
    for name in spec["order"]:
        m = mask_for(spec["layers"][name], hsv, h, w) & free
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        g = spec["layers"][name].get("grow", 0)  # also claim the soft fringe around the colour match
        if g:
            m = (cv2.dilate(m.astype(np.uint8), np.ones((2 * g + 1, 2 * g + 1), np.uint8)) > 0) & free
        masks[name] = m
        free &= ~m
    rest = [n for n, s in spec["layers"].items() if s.get("rest")]
    if rest:
        masks[rest[0]] = free
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    manifest = {"aspect": round(w / h, 4), "layers": []}
    for i, name in enumerate(spec["stack"]):
        m = masks[name].astype(np.uint8)
        k = spec["layers"][name].get("close", 15)
        solid = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        n, lab, stats, _ = cv2.connectedComponentsWithStats(solid)
        if n > 2:  # keep the main pieces, drop crumbs
            big = stats[1:, cv2.CC_STAT_AREA].max()
            solid = np.isin(lab, [j for j in range(1, n) if stats[j, cv2.CC_STAT_AREA] >= big * 0.04]).astype(np.uint8)
        if spec["layers"][name].get("fill"):  # fill every interior hole (big occluded areas)
            cs, _ = cv2.findContours(solid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            solid = cv2.drawContours(np.zeros_like(solid), cs, -1, 1, -1)
        holes = (solid > 0) & (m == 0)
        filled = clone_fill(bgr, m.astype(bool), holes) if holes.any() else bgr
        a_ch = cv2.GaussianBlur(solid.astype(np.float32) * 255, (3, 3), 0).astype(np.uint8)
        layer = np.dstack([filled, a_ch])
        ys, xs = np.where(solid > 0)
        if not len(ys):
            print("empty layer:", name); continue
        crop = layer[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        dst = out / f"{spec['name']}-{i}-{name}.webp"
        cv2.imwrite(str(dst), crop, [cv2.IMWRITE_WEBP_QUALITY, 85])
        # where the layer sat in the photo, as fractions: the stack module rebuilds the product exactly
        manifest["layers"].append({"layer": name, "file": dst.name, "left": round(xs.min() / w, 4), "width": round((xs.max() + 1 - xs.min()) / w, 4),
                                   "bottom": round((h - 1 - ys.max()) / h, 4), "height": round((ys.max() + 1 - ys.min()) / h, 4)})
        print(dst, crop.shape[1], "x", crop.shape[0], "rows", ys.min(), "-", ys.max(), "of", h)
    (out / f"{spec['name']}.layers.json").write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main()
