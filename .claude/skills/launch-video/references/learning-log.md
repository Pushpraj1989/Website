# Learning from new reference videos

The skill gets better each time the user sends a video (or a storyboard package) "to learn from". Do this every time,
in this order. The goal is a better skill, not a copy of the video.

## 1. Take the video apart
- **Frames:** `ffmpeg -i ref.mp4 -vf "select='gt(scene,0.25)'" -vsync vfr -frames:v 24 frames/%02d.png` (scene changes),
  plus `-vf fps=1/2` for a steady sampling. Make a contact sheet with `montage`. Look at every frame.
- **Timing:** note each scene's start and length (from the scene-change timestamps), total length, aspect ratio, fps.
- **Any storyboard or brief that came with it:** read it fully; it states the intent.
- If the video is on a site you can't open (login walls, LinkedIn), do not ask for the user's password. Ask for the
  file, a screen recording, or frames.

## 2. Write what it does (the grammar), not what it says
Create `references/learned/NNN-short-name.md` from `learned/TEMPLATE.md`:
structure of the arc, per-scene purpose, typography and layout rules, colour, motion vocabulary, transitions, pacing,
use of real screens, where the brand appears, what the call to action is. Describe in your own words; never record the
reference's brand, slogans, music or screenshots.

## 3. Compare with the house style
For each element ask: *is it new, better, or the same as house-style.md?*
- **Same:** note it as confirmed. (Confirmed patterns are the ones to trust most.)
- **Better:** update house-style.md and the template, say what changed and why.
- **New:** add it as a named pattern to scene-catalog.md; if it is a whole new scene type, build it (scene-catalog.md →
  "Adding a new scene type") with its words in `COPY`.
- **Conflicts:** if two references disagree, don't average them. Record both in `learned/` and make it a brief option
  (e.g. `"style": "…"`) so the user chooses per project.

## 4. Make it usable
- New scene types: implemented in `template/src/scenes/`, registered, added to `new_video.py` `SCENE_NAMES`, defaults in
  `content.ts` and regenerated `tools/defaults.json`:
  `node --experimental-strip-types --no-warnings -e "import('./template/src/content.ts').then(m=>require('fs').writeFileSync('tools/defaults.json',JSON.stringify({BRAND:m.BRAND,COPY:m.COPY,DEMO:m.DEMO,SECTORS:m.SECTORS,SCENE_PLAN:m.SCENE_PLAN},null,2)))"`
- New aspect ratios (9:16, 1:1): add a composition in `Root.tsx`, make scenes lay out for it (`usePortrait` is the 4:5 vs
  16:9 switch today), add stills to `render.sh`, mention in intake.md.
- New arcs (a different order or scene set, e.g. a feature spotlight or a customer-story arc): record them in
  `learned/` as a named **variant** with its `scenes` list and when to use it, so a brief can say `"variant": "…"`
  (until then, copy the list into the brief's `scenes`).

## 5. Prove it and log it
- Run the smoke test (render-qa.md) and look at the frames.
- Add a line to the changelog in SKILL.md (date, reference id, what changed).
- Add the reference to `learned/README.md`.
- Tell the user, briefly: what you learned, what changed in the skill, what you did *not* take.

## What not to learn
Music, a brand's identity, its exact words, its customers, its claims. And no technique that needs a bot check, a login
or someone else's private material to reproduce.
