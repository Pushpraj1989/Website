---
name: tower-genesis
description: Plan and implement photorealistic tower assembly animations from supplied property images, architectural references, and optional 3D assets.
---
# Tower Genesis
When given a building image, inspect visible geometry, camera angle, floors, facade, roof, and context. Record unknowns; never assert hidden structural facts. Ask for CAD/BIM/GLB and developer-approved images when accuracy is required.

## Workflow
1. Produce asset inventory and visual geometry report.
2. Choose MODE A: cinematic generative video, MODE B: deterministic Three.js geometry, or MODE C: hybrid.
3. Create five shot stages: site grid/foundation, sequential structure assembly, facade closure, golden upward spiral lighting, camera pullback and separately composited brand logo.
4. Write detailed shot prompts, negative prompts, start/end frame specifications, camera lens and motion, continuity constraints, and duration.
5. For deterministic mode, implement React Three Fiber components with separated geometry, facade instances, lighting path, camera rig and GSAP timeline. No fake engineering details.
6. For video mode, generate a provider-neutral storyboard and asset manifest; use an actual connected video API only when available. Never pretend Claude alone renders video.
7. Produce desktop video and mobile poster/short variant, with reduced-motion fallback.
8. Check tower identity preservation, floors, window placement, no shape morphing, no fake branding, no fictional surroundings, and no misrepresentation of project completion.

## Acceptance
Visual consistency across shots, approved geometry, readable brand overlay, fast mobile fallback, clear AI-visualization disclosure when appropriate, and no unverified investment claims.
