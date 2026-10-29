"""Turn one food still into a short motion clip: a slow camera push-in plus splash droplets.

Usage:
  python3 animate.py <still.png> <out.mp4> [--seconds 4] [--fps 30] [--droplets 60] [--seed 7]

Works offline: PIL draws the droplets frame by frame, ffmpeg zooms the still and composites the droplets.
Droplets start near the centre of the frame, arc outward under gravity, and fade out.
"""
import argparse
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

W, H = 1280, 720


def draw_droplets(frames_dir: str, frames: int, count: int, seed: int) -> None:
    rnd = random.Random(seed)
    drops = []
    for _ in range(count):
        angle = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05)  # upward fan
        speed = rnd.uniform(500, 1100)
        drops.append({
            "x0": W * 0.5 + rnd.uniform(-60, 60),
            "y0": H * 0.62,
            "vx": math.cos(angle) * speed,
            "vy": math.sin(angle) * speed,
            "r": rnd.uniform(7, 16),
            "delay": rnd.randint(0, frames // 3),
        })
    gravity = 1800.0
    for f in range(frames):
        t_frame = f / 30.0
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        for d in drops:
            t = t_frame - d["delay"] / 30.0
            if t < 0:
                continue
            x = d["x0"] + d["vx"] * t
            y = d["y0"] + d["vy"] * t + 0.5 * gravity * t * t
            alpha = max(0, min(255, int(255 * (1 - t / 1.6))))
            if alpha == 0 or y > H:
                continue
            r = d["r"]
            draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 246, 225, alpha))
            draw.ellipse([x - r * 0.35 - r * 0.2, y - r * 0.5, x - r * 0.1, y - r * 0.2], fill=(255, 255, 255, alpha))
        img.save(os.path.join(frames_dir, f"d{f:04d}.png"))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("still")
    p.add_argument("out")
    p.add_argument("--seconds", type=float, default=4.0)
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--droplets", type=int, default=120)
    p.add_argument("--seed", type=int, default=7)
    a = p.parse_args()

    if shutil.which("ffmpeg") is None:
        print("ffmpeg is required", file=sys.stderr)
        return 2
    frames = int(a.seconds * a.fps)
    work = tempfile.mkdtemp(prefix="food-motion-")
    try:
        base = os.path.join(work, "base.png")
        # Cover-fit the still to 16:9 first so the zoom never shows an edge.
        Image.open(a.still).convert("RGB").resize((int(W * 1.15), int(H * 1.15)), Image.LANCZOS).save(base)
        drops_dir = os.path.join(work, "drops")
        os.makedirs(drops_dir)
        draw_droplets(drops_dir, frames, a.droplets, a.seed)
        zoom = f"zoompan=z='min(1+0.10*on/{frames},1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={a.fps}"
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-framerate", str(a.fps), "-i", base,
            "-framerate", str(a.fps), "-i", os.path.join(drops_dir, "d%04d.png"),
            "-filter_complex", f"[0:v]{zoom}[bg];[bg][1:v]overlay=0:0:shortest=1,format=yuv420p[v]",
            "-map", "[v]", "-frames:v", str(frames), "-c:v", "libx264", "-crf", "18", "-preset", "medium",
            "-movflags", "+faststart", a.out,
        ]
        subprocess.run(cmd, check=True)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(f"saved {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
