"""Deterministic Towers film from supplied photos (no generated footage).

Acts: site photo with push-in -> stepped reveal of the finished image floor by floor
-> gold light climbs -> logo card. Every synthetic step is labelled on screen.
Used by platform/server.py as a job step; runs in a background thread.
"""
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
GOLD = np.array([200, 166, 107], np.float32)
MIDNIGHT = np.array([8, 21, 34], np.float32)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
LABEL = "TEST  ·  client photos  ·  visualisation, not construction footage"


def cover(path):
    im = Image.open(path).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return np.asarray(im.crop((x, y, x + W, y + H))).astype(np.float32)


def logo_array(path):
    lg = Image.open(path).convert("RGB")
    side = min(lg.size)
    lg = lg.crop(((lg.width - side) // 2, (lg.height - side) // 2, (lg.width + side) // 2, (lg.height + side) // 2))
    lg = lg.resize((420, 420), Image.LANCZOS)
    mask = Image.new("L", (420, 420), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 419, 419), fill=255)
    rgba = lg.convert("RGBA")
    rgba.putalpha(mask)
    return np.asarray(rgba).astype(np.float32)


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def window(t, a, b):
    return smooth((t - a) / (b - a))


def render_film(site_img, finished_img, out_mp4, logo_png=None, progress=lambda p: None):
    site = cover(site_img)
    fin = cover(finished_img)
    logo = logo_array(logo_png) if logo_png else None
    font = ImageFont.truetype(FONT, 22)
    cap = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(cap).text((W - 40, H - 36), LABEL, font=font, fill=(245, 241, 232, 180), anchor="rs")
    cap = np.asarray(cap).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    total = 18 * FPS
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                           "-movflags", "+faststart", str(out_mp4)], stdin=subprocess.PIPE)
    for i in range(total):
        t = i / FPS
        push = 1.0 + 0.05 * window(t, 0, 6)
        ys = np.clip((yy - H * (push - 1) / 2) / push, 0, H - 1).astype(int)
        xs = np.clip((xx - W * (push - 1) / 2) / push, 0, W - 1).astype(int)
        out = site[ys, xs]
        level = math.floor(window(t, 6.0, 10.0) * 14) / 14
        out = np.where((yy >= H * (1 - level))[..., None], out, fin)
        lw = window(t, 10.0, 10.4) * (1 - window(t, 13.4, 14.0))
        if lw > 0:
            p = window(t, 10.0, 13.6)
            cy = H * (1.05 - 1.25 * p)
            cx = W * 0.5 + 360 * math.sin(p * 2 * math.pi * 1.6)
            d2 = (xx - cx) ** 2 / 1.6 + (yy - cy) ** 2
            out = out + np.exp(-d2 / (2 * 230 ** 2))[..., None] * GOLD * 0.55 * lw
        lo = window(t, 14.0, 15.2) * (1 - window(t, 17.4, 18.0))
        if lo > 0 and logo is not None:
            out = out * (1 - 0.85 * window(t, 14.0, 15.2)) + MIDNIGHT * 0.85 * window(t, 14.0, 15.2)
            s = 380
            lgr = np.asarray(Image.fromarray(logo.astype(np.uint8)).resize((s, s), Image.LANCZOS)).astype(np.float32)
            y0, x0 = int(H / 2 - s / 2), int(W / 2 - s / 2)
            a = lgr[..., 3:4] / 255 * lo
            out[y0:y0 + s, x0:x0 + s] = out[y0:y0 + s, x0:x0 + s] * (1 - a) + lgr[..., :3] * a
        ca = cap[..., 3:4] / 255 * window(t, 0.5, 1.0) * (1 - window(t, 17.6, 18.0))
        out = out * (1 - ca) + cap[..., :3] * ca
        ff.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
        if i % 60 == 0:
            progress(i / total)
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError("ffmpeg failed")
    progress(1.0)
    return out_mp4
