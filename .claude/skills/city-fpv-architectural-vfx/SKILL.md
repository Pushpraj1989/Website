---
name: city-fpv-architectural-vfx
description: Plan and produce cinematic property films for Towers Real Estate - a Muscat city FPV approach, a geometry-led architectural assembly of one approved building, a champagne-gold facade light sequence, and a logo reveal - with website, social and poster exports and human approval gates.
---
# City FPV + Architectural VFX

Turns approved property imagery, developer renders, aerial footage and optional 3D models into a
27-second cinematic film, an 8-second website hero, and a 9:16 social cut. Work in stages. Stop at
each approval gate; never start paid rendering before gate 1 and gate 2 are signed off.

## Non-negotiables
- **One building, one identity.** The building at the end of the FPV approach is the building
  assembled in the VFX sequence. Never combine unrelated developments into one project.
- **Verified identity first.** Confirm the project name, developer, location and the permission to
  reuse each source before any creative work. Record the source of every frame.
- **No invented construction.** Assembly is a visualisation of the approved geometry. Never show a
  build sequence as real progress unless dated site photos from the same position exist.
- **Disclose synthetic footage.** Every generated or stylised shot is labelled "Visualisation" on
  screen and in the film's notes. Renders are labelled "Render". Real photos are credited.
- **Do not invent facts.** No prices, floor counts, handover dates, approvals or returns that are not
  in the approved fact sheet. Missing facts stay as open questions.
- **Logo unchanged.** Composite the original Towers logo as a separate layer. Never regenerate it,
  stretch it, or let an AI video tool draw it.

## Inputs (ask for what is missing; do not guess)
| Input | Needed for | If missing |
| --- | --- | --- |
| Project name, developer, location, approval to use footage | Gate 1 | Stop |
| Approved building photo, render, or 3D model (GLB, FBX, OBJ, BIM) | Assembly | Use the single-image fallback (below) |
| City or aerial footage that is geographically true to the site | FPV approach | Use a labelled establishing still or a generated city plate |
| Towers logo (SVG preferred) | Reveal | Stop before the reveal scene |
| Target outputs and duration | Plan | Default 27 s, 16:9 + 9:16 + poster |

## Pipeline (mandatory order)
1. **Intake and identity.** Record sources, rights, project facts and open questions. Run
   `python3 tools/intake_media.py probe <file>` on each clip or photo. Output: source inventory.
2. **Reference selection.** Pick the hero building frame (sharpest, least occluded, clearest
   silhouette). Pick three keyframes: approach, hero facade, roof. Gate 1: the team approves the
   building and the three keyframes.
3. **Storyboard.** Write the timecoded shot list (see `references/storyboard-27s.md`). Gate 2: the
   team approves the storyboard and the visual style (hybrid, ultra-realistic or futuristic).
4. **Shot generation.**
   - *City FPV and atmosphere:* image-to-video from a still or a generated city plate, only with a
     connected video tool and the team's approval. Use prompts from `references/prompts.md`.
   - *Architectural assembly:* prefer approved 3D geometry in Blender (layer by layer: foundation,
     columns, slabs, facade, balconies, roof). With only a photo, use layered masks from the photo
     (`tools/cutout.py`, then hand-checked) and reveal them bottom-up.
   - *Gold light:* deterministic WebGL or compositing on the facade mask, never generated video.
5. **Compositing.** Continuity check between shots, colour grade, lens effects kept subtle, logo
   layer placed last at its original proportions.
6. **Exports.** 1920×1080 master, 1080×1920 social cut, 8-second 1280×720 website hero, poster frame
   (`tools/intake_media.py poster`), WebM and MP4.
7. **Quality gate.** Use `references/quality-report.md`. Block release on any failed critical item.

## Single-photo fallback
With one building image and no model: a 2.5D film. Camera moves are parallax and push-in on the
photo; assembly uses masks; the gold light is a shader on the facade mask; the city approach is a
labelled still or a cross-dissolve. Say in the output that the approach is not a real flight.

## Human checkpoints and cost control
- Gate 1 (identity and keyframes), Gate 2 (storyboard and style), Gate 3 (first test render),
  Gate 4 (final cut and disclosure labels). Nothing paid runs before Gate 2.
- Each generated clip gets a retry limit (default 2) and a logged cost estimate from the provider.
  Do not write price figures into the repo; quote the provider's current rates at the time.
- Keep an `asset-manifest.json` per project: source, rights, prompt, model, date, label, approver.

## Outputs for the website
- Homepage: an 8-second loop, muted, with poster, playing after the first paint.
- Property page: the full 27-second film on demand, plus a scroll-controlled assembly using the
  kit's `stages` or `scrub` modules, with reduced-motion stills.
- Performance: WebM for desktop, MP4 fallback, mobile version under 2 MB. Lazy-load everything
  below the fold.

## Files in this skill
- `references/storyboard-27s.md` - the five-scene timecoded storyboard and the 8-second hero cut.
- `references/prompts.md` - provider-neutral prompt templates, negative prompts, Blender plan.
- `references/quality-report.md` - the release checklist with pass/fail items.
- `tools/intake_media.py` (in the repo root `tools/`) - probe, auto-crop to 16:9 and 9:16, poster
  frame selection by sharpness.
