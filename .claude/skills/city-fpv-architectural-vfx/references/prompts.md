# Prompt templates, negative prompts and Blender plan

Provider-neutral. Paste the reference images with each prompt. Verify any tool's current
capabilities on its own site before use; this file does not confirm them.

## Shot templates

**City FPV (scene 01), 16:9, 5 s**
> Cinematic aerial flight over Muscat, Oman, following the coastal road network. Camera accelerates,
> then descends toward a coastal development. Natural motion blur, believable camera physics, warm
> late-afternoon light, subtle haze. Keep geography true to the reference map. Start: high altitude
> over the coastline. End: approach framing toward the reference building.

**Approach (scene 02), 16:9, 4 s**
> Low-altitude pass between mid-rise buildings, banking around a corner into a clear view of the
> reference building. Decelerate smoothly. Keep the building's silhouette, floor count and window
> grid identical to the reference image. Neighbouring buildings only from the reference plate.

**Assembly (scene 03), only as a generated fallback**
> Photorealistic architectural visualisation of the building in the reference image. The structure
> builds upward, starting from the foundation. Keep the exact silhouette, floor count, window grid and
> roof of the reference. Camera fixed, three-quarter view, 35 mm equivalent. Start frame: foundation.
> End frame: the reference image.

Prefer the Blender plan below for scene 03; use this template only if the team approves it.

**Gold light (scene 04)** - do not generate. Build as a shader on the facade mask:
gold `#C8A66B` additive, maximum 35% intensity, climbing spiral path, no lens flare.

**Reveal (scene 05)** - do not generate the logo. Composite the original SVG at its own proportions.

## Negative prompt (all shots)
melting architecture, extra floors, missing floors, changed floor count, warped windows, altered
roof, invented balconies, phantom people, flicker, changing neighbouring buildings, distorted
lettering, logos, text, watermarks, camera shake, excessive lens flare, oversaturated colour.

## Blender plan (structural assembly)
1. Import the approved model (GLB or FBX). Check scale in metres and the floor levels against the
   fact sheet. If there is no model, stop: do not reconstruct geometry from a photo for a real
   building without the developer's drawings.
2. Split the model into named collections: foundation, columns, slabs, facade panels, balconies,
   roof, glazing.
3. Animate each collection with a keyframed drop or rise, ordered bottom-up, with easing that stops
   at the final position. Keep the total under 7 seconds.
4. Shaders: keep the approved material colours; the gold wave is a separate emissive pass.
5. Render passes: beauty, emissive, depth, mask. Composite the gold wave and logo in compositing.
6. Export frame sequences (EXR or PNG), then encode with `tools/encode.sh`.

## Single-photo mask plan (no 3D model)
1. Make a building mask from the approved photo with `tools/cutout.py` and hand-correct it.
2. Split the mask into horizontal bands by floor line, reveal bottom-up with `stages` or a mask
   reveal.
3. Facade mask for the light wave; roof mask for the crown glow.
4. Label the result "Visualisation" and do not present it as construction progress.
