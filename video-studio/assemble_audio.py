"""Place each narration clip at its scene's voice time, then loudness-normalise to a master track.
Reads tts/map.json (scene timing) and tts/segments.json (text and clip length) written by voiceover.py."""
import json, sys, numpy as np, soundfile as sf
from pathlib import Path
d = Path(sys.argv[1] if len(sys.argv) > 1 else "tts"); sr = 24000
m = json.loads((d / "map.json").read_text())
total = int((m[-1]["B"] + 0.3) * sr); track = np.zeros(total, np.float32)
for i, s in enumerate(m):
    y, r = sf.read(d / f"seg{i:02d}.wav", dtype="float32"); assert r == sr
    st = int(s["vo"] * sr); track[st:st + len(y)] += y[:max(0, total - st)]
sf.write(d / "vo_raw.wav", track, sr)
print("narration seconds", round(total / sr, 2))
