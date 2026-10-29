---
name: food-motion
description: Make short food motion clips (camera push-in with splash or sizzle effects) from a generated or photographed still, for the customer app hero and the menu. Use when asked for animated food videos, splash or cooking motion, or a hero clip.
---

# food-motion

Produces short MP4 clips of a food still with motion added.

## Step 1: the still

Generate the still with the image model used for the app photography (`gpt-image-2.5-sunburst` through the OpenAI
SDK). Prompt for styled food photography: no text, no logos, no people, no hands, one dish per frame. Save it as PNG.

## Step 2: the motion

```
python3 .claude/skills/food-motion/scripts/animate.py <still.png> <out.mp4> --seconds 4 --droplets 120
```

The script does two things offline: a slow push-in on the still (ffmpeg `zoompan`), and procedural splash droplets
that arc outward under gravity and fade (PIL, composited by ffmpeg). It needs `ffmpeg` and Pillow.

## Limits (say these to the user)

- **No model video.** The OpenAI video API (`sora-2`) returned 404 on this account and is scheduled for shutdown, so
  there is no generated-video path. The motion is procedural.
- **The splash is a visual cue,** not liquid simulation. Droplets are white circles. Do not describe it as realistic
  cooking footage.
- **Sizzle and smoke** are not implemented. Add them as separate overlay passes if asked.
- **Illustrative only.** A generated still can differ from the dish the restaurant serves. Label the clip, and
  replace it with footage of the real dish before launch.

## Check before delivering

1. Extract a frame from the middle (`ffmpeg -ss 1 -i clip.mp4 -frames:v 1 frame.png`) and look at it.
2. Confirm the duration with `ffprobe`.
3. Keep clips under about 8 MB for the app.
