#!/usr/bin/env bash
# Encode a clip for scroll scrubbing (not playback): writes <name>.mp4 (H.264) and <name>.webm (VP9).
# Seeking walks from the previous keyframe, so normal web encodes (a keyframe every few
# seconds) feel sticky under the scroll. This uses a keyframe every few frames, strips
# audio and adds faststart. The page picks whichever format the browser plays (open-source
# Chromium and some Android browsers lack H.264). Technique credit: nateherkai/scroll-craft (MIT).
#
#   tools/encode.sh in.mp4 shared/img/<slug>/film.mp4            # desktop: 1600 wide
#   tools/encode.sh in.mp4 shared/img/<slug>/film-m.mp4 mobile   # phone: 854 wide
set -euo pipefail
in="${1:?input video}"; out="${2:?output .mp4}"; mode="${3:-desktop}"
if [ "$mode" = mobile ]; then W=854; G=6; CRF=29; VCRF=40; else W=1600; G=10; CRF=26; VCRF=36; fi
mkdir -p "$(dirname "$out")"
VF="scale='min($W,iw)':-2:flags=lanczos,fps=30,format=yuv420p"
ffmpeg -y -v error -i "$in" -an -vf "$VF" -c:v libx264 -preset slow -crf "$CRF" -g "$G" -keyint_min "$G" -sc_threshold 0 -bf 0 -movflags +faststart "$out"
ffmpeg -y -v error -i "$in" -an -vf "$VF" -c:v libvpx-vp9 -b:v 0 -crf "$VCRF" -g "$G" -row-mt 1 -deadline good -cpu-used 2 "${out%.mp4}.webm"
echo "$out $(du -h "$out" | cut -f1)  ${out%.mp4}.webm $(du -h "${out%.mp4}.webm" | cut -f1)"
