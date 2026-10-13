#!/usr/bin/env python3
"""Turn a checked script into an MP4 with a narrated voiceover.

  python3 studio/pipeline.py path/to/script.json outputs/<job-id>

Stages: validate -> narrate (Kokoro, local) -> place clips on the timeline -> render frames
(Chromium, frame-accurate, 30 fps) -> mux with loudness-normalised narration (ffmpeg).
Nothing here talks to the network; the script itself comes from script_writer.py.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # video-studio/
TTS_DIR = Path(os.environ.get("VIDEO_STUDIO_TTS", ROOT / "tts"))
FPS = 30
SCENE_TYPES = {"compare", "problem", "app", "quote", "end"}
REQUIRED = {  # keys each scene type needs in its data
    "compare": ["left", "right"],
    "problem": ["pages"],
    "app": ["rule", "playbook_name", "rule_code"],
    "quote": ["text"],
    "end": ["text", "question", "cta"],
}
LIMITS = {"narration": (20, 420), "caption": (4, 130), "rule": (4, 220), "text": (4, 170), "question": (4, 150)}
TAG = re.compile(r"</?em>")


class ScriptError(ValueError):
    pass


def _text(value, field, lo, hi):
    if not isinstance(value, str):
        raise ScriptError(f"{field} must be text")
    # only <em> is allowed inside text: it colours a word; everything else is stripped
    parts = re.split(r"(</?em>)", value)
    cleaned = "".join(p if TAG.fullmatch(p) else re.sub(r"<[^>]*>", "", p) for p in parts)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not lo <= len(re.sub(r"</?em>", "", cleaned)) <= hi:
        raise ScriptError(f"{field} must be {lo}-{hi} characters")
    return cleaned


def validate(script):
    """Return a cleaned copy of the script, or raise ScriptError with a readable reason."""
    if not isinstance(script, dict) or not isinstance(script.get("scenes"), list):
        raise ScriptError("the script needs a list of scenes")
    scenes = script["scenes"]
    if not 3 <= len(scenes) <= 8:
        raise ScriptError("a video needs 3 to 8 scenes")
    out = []
    for i, sc in enumerate(scenes, 1):
        if not isinstance(sc, dict) or sc.get("type") not in SCENE_TYPES:
            raise ScriptError(f"scene {i}: type must be one of {sorted(SCENE_TYPES)}")
        data = sc.get("data") or {}
        for key in REQUIRED[sc["type"]]:
            if key not in data:
                raise ScriptError(f"scene {i} ({sc['type']}): missing {key}")
        clean_data = {}
        for key, value in data.items():
            if isinstance(value, dict):
                clean_data[key] = {k: _text(v, f"scene {i} {key}.{k}", 1, 170) for k, v in value.items()}
            elif key in LIMITS:
                clean_data[key] = _text(value, f"scene {i} {key}", *LIMITS[key])
            elif key == "pages":
                clean_data[key] = str(int(value))
            else:
                clean_data[key] = _text(str(value), f"scene {i} {key}", 1, 120)
        if sc["type"] == "problem" and not 1 <= int(clean_data["pages"]) <= 200:
            raise ScriptError(f"scene {i}: pages must be 1-200")
        narration = _text(sc.get("narration"), f"scene {i} narration", *LIMITS["narration"])
        caption = _text(sc.get("caption", ""), f"scene {i} caption", 0, LIMITS["caption"][1]) if sc.get("caption") else ""
        out.append({"type": sc["type"], "narration": TAG.sub("", narration), "caption": caption, "data": clean_data})
    return {"title": str(script.get("title", ""))[:120], "scenes": out}


def narrate(scenes, out_dir):
    """One Kokoro clip per scene. Returns the clip lengths in seconds."""
    import numpy as np  # noqa: F401  (kokoro needs it loaded first)
    import soundfile as sf
    from kokoro_onnx import Kokoro
    model, voices = TTS_DIR / "kokoro-v1.0.onnx", TTS_DIR / "voices-v1.0.bin"
    if not model.exists() or not voices.exists():
        raise RuntimeError(f"voice model missing in {TTS_DIR}")
    k = Kokoro(str(model), str(voices))
    lengths = []
    for i, sc in enumerate(scenes):
        samples, rate = k.create(sc["narration"], voice="af_heart", speed=1.12, lang="en-us")
        sf.write(out_dir / f"seg{i:02d}.wav", samples, rate)
        lengths.append(len(samples) / rate)
    return lengths


def plan(scenes, lengths):
    """Scene start times: each scene lasts its narration plus a short breath, at least 3 seconds."""
    t, timed = 0.0, []
    for sc, length in zip(scenes, lengths):
        dur = max(3.0, length + 0.9)
        timed.append({**sc, "start": round(t, 3), "duration": round(dur, 3), "voice_at": round(t + 0.25, 3), "voice_len": round(length, 3)})
        t += dur
    return timed, t


def write_player_script(out_dir, timed, title):
    brand = {"product": "SignVerse", "company": "Vikashan", "company_tag": "Technology"}
    data = {"BRAND": brand, "SCENES": [{k: v for k, v in s.items() if k in ("type", "caption", "data", "start", "duration")} for s in timed], "TITLE": title}
    (out_dir / "script.js").write_text("window.BRAND = " + json.dumps(brand) + ";\nwindow.SCENES = " + json.dumps(data["SCENES"], ensure_ascii=False) + ";\n", encoding="utf-8")


def mix_voice(out_dir, timed, total):
    import numpy as np
    import soundfile as sf
    sr = 24000
    track = np.zeros(int((total + 0.3) * sr), np.float32)
    for i, s in enumerate(timed):
        y, rate = sf.read(out_dir / f"seg{i:02d}.wav", dtype="float32")
        st = int(s["voice_at"] * sr)
        track[st:st + len(y)] += y[: max(0, len(track) - st)]
    sf.write(out_dir / "vo_raw.wav", track, sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out_dir / "vo_raw.wav"), "-af",
                    "highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-15:TP=-1.5:LRA=7",
                    "-ar", "48000", "-ac", "2", str(out_dir / "vo.wav")], check=True)


def render_frames(out_dir, total, progress):
    from playwright.sync_api import sync_playwright
    frames = out_dir / "frames"
    frames.mkdir(exist_ok=True)
    n = math.ceil(total * FPS)
    exe = os.environ.get("CHROMIUM")
    player = (ROOT / "studio" / "player.html").as_uri()
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        pg = br.new_page(viewport={"width": 1080, "height": 1350})
        # the player loads ./script.js; renders run one at a time, so this file is never shared
        shutil.copy(out_dir / "script.js", ROOT / "studio" / "script.js")
        pg.goto(player)
        pg.wait_for_timeout(900)
        for i in range(n):
            pg.evaluate(f"window.seek({i / FPS})")
            pg.screenshot(path=str(frames / f"{i:05d}.jpg"), type="jpeg", quality=92)
            if i % 150 == 0:
                progress("render", i / max(n, 1))
        br.close()
    return n


def encode(out_dir, total):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(out_dir / "frames" / "%05d.jpg"),
                    "-i", str(out_dir / "vo.wav"), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}", "-movflags", "+faststart",
                    str(out_dir / "video.mp4")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", str(out_dir / "video.mp4"), "-frames:v", "1",
                    "-q:v", "3", str(out_dir / "cover.jpg")], check=True)


def run(script, out_dir, progress=lambda stage, pct: None):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    clean = validate(script)
    (out_dir / "script.json").write_text(json.dumps(clean, ensure_ascii=False, indent=1), encoding="utf-8")
    progress("voice", 0.0)
    lengths = narrate(clean["scenes"], out_dir)
    timed, total = plan(clean["scenes"], lengths)
    write_player_script(out_dir, timed, clean["title"])
    mix_voice(out_dir, timed, total)
    progress("render", 0.0)
    render_frames(out_dir, total, progress)
    progress("encode", 0.0)
    encode(out_dir, total)
    # the frames are large and rebuildable from the script: keep the video, drop the rest
    shutil.rmtree(out_dir / "frames", ignore_errors=True)
    for f in out_dir.glob("seg*.wav"):
        f.unlink()
    return out_dir / "video.mp4"


if __name__ == "__main__":
    script = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    result = run(script, sys.argv[2], progress=lambda s, p: print(f"{s} {p:.0%}", flush=True))
    print("done", result)
