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

## Team video maker (studio/)

Paste a LinkedIn post on the team page, and the server writes the scenes with Claude, records the narration, renders the video and gives back an MP4.

| File | What it is |
|---|---|
| `studio/player.html` | Plays any scene list: five scene types (compare, problem, app, quote, end). |
| `studio/script_writer.py` | Sends the post to Claude and returns checked scenes. |
| `studio/pipeline.py` | Checks the script, narrates it, renders frames, muxes the MP4. Run alone: `python3 studio/pipeline.py script.json outputs/test`. |
| `studio/server.py` | Team login (PBKDF2 password hash), job queue, downloads. |
| `studio/team.html` | The team page. |

### Server setup (Ubuntu)
1. Packages and tools: `apt install -y ffmpeg python3-venv`; then in a venv `numpy soundfile kokoro-onnx playwright anthropic` and `python -m playwright install --with-deps chromium`.
2. Voice model files in `video-studio/tts/` (see Setup above).
3. Secrets in `/etc/video-studio.env` (chmod 600), never in the repo:
   ```
   VIDEO_STUDIO_PASSWORD_HASH=pbkdf2$300000$...
   ANTHROPIC_API_KEY=sk-ant-...
   VIDEO_STUDIO_COOKIE_SECURE=1
   ```
4. Run: `set -a; . /etc/video-studio.env; set +a; python3 video-studio/studio/server.py` (listens on 127.0.0.1:8090). Keep it running with a systemd service, and put nginx in front with HTTPS.

Only one video renders at a time; the rest wait in the queue. A video takes about two to four minutes on the server.

## Not in this kit
- A talking human avatar (needs a paid avatar service).
- Tokens or keys in the repo: they come from the server environment only.
