"""Short location animation: from space, down to Earth, pin on Azaiba (Muscat), then the building.

    python3 tools/location_zoom.py <building.jpg> <out.mp4>

Stylised globe (not a survey map). Renders frames with numpy and pipes them to ffmpeg (libx264).
"""
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, SECONDS = 1280, 720, 30, 9
N = FPS * SECONDS
LAT0, LON0 = np.radians(23.6), np.radians(58.5)      # Azaiba, Muscat
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
rng = np.random.default_rng(7)
STARS = np.column_stack([rng.uniform(0, W, 900), rng.uniform(0, H, 900), rng.uniform(0.3, 1.0, 900), rng.uniform(0, 6.28, 900)])
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
FONT_B = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 46)


def ease(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def rot_x(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def land(lat, lon):
    return (np.sin(3 * lon + 0.4) * np.cos(2.2 * lat) + np.sin(5.3 * lat + 1.3) * np.cos(4.1 * lon - 0.7)) > 0.25


def draw_space(t, img):
    # starfield with slight drift, dim vignette
    drift = t * 60
    x = (STARS[:, 0] - drift * STARS[:, 2]) % W
    tw = 0.55 + 0.45 * np.sin(STARS[:, 3] + t * 9)
    img[(STARS[:, 1]).astype(int) % H, x.astype(int)] = 255 * STARS[:, 2] * tw


def render_globe(t):
    """Globe radius and turn for progress t in [0, 1] (0 = small in space, 1 = filling the screen)."""
    img = np.zeros((H, W, 3), np.float32)
    bg = np.zeros((H, W), np.float32)
    draw_space(t, bg)
    img += bg[..., None]
    img[..., 0] += 6; img[..., 1] += 10; img[..., 2] += 26           # deep-space tint
    R = 70 * np.exp(np.log(860 / 70) * ease((t - 0.05) / 0.6))        # radius in px (planet stays in frame)
    cx, cy = W * 0.5, H * 0.5 + (1 - ease(t / 0.4)) * 120             # globe rises into frame
    s = ease((t - 0.25) / 0.4)                                        # 0 = far, 1 = Oman in front
    a = -LON0 - 0.9 * (1 - s)
    b = LAT0 * s + 0.35 * (1 - s)
    dx, dy = (xs - cx) / R, (cy - ys) / R
    r2 = dx * dx + dy * dy
    inside = r2 < 1
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    nx, ny, nz = dx, dy, z
    M = rot_y(-a) @ rot_x(-b)
    px = M[0, 0] * nx + M[0, 1] * ny + M[0, 2] * nz
    py = M[1, 0] * nx + M[1, 1] * ny + M[1, 2] * nz
    pz = M[2, 0] * nx + M[2, 1] * ny + M[2, 2] * nz
    lat, lon = np.arcsin(np.clip(py, -1, 1)), np.arctan2(px, pz)
    is_land = land(lat, lon)
    ndl = np.clip(nx * -0.5 + ny * 0.35 + nz * 0.8, 0, 1)
    ocean = np.stack([18, 62, 112], -1).astype(np.float32)
    earth = np.stack([74, 132, 80], -1).astype(np.float32)
    col = np.where(is_land[..., None], earth, ocean) * (0.25 + 0.75 * ndl[..., None])
    rim = np.clip(1 - z, 0, 1) ** 3
    col += rim[..., None] * np.array([90, 170, 255]) * 0.8
    img = np.where(inside[..., None], col, img)
    # glow around the planet
    halo = np.clip(1 - (np.sqrt(r2) - 1) * 3, 0, 1) * (~inside) * 0.35
    img += halo[..., None] * np.array([60, 130, 220])
    # pin on Oman (only when it faces the camera)
    pin = rot_x(b) @ rot_y(a) @ np.array([np.cos(LAT0) * np.sin(LON0), np.sin(LAT0), np.cos(LAT0) * np.cos(LON0)])
    return np.clip(img, 0, 255).astype(np.uint8), (cx, cy, R, pin), s


def frame(i):
    t = i / (N - 1)
    if t < 0.82:
        img, (cx, cy, R, pin), s = render_globe(min(t / 0.82, 1.0))
        pil = Image.fromarray(img)
        d = ImageDraw.Draw(pil)
        if pin[2] > 0 and s > 0.4:
            px, py = cx + R * pin[0], cy - R * pin[1]
            fade = min(1, (s - 0.4) / 0.4)
            d.ellipse([px - 16, py - 16, px + 16, py + 16], outline=(255, 214, 140), width=3)
            d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(255, 214, 140))
            if fade > 0.6:
                d.text((px + 26, py - 14), "Azaiba, Muscat", font=FONT, fill=(245, 239, 230))
        return np.asarray(pil)
    # building reveal: Ken Burns settle, then the name
    k = ease((t - 0.82) / 0.18)
    bld = Image.open(BUILDING).convert("RGB").resize((int(W * 1.12), int(H * 1.12)))
    scale = 1.12 - 0.12 * k
    w2, h2 = int(W * scale), int(H * scale)
    bld = bld.resize((w2, h2))
    canvas = Image.new("RGB", (W, H), (8, 14, 11))
    canvas.paste(bld, ((W - w2) // 2, (H - h2) // 2))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle([0, H * 0.55, W, H], fill=(8, 14, 11, 170))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shade).convert("RGB")
    d = ImageDraw.Draw(canvas)
    txt_alpha = int(255 * ease((t - 0.9) / 0.1))
    if txt_alpha > 0:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text((70, H * 0.62), "Azaiba Gardens", font=FONT_B, fill=(242, 240, 232, txt_alpha))
        ld.text((72, H * 0.62 + 66), "Azaiba, Muscat · Oman", font=FONT, fill=(141, 181, 128, txt_alpha))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), layer).convert("RGB")
    return np.asarray(canvas)


def main(building, out):
    global BUILDING
    BUILDING = building
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(N):
        p.stdin.write(np.ascontiguousarray(frame(i)).tobytes())
    p.stdin.close()
    p.wait()
    print("wrote", out, f"{SECONDS}s, {W}x{H}, {FPS}fps")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
