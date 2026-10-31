#!/usr/bin/env bash
# Render a launch video project (made by new_video.py).
#   bash render.sh [project-dir] [--stills]
# --stills   render one check frame per scene, in both sizes, into out/check/ (fast: look at these before the full render)
# (default)  type-check, render both sizes and the posters, then make the files ready to post (yuv420p, fast start)
# Full renders take about 5 minutes per size; run this in the background and wait for it to finish.
set -euo pipefail
DIR="$(cd "${1:-.}" && pwd)"; MODE="${2:-full}"
cd "$DIR"
[ -d node_modules ] || npm install --no-audit --no-fund
# Remotion normally downloads its own browser. In a sandbox use the one that is installed.
BROWSER_ARG=()
if [ -n "${BROWSER:-}" ]; then BROWSER_ARG=(--browser-executable="$BROWSER");
else for b in /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell; do [ -x "$b" ] && BROWSER_ARG=(--browser-executable="$b") && break; done; fi
npx tsc --noEmit
if [ "$MODE" = "--stills" ]; then
  mkdir -p out/check
  starts=$(node --experimental-strip-types --no-warnings -e "import('./src/content.ts').then(m=>{let t=0;console.log(m.SCENE_PLAN.map(s=>{const a=t+Math.min(60,Math.floor(s.frames*0.6));t+=s.frames;return s.id+':'+a}).join(' '))})")
  for item in $starts; do id=${item%%:*}; f=${item##*:}
    npx remotion still Launch "out/check/$id-wide.png" --frame="$f" "${BROWSER_ARG[@]}" --log=error
    npx remotion still LaunchFeed "out/check/$id-feed.png" --frame="$f" "${BROWSER_ARG[@]}" --log=error
  done
  echo "Check frames in $DIR/out/check/ (look at every one, both sizes)."; exit 0
fi
npx remotion render Launch out/launch-1920x1080.mp4 "${BROWSER_ARG[@]}" --log=error
npx remotion render LaunchFeed out/launch-1080x1350.mp4 "${BROWSER_ARG[@]}" --log=error
last=$(node --experimental-strip-types --no-warnings -e "import('./src/content.ts').then(m=>console.log(m.SCENE_PLAN.reduce((n,s)=>n+s.frames,0)-18))")
npx remotion still Launch out/poster-1920x1080.png --frame="$last" "${BROWSER_ARG[@]}" --log=error
npx remotion still LaunchFeed out/poster-1080x1350.png --frame="$last" "${BROWSER_ARG[@]}" --log=error
bash finish.sh
echo "Done: $DIR/out/*-linkedin.mp4"
