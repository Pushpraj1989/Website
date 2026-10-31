---
name: launch-video
description: Make a premium product launch or promo video (about 50 seconds, 1920×1080 plus a 1080×1350 LinkedIn feed version) for any project, as code with Remotion. Takes a short input ("I need this kind of video for <project>"), reads the project, writes a storyboard and script, films the real product, uses only licensed free photos, renders and checks both sizes, and delivers MP4s, posters and a caption. Learns from reference videos the user sends and gets better each time. Use whenever someone asks for a launch video, promo video, product film, LinkedIn video, explainer reel or "a video like the Business App Kit one".
---

# Launch video

Turns **an input** into a finished launch film in the house style (references/house-style.md). The reference build
is the Business App Kit film in `food-app/promo-video/` (arc, timing and lessons: references/learned/001-business-app-kit.md).

The film is code: every word, colour, number and scene order lives in one file (`src/content.ts`), so a new project is a
brief, not a rebuild. The skill grows: every reference video the user sends is analysed and added (references/learning-log.md).

## What the person gives you

Just: *"I need this kind of video for \<project>"*, and optionally a link, repo, brand colours, a reference video, a
photo source, or a deadline. Everything else you find out or ask (references/intake.md). If they send **reference
videos to learn from**, do the learning protocol first.

## The workflow (every step, in order)

1. **Understand.** Read the project (README, docs, the running product, its repo). Draft what you know of the brief;
   ask only for what is missing (intake.md). Never invent facts, numbers, prices, customers, reviews or comparisons.
2. **Brief.** Save `briefs/<slug>.video.json` (format in intake.md). Pick the scenes that the product can really back
   up (scene-catalog.md); a shorter honest film beats a longer padded one.
3. **Script and brand.** Write the on-screen words (short, one idea a scene; the question hook, the "meet" beats, the
   promise, the steps). Use the marketing skills or a script/branding agent if available (marketing:content-creation,
   marketing:brand-review, marketing:draft-content). If the brand has no logo, run the branding pass in house-style.md and
   show the user the mark before rendering. Every claim gets its fine print (render-qa.md checklist).
4. **Storyboard first.** Scaffold, which also writes the `STORYBOARD.md` skeleton with the timing sheet:
   `python3 .claude/skills/launch-video/tools/new_video.py --brief briefs/<slug>.video.json --out <dir>`.
   Fill in the script and scene-by-scene motion spec. For a new kind of film or a loose brief, show the user the
   storyboard (and the logo) and wait for a yes before building more.
5. **Capture the real product** (capture-assets.md): run it with demo data, take every screen with
   `tools/capture.mjs`, **look at every capture**, replace the placeholders. Photos: free CC0/public-domain only, sources
   recorded; never Google-image results; paid or credit-using routes only after the user agrees.
6. **Adapt the product-specific scenes** (`Offers`, `Dashboard`, `details` data) to the product's real proof moments.
7. **Check frames:** `bash tools/render.sh <dir> --stills`; view every frame in both sizes; fix; repeat.
8. **Render:** `bash tools/render.sh <dir>` in the background (≈5 min a size), then
   `python3 tools/check_video.py <dir>/out/launch-1920x1080-linkedin.mp4` (and the feed file) and look at the contact sheet.
9. **Deliver:** send the two MP4s (SendUserFile), the posters, the caption (caption.md), the photo credits. Commit the
   source. Tell the user plainly what is in it, what is demo data, what must be true before posting (a live link), and
   anything you could not verify.

## Tools (all in `.claude/skills/launch-video/tools/`)

| Tool | Does |
| --- | --- |
| `new_video.py` | Copies the template, writes `src/content.ts` from the brief, sets colours, makes placeholders and a storyboard skeleton. |
| `capture.mjs` | Real screenshot of a running app or page (phone about 1170×2532, desktop 3200×2000). |
| `render.sh` | `--stills` for one check frame per scene in both sizes; otherwise renders both sizes, posters and the post-ready files. |
| `check_video.py` | Checks size, pixel format and fast start; makes a contact sheet. |

`template/` is the Remotion project (scenes, motion, fonts). `tools/defaults.json` is generated from
`template/src/content.ts`; regenerate it whenever that file's defaults change (command in learning-log.md).

## Rules that never bend

- **Honest.** Real product, real or clearly-demo data, claims with fine print. No fake urgency, stats or testimonials.
- **Licensed.** Free CC0/public-domain photos with recorded sources. No watermarks or stock IDs. Music only with rights.
- **Original.** A reference teaches grammar, never brand, words, music or screens.
- **Looked at.** Every capture, every check frame in both sizes, the contact sheet of the final file, and the logo with
  the user. A render that passes `check_video.py` can still be a bad film.
- **Both sizes.** 1080×1350 text ≥ 44 px, nothing cut off.
- **Privacy.** Don't ask for or accept passwords to reach a reference; ask for the file or frames. Keep personal projects'
  videos out of public repos unless the user says so.

## Growing the skill

When the user sends more videos: follow references/learning-log.md (take apart → write the grammar → compare with the
house style → make it usable → prove it and log it). Each reference becomes `references/learned/NNN-name.md`; new scene
types, aspect ratios or arcs are built into the template and listed in the catalogue.

## Changelog

- **v1 (2026-10):** from the Business App Kit film (reference 001): ten scene types, brief-driven content, both sizes,
  scaffolder, capture, render and check tools, licensing and honesty rules.
