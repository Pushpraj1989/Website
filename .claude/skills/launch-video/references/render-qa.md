# Render, check, deliver

## Order of work
1. **Storyboard and motion spec first.** Write `STORYBOARD.md` (the scaffold makes the skeleton): scene by scene, what
   appears, when, how it moves, the script, the timing sheet. Show the user before building when the film is new or
   the brief is loose; for a repeat of a known arc with a clear brief, build and show the stills.
2. **Scaffold:** `python3 .claude/skills/launch-video/tools/new_video.py --brief briefs/<slug>.video.json --out <dir>`.
3. **Replace the placeholders** (`PLACEHOLDERS.txt`) with real captures and licensed photos.
4. **Edit scenes** that are product-specific (`Offers`, `Dashboard`, `details` data), following scene-catalog.md.
5. **Check frames:** `bash tools/render.sh <dir> --stills` writes one frame per scene for both sizes. View every one.
   Fix overflow, clipping, unreadable text, wrong data. Repeat until clean.
6. **Full render:** `bash tools/render.sh <dir>` (about 5 minutes per size). Run it in the background and wait.
7. **Check the files:** `python3 tools/check_video.py <dir>/out/launch-1920x1080-linkedin.mp4` (and the feed file);
   look at the contact sheet; scrub the end card (the link must be fully typed).
8. **Deliver:** the two MP4s, the posters, the caption (caption.md), the photo credits. Commit the source, not `out/`
   scratch files; put final MP4s in `release/` if the project keeps them.

## Gotchas we hit (and the fixes)
- **Fonts:** never let a frame draw in a fallback font. Fonts load before frame 0 (`loadFonts`).
- **Sandbox browser:** Remotion needs a headless Chrome. `render.sh` finds `/opt/pw-browsers/chromium_headless_shell-*`;
  otherwise set `BROWSER=/path/to/headless_shell`.
- **Colour range:** raw renders look washed out in some players. `finish.sh` converts to limited-range yuv420p with fast start.
- **Don't `pkill -f <word>` in a command that contains the word:** it matches (and kills) its own shell.
- **Long commands:** background them; waiting on them with `sleep` is blocked, so poll for a file or a marker line.
- **Negative sizes from springs:** an overshooting easing can make a width negative: clamp with `Math.max(0, …)`.
- **Text in the feed version:** check every scene in 1080×1350; shorten or break lines rather than shrinking below 44 px.
- **Deterministic frames:** no random, no `Date.now()`, no CSS transitions.

## The checklist (everything true before you say "done")
- [ ] Every number, name, price, photo and claim is real or clearly demo, and the fine print is on screen where needed.
- [ ] Every capture was looked at (not an offline fallback, no pop-up in the way).
- [ ] Every photo has a recorded free licence; nothing with a watermark or a stock ID.
- [ ] Both sizes: no overflow, text ≥ 44 px in the feed version, nothing cut off.
- [ ] The link on the end card is the real one, finishes typing, and works (or the user knows it will go live first).
- [ ] No other brand's logo, words, music or screens.
- [ ] `check_video.py` passes (yuv420p, fast start); the contact sheet was looked at.
- [ ] Logo shown to the user (if designed new) and OK'd.
- [ ] Source committed; `PLACEHOLDERS.txt` is empty or removed.

## Smoke test after changing the template or tools
```bash
python3 tools/new_video.py --brief <a small brief> --out <empty temp dir>
ln -s <a dir with node_modules> <temp dir>/node_modules   # or npm install
cd <temp dir> && npx tsc --noEmit && bash <skill>/tools/render.sh . --stills
```
Look at the frames. A template change that breaks a scene or a brief field must be caught here, not in a client's video.
