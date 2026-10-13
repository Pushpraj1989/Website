import json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
VOICE = "af_heart"
# (animation window start, end, spoken line)
SEG = [
 (0.0, 1.9,  "Your procurement policy allows a maximum five percent annual price increase."),
 (1.9, 4.4,  "Your supplier's agreement says twelve percent."),
 (4.4, 9.0,  "The contract is thirty-eight pages long."),
 (9.0, 13.5, "And your procurement manager has six other agreements waiting for review."),
 (13.5, 18.3,"So that one clause gets overlooked."),
 (18.3, 23.3,"Six months later, the business discovers it has agreed to a pricing structure nobody intended to approve."),
 (23.3, 27.1,"What if your organization's own rules were part of every contract review? Meet Customer Playbooks, in SignVerse."),
 (27.1, 33.2,"First, your organization defines its contract standards. For example: no annual price increase above five percent, without explicit approval."),
 (33.2, 36.9,"When a supplier agreement is uploaded, SignVerse reviews it against your rules."),
 (36.9, 40.1,"It finds the clause, and explains the gap. Twelve percent, against your five."),
 (40.1, 43.6,"But AI doesn't decide. Your procurement team does."),
 (43.6, 46.1,"An exception, or a renegotiation. Either way, it's a deliberate decision."),
 (46.1, 52.0,"Not another chatbot that summarizes thirty-eight pages. An AI workflow that knows what your organization expects. So, what's the one clause your team checks every time?"),
]
out = []
for i, (a, b, text) in enumerate(SEG):
    samples, sr = k.create(text, voice=VOICE, speed=1.12, lang="en-us")
    sf.write(f"seg{i:02d}.wav", samples, sr)
    out.append({"a": a, "b": b, "text": text, "dur": round(len(samples) / sr, 3), "sr": sr})
    print(i, out[-1]["dur"], text[:50], flush=True)
json.dump(out, open("segments.json", "w"), indent=1)
