#!/usr/bin/env bash
# Renders every sector film in both sizes into out/, then makes post-ready copies with the soundtrack (yuv420p, fast start).
# The soundtracks are original, synthesised by music/compose.py; delete public/music/<id>.m4a to make it again.
set -euo pipefail
cd "$(dirname "$0")"
B=()
for b in /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell; do [ -x "$b" ] && B=(--browser-executable="$b"); done
mkdir -p out
for id in ${IDS:-salon pharmacy}; do for size in wide feed; do
  npx remotion render "$id-$size" "out/$id-$size.mp4" "${B[@]}" --log=error
  [ -f "public/music/$id.m4a" ] || { python3 music/compose.py "$id" "out/$id.wav" && ffmpeg -v error -y -i "out/$id.wav" -af "loudnorm=I=-14:TP=-1:LRA=9" -c:a aac -b:a 192k "public/music/$id.m4a"; }
  ffmpeg -v error -y -i "out/$id-$size.mp4" -i "public/music/$id.m4a" -map 0:v -map 1:a -vf "scale=in_range=full:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 18 -profile:v high -c:a copy -shortest -movflags +faststart "out/$id-$size-linkedin.mp4"
  echo "done $id-$size"
done; done
