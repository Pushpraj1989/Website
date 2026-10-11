#!/usr/bin/env bash
# Turn a clip into an image sequence for the canvas scrubber (smoothest on every browser).
#   tools/frames.sh in.mp4 shared/img/<slug>/seq-name [fps=24] [width=1600]
# Then in data: {"type": "scrub", "frames": {"dir": "seq-name", "count": N, "ext": "webp"}, ...}
set -euo pipefail
in="${1:?input video}"; dir="${2:?output folder}"; fps="${3:-24}"; w="${4:-1600}"
mkdir -p "$dir"; rm -f "$dir"/*.webp
ffmpeg -y -v error -i "$in" -vf "fps=$fps,scale='min($w,iw)':-2:flags=lanczos" -c:v libwebp -quality 72 -compression_level 5 "$dir/%03d.webp"
n=$(ls "$dir"/*.webp | wc -l)
echo "$n frames in $dir ($(du -sh "$dir" | cut -f1)). Use \"count\": $n"
