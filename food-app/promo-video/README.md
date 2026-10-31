# Launch video (Remotion)

The 48-second launch film for Free Restaurant Ordering, written as code: every word, number, colour and timing
can be edited and the video rendered again. The plan, timing sheet and LinkedIn caption are in
[`STORYBOARD.md`](STORYBOARD.md).

| Output | Size | Use |
| --- | --- | --- |
| `out/launch-1920x1080-linkedin.mp4` | 1920 × 1080 | YouTube, the repo page, presentations |
| `out/launch-1080x1350-linkedin.mp4` | 1080 × 1350 | The LinkedIn and Instagram feed on phones |
| `out/poster-*.png` | both sizes | Cover image (the end card) |
| `brand/` | | The logo: SVG mark, lock-ups on light and dark, and a 1024 px icon |

## Edit and render

```bash
npm install
npm run studio     # opens Remotion Studio: scrub the timeline and see edits live
npm run render     # renders both sizes and the posters into out/
npm run finish     # makes the files ready to post (standard colour range, fast start); needs ffmpeg
```

Remotion downloads its own headless browser on first render. To use one you already have, add
`--browser-executable=/path/to/chrome-headless-shell` to the commands.

## Where things are

| File | What it holds |
| --- | --- |
| `src/theme.ts` | Colours, fonts, the product name and repo link, and the demo data shown on screen (dishes, prices, monthly sales). Change these first. |
| `src/Launch.tsx` | The order of the ten scenes and the shared blur crossfade between them. |
| `src/components.tsx` | The scene start frames (`SCENE_STARTS`), the drifting glow, the animated logo, headlines, cursor, phone, cards and camera. |
| `src/motion.ts` | Easing, entrances, counters, springs, typing. |
| `src/scenes/*.tsx` | The scenes. Each lays itself out for both sizes (`usePortrait()`). |
| `public/shots/` | Real screenshots of the app and console, taken with demo data. |
| `public/dishes/` | The demo dish photos (AI-generated illustrations). |

To add music, put an audio file in `public/` and add `<Audio src={staticFile('music.mp3')} />` in `src/Launch.tsx`.
Use a track you have the rights to.

## Licences

- **Fonts:** Inter and JetBrains Mono, both SIL Open Font License; the licence files are in `public/fonts/`.
- **Remotion:** free for individuals and for companies with up to three people. Larger companies need a Remotion
  company licence (see remotion.dev/license).
