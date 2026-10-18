#!/usr/bin/env python3
"""Media intake for property films: probe, crop to a target aspect, pick a poster frame.

  python3 tools/intake_media.py probe  <file>                  # JSON: size, duration, audio, verdict
  python3 tools/intake_media.py crop   <video> --aspect 16:9|9:16 --out <file.mp4>
  python3 tools/intake_media.py poster <video|image> --out <file.jpg> [--samples 40]

Crop is a centred crop (no subject tracking yet). Poster picks the sharpest of N evenly spaced
frames (variance of the Laplacian). Needs ffmpeg and ffprobe on PATH and numpy and Pillow.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MIN_SECONDS = 3.0


def ffprobe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def probe(path):
    path = Path(path)
    ext = path.suffix.lower()
    if ext in IMAGE_EXT:
        im = Image.open(path)
        w, h = im.size
        info = {"type": "image", "width": w, "height": h}
    elif ext in VIDEO_EXT:
        data = ffprobe(path)
        v = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
        if v is None:
            raise SystemExit("no video stream")
        w, h = int(v["width"]), int(v["height"])
        dur = float(data["format"].get("duration", 0))
        fps_num, fps_den = (v.get("r_frame_rate") or "0/1").split("/")
        fps = float(fps_num) / float(fps_den or 1)
        info = {"type": "video", "width": w, "height": h, "duration_s": round(dur, 2), "fps": round(fps, 2),
                "has_audio": any(s["codec_type"] == "audio" for s in data["streams"])}
    else:
        raise SystemExit(f"unsupported file type: {ext}")
    info["orientation"] = "portrait" if info["height"] > info["width"] else "landscape" if info["width"] > info["height"] else "square"
    issues = []
    if min(info["width"], info["height"]) < 720:
        issues.append("below 720 px on the short side: will look soft at 1080p")
    if info["type"] == "video" and info["duration_s"] < MIN_SECONDS:
        issues.append(f"shorter than {MIN_SECONDS:.0f} s")
    info["verdict"] = "ok" if not issues else "review"
    info["issues"] = issues
    return info


def crop(video, aspect, out):
    a, b = (int(x) for x in aspect.split(":"))
    data = ffprobe(video)
    v = next(s for s in data["streams"] if s["codec_type"] == "video")
    w, h = int(v["width"]), int(v["height"])
    if w / h > a / b:                      # too wide: trim sides
        cw, ch = round(h * a / b), h
    else:                                  # too tall: trim top and bottom
        cw, ch = w, round(w * b / a)
    cw -= cw % 2
    ch -= ch % 2
    x, y = (w - cw) // 2, (h - ch) // 2
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", f"crop={cw}:{ch}:{x}:{y}",
                    "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", str(out)], check=True)
    return {"out": str(out), "crop": [cw, ch], "offset": [x, y], "source": [w, h]}


def sharpness(gray):
    lap = (-4 * gray[1:-1, 1:-1] + gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:])
    return float(lap.var())


def poster(path, out, samples):
    path = Path(path)
    if path.suffix.lower() in IMAGE_EXT:
        Image.open(path).convert("RGB").save(out, quality=92)
        return {"out": str(out), "source": "image"}
    info = probe(path)
    dur = info["duration_s"]
    best, best_t, best_score = None, 0.0, -1.0
    for k in range(samples):
        t = dur * (k + 0.5) / samples
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1",
                              "-vf", "scale=480:-2", "-f", "image2pipe", "-vcodec", "png", "-"],
                             capture_output=True, check=True).stdout
        if not raw:
            continue
        gray = np.asarray(Image.open(__import__("io").BytesIO(raw)).convert("L")).astype(np.float32)
        score = sharpness(gray)
        if score > best_score:
            best_score, best_t = score, t
            best = raw
    if best is None:
        raise SystemExit("no frames could be read")
    Image.open(__import__("io").BytesIO(best)).convert("RGB").save(out, quality=92)
    return {"out": str(out), "time_s": round(best_t, 2), "sharpness": round(best_score, 1), "samples": samples}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("probe"); p.add_argument("file")
    c = sub.add_parser("crop"); c.add_argument("video"); c.add_argument("--aspect", required=True, choices=["16:9", "9:16"]); c.add_argument("--out", required=True)
    q = sub.add_parser("poster"); q.add_argument("file"); q.add_argument("--out", required=True); q.add_argument("--samples", type=int, default=40)
    a = ap.parse_args()
    if a.cmd == "probe":
        result = probe(a.file)
    elif a.cmd == "crop":
        result = crop(a.video, a.aspect, a.out)
    else:
        result = poster(a.file, a.out, a.samples)
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    sys.exit(main())
