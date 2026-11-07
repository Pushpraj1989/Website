#!/usr/bin/env bash
# Renders every sector film in both sizes into out/, then makes post-ready copies (yuv420p, fast start).
set -euo pipefail
cd "$(dirname "$0")"
B=()
for b in /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell; do [ -x "$b" ] && B=(--browser-executable="$b"); done
mkdir -p out
for id in ${IDS:-salon pharmacy}; do for size in wide feed; do
  npx remotion render "$id-$size" "out/$id-$size.mp4" "${B[@]}" --log=error
  ffmpeg -v error -y -i "out/$id-$size.mp4" -vf "scale=in_range=full:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 18 -profile:v high -movflags +faststart -an "out/$id-$size-linkedin.mp4"
  echo "done $id-$size"
done; done
