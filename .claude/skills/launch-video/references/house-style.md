# House style: how these films look and move

Learned from the Business App Kit launch film (learned/001-business-app-kit.md). Keep to this unless the user
asks otherwise; it is what makes the films read as one family. It is a premium product launch, not a slideshow.

## Look
- **Background:** a pale warm (or brand-tinted) field with two large blurred colour glows that drift all the time
  and sweep across at each scene change. Never a flat colour.
- **Type:** Inter 600–800, tracking −0.03 em; JetBrains Mono for terminals and links. Self-hosted woff2 only: never
  load a font from the web at render time.
- **One accent colour.** In every headline at most one word takes it (`*word*`). Ink for everything else.
- **Corner brand:** the small logo and name at the bottom left from the third scene on, gone on the end card.
- **Legibility:** 1080-wide feed version: body text at least 44 px, headlines 96–140 px. Check the feed frames; text
  that fits in 16:9 often overflows in 4:5.
- **Cards:** white, large radius, soft shadow, uppercase 22 px muted labels. Real UI drawn in code, with real demo data.
- **Phones:** the real app in a phone frame (1170×2532 screenshots), tilted a few degrees, with a shadow.

## Motion (src/motion.ts: use these, don't invent new curves)
- Entrances: cubic out. Moves and camera: cubic in-out. Pops: springs (damping 11–16).
- Headlines build word by word (5–8 frames apart): each word rises with a blur that clears.
- Scene change: blur out (0→14 px, 12 frames) and blur in (10→0 px, 16 frames) with the glow sweeping.
- Counters count up with tabular figures. Typed text types at 0.6–1.6 characters a frame with a caret.
- Cursor: a bezier path, a click ripple (circle scales 0→1.6 while fading over 14 frames), then the UI reacts.
- One camera move per scene: scale 1→1.04–1.06 plus a small translate. No spins, no hard zooms, no shaking.
- Hold the final state of a scene for about half a second before the next blur.

## Pacing
- 45–60 s total. Hook 3 s, brand reveal 4 s, promise 3 s, each step 5–7 s, proof 6 s, closing carousel 6–8 s, end 3–4 s.
- One idea per scene. If a scene needs more than a sentence to explain, split or cut it.
- The end card holds long enough to read the link (the link types in; it must finish typing well before the end).

## The logo (when there isn't one)
- Default is the monogram (first letter on a rounded square in the accent colours): safe for any brand.
- For a real brand, run a branding pass (the marketing:brand-review or a branding agent if available): a mark that says
  what the brand stands for, works in one colour and at favicon size, and is drawn in SVG, not a font glyph.
  Draw it in `LogoMark` (components.tsx) so it can animate in (stroke or pop), and save `logo.svg`, `logo-mark.svg`,
  an on-dark version and a 1024 px PNG in `brand/`.
- Check it on the cream background, on dark, and small (corner size). Show the user before the full render.

## Never
- Invented numbers, prices, customers, reviews, awards, or "as seen in".
- Another brand's logo, words, music or screens. A reference teaches grammar, not content.
- Moving things for the sake of it: every move shows something (a value counting, a state changing, a new card).
