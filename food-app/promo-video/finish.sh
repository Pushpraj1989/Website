#!/usr/bin/env bash
# Makes the rendered videos ready to post: standard-range colour (yuv420p, what LinkedIn and phones expect) and
# fast start (the video begins playing before it has fully downloaded). Run after `npm run render`. Needs ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/out"
for f in launch-1920x1080 launch-1080x1350; do
  ffmpeg -v error -y -i "$f.mp4" -vf "scale=in_range=full:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 18 \
    -profile:v high -movflags +faststart -an "$f-linkedin.mp4"
  echo "out/$f-linkedin.mp4"
done
