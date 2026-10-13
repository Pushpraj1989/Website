#!/usr/bin/env bash
# Build the LinkedIn explainer end to end. Needs: python3 (numpy, soundfile, kokoro-onnx, playwright),
# ffmpeg, and the Kokoro model files (kokoro-v1.0.onnx, voices-v1.0.bin) in ./tts (not in git: 350 MB).
#   ./video-studio/make_video.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p tts && cp -n voiceover.py tts/ 2>/dev/null || true
(cd tts && python3 voiceover.py)                       # one clip per scene + segments.json
python3 assemble_audio.py tts                          # place clips on the timeline
ffmpeg -v error -y -i tts/vo_raw.wav -af "highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-15:TP=-1.5:LRA=7" -ar 48000 -ac 2 tts/vo.wav
python3 cap.py full                                    # frame-accurate capture of index.html at 30 fps
ffmpeg -v error -y -framerate 30 -i frames/%05d.jpg -i tts/vo.wav -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p -profile:v high -c:a aac -b:a 192k -shortest -movflags +faststart signverse-customer-playbooks.mp4
echo "done: video-studio/signverse-customer-playbooks.mp4"
