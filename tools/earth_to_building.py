"""Vertical reel: real Earth from space, zoom to Oman, through clouds, aerial, then the street.

    python3 tools/earth_to_building.py <out.mp4>

Inputs (public domain NASA Blue Marble, and the client team's own photos):
  shared/img/azaiba-gardens/space/globe_east_2048.jpg
  shared/img/azaiba-gardens/own-courtyard-aerial.jpg
  shared/img/azaiba-gardens/own-street.jpg
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "shared/img/azaiba-gardens"
W, H, FPS, SECONDS = 720, 1280, 30, 10
N = FPS * SECONDS
OMAN = (740.0, 880.0)                     # Oman coast in the 2048px NASA image
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
FONT_B = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 44)


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def load_globe():
    g = Image.open(IMG / "space/globe_east_2048.jpg").convert("RGB")
    pad = Image.new("RGB", (4096, 4096), (0, 0, 0))
    pad.paste(g, (1024, 1024))
    return pad


def cover(path):
    return ImageOps.fit(Image.open(path).convert("RGB"), (W, H), Image.LANCZOS)


def clouds(seed=3):
    rng = np.random.default_rng(seed)
    acc = np.zeros((H, W), np.float32)
    for scale, weight in [(160, 1.0), (60, 0.5), (24, 0.25)]:
        small = rng.random((H // scale + 3, W // scale + 3)).astype(np.float32)
        layer = Image.fromarray((small * 255).astype(np.uint8)).resize((W + scale * 3, H + scale * 3), Image.BICUBIC)
        acc += np.asarray(layer.filter(ImageFilter.GaussianBlur(scale / 3)), np.float32)[:H, :W] / 255 * weight
    acc = (acc - acc.min()) / (acc.max() - acc.min())
    return Image.fromarray((np.clip((acc - 0.35) * 2.2, 0, 1) * 255).astype(np.uint8))


def stars(t):
    rng = np.random.default_rng(11)
    pts = rng.uniform(0, [W, H], (160, 2))
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, (x, y) in enumerate(pts):
        b = int(120 + 100 * np.sin(i + t * 6))
        d.point((x, y), fill=(b, b, min(255, b + 30)))
    return img


def frame(i, globe, cloud_img, aerial, street):
    t = i / (N - 1)
    # 1) space -> zoom to Oman (0.00 - 0.50)
    z = ease(t / 0.5)
    ws = 2100 * (260 / 2100) ** z                     # visible width in source px
    cx = 1024 + (OMAN[0] - 1024) * ease((t - 0.05) / 0.45) if t > 0.05 else 1024
    cy = 1024 + (OMAN[1] - 1024) * ease((t - 0.05) / 0.45) if t > 0.05 else 1024
    hh = ws * H / W
    # globe is pasted at (1024, 1024) on the padded canvas, so source px + 1024
    box = (1024 + cx - ws / 2, 1024 + cy - hh / 2, 1024 + cx + ws / 2, 1024 + cy + hh / 2)
    img = globe.crop(tuple(int(v) for v in box)).resize((W, H), Image.LANCZOS)
    base = Image.blend(stars(t), img, 1.0) if t < 0.05 else img
    # pin on Oman once it is in view
    if t > 0.35:
        px = (OMAN[0] - (box[0] - 1024)) * W / ws
        py = (OMAN[1] - (box[1] - 1024)) * H / hh
        d = ImageDraw.Draw(base)
        a = ease((t - 0.35) / 0.1)
        r = 14 + 6 * a
        d.ellipse([px - r, py - r, px + r, py + r], outline=(255, 214, 140), width=3)
        d.ellipse([px - 4, py - 4, px + 4, py + 4], fill=(255, 214, 140))
        if t > 0.42:
            d.text((px + 24, py - 16), "Azaiba, Muscat", font=FONT, fill=(245, 239, 230))
    out = base
    # 2) clouds roll in (0.50 - 0.68)
    cl = ease((t - 0.50) / 0.10) * (1 - ease((t - 0.66) / 0.06))
    if cl > 0:
        shift = int(40 * t * 10) % W
        mask = Image.fromarray(np.roll(np.asarray(cloud_img), shift, axis=1)).convert("L")
        mask = mask.point(lambda v: int(v * min(1.0, cl * 0.95)))
        out = Image.composite(Image.new("RGB", (W, H), (236, 243, 252)), out, mask)
    # 3) aerial of the building (0.62 - 0.80), then street (0.80 - 1.0)
    a = ease((t - 0.62) / 0.12)
    if a > 0:
        ae = aerial.copy()
        scale = 1.18 - 0.18 * a
        ae = ae.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
        canvas = Image.new("RGB", (W, H), (8, 14, 11))
        canvas.paste(ae, ((W - ae.width) // 2, (H - ae.height) // 2))
        out = Image.blend(out, canvas, a)
    b = ease((t - 0.80) / 0.10)
    if b > 0:
        st = street.copy()
        scale = 1.12 - 0.12 * ease((t - 0.80) / 0.2)
        st = st.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
        canvas = Image.new("RGB", (W, H), (8, 14, 11))
        canvas.paste(st, ((W - st.width) // 2, (H - st.height) // 2))
        out = Image.blend(out, canvas, b)
    if t > 0.90:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        k = ease((t - 0.90) / 0.08)
        shade = Image.new("RGBA", (W, H), (8, 14, 11, int(170 * k)))
        out = Image.alpha_composite(out.convert("RGBA"), shade).convert("RGB")
        ld = ImageDraw.Draw(layer)
        alpha = int(255 * k)
        ld.text((48, H * 0.72), "Azaiba Gardens", font=FONT_B, fill=(242, 240, 232, alpha))
        ld.text((50, H * 0.72 + 60), "Azaiba, Muscat · Oman", font=FONT, fill=(141, 181, 128, alpha))
        out = Image.alpha_composite(out.convert("RGBA"), layer).convert("RGB")
    return np.asarray(out)


def main(out):
    globe = load_globe()
    cloud_img = clouds()
    aerial = cover(IMG / "own-courtyard-aerial.jpg")
    street = cover(IMG / "own-street.jpg")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "medium", "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(N):
        p.stdin.write(np.ascontiguousarray(frame(i, globe, cloud_img, aerial, street)).tobytes())
    p.stdin.close()
    p.wait()
    print("wrote", out, f"{SECONDS}s, {W}x{H}, {FPS}fps")


if __name__ == "__main__":
    main(sys.argv[1])
