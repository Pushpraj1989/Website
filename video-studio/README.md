# Video studio: SignVerse LinkedIn explainer

An animated 4:5 explainer (1080×1350) with a narrated voiceover, built from HTML and rendered frame by frame.

| File | What it is |
|---|---|
| `index.html` | The scenes and animation timeline (GSAP). `window.MAP` ties each scene to its narration clip. |
| `cap.py` | Renders every frame in Chromium at 30 fps (`python3 cap.py full`) or previews chosen moments (`python3 cap.py preview 5.0 12.0`). |
| `voiceover.py` | Narration with Kokoro (open-source TTS, runs locally). One clip per scene. |
| `assemble_audio.py` | Places clips on the timeline and writes the narration track. |
| `make_video.sh` | Runs the whole pipeline and writes the MP4. |
| `fonts/`, `vt-mark.png`, `gsap.min.js` | Poppins and Raleway (SignVerse and Vikashan type), the Vikashan logo and GSAP. |

## Setup
1. Python 3 with `numpy soundfile kokoro-onnx playwright`; `ffmpeg`; Chromium at `/opt/pw-browsers/chromium` or set Playwright's path.
2. Download the Kokoro files into `video-studio/tts/`:
   `kokoro-v1.0.onnx` and `voices-v1.0.bin` from github.com/thewh1teagle/kokoro-onnx (release model-files-v1.0).
3. `./video-studio/make_video.sh`

## Changing the script
Edit the captions in `index.html` (`cap(...)`) and the narration lines in `voiceover.py` together, so they say the same thing. Then run `make_video.sh`. If the narration gets longer, the scene timing in `window.MAP` must be recomputed from `tts/segments.json`.

## Not in this kit
- A talking human avatar (needs a paid avatar service).
- Any API token. The kit makes no network calls for generation.
