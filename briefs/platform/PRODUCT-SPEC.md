# Creative platform: websites and cinematic videos from a brief

Status: **specification for approval.** Nothing in this document is built yet except the existing
pieces named below. Prepared 18 Oct 2026.

## 1. What the customer gets
- **Website:** give an existing website URL, or describe the inspiration (links, screenshots,
  brand words). The kit builds a bilingual premium site (`premium-website` skill, `build/build.py`).
- **Promotional video:** give photos, clips, a logo and a brief. The platform plans and generates a
  cinematic film (`city-fpv-architectural-vfx` skill) with approval gates.
- **Video types on one engine:** city FPV approach, architectural assembly, and object or food
  assembly (for example a burger built layer by layer), each with its own template and skill.
- **Entry point:** a chat box plus a short form, behind Google sign-in. Keys are entered once in a
  secure settings panel, not in chat.

## 2. What is realistic and what needs changing
- **"Our own video generation" is an orchestrator, not a new model.** It plans shots, calls provider
  APIs for generated clips, builds deterministic shots (masks, shaders, Blender), composites, and
  runs quality gates. Training a video generation model from scratch is not realistic for this team.
- **"Auto learning" means a learning loop**, not model training: store each approved brief, style
  preset, prompt and quality score; reuse the best ones for similar briefs; ask the team to rate
  outputs. This improves results without changing the provider model.
- **Customer uploads need rights checks.** People and buildings in customer photos need consent;
  generated output must not imitate a real person or developer without permission. The platform
  asks for a rights confirmation on every upload and logs it.
- **Selling to customers** needs terms of use, data handling and a review of Oman privacy and
  marketing rules. Not verified here.
- **Keys:** each customer's provider keys are encrypted at rest and used only by the job workers.
  The platform never shows a key back and never logs it. Prefer one house key per provider for
  the first version, with per-customer keys later.

## 3. Architecture (proposed)
```
Browser (UI: chat, brief form, asset upload, job list, settings for keys)
   │  Google sign-in (OAuth), session cookie
   ▼
API (Python, stdlib or FastAPI)  ──  job queue (one worker per GPU/render slot)
   │                                   │
   ├─ Planner agent (Claude)           ├─ Video providers (adapters: generated clips)
   ├─ Website agent (kit pipeline)     ├─ Deterministic renderer (Chromium + ffmpeg, kit tools)
   └─ Asset store (uploads, manifests) └─ Quality gate and approval checkpoints
```
- Reuse: `video-studio/studio/` (login, job queue, outputs), `tools/intake_media.py`, the kit's
  `build/` pipeline, `tools/qa.py`, and the four Towers skills plus `city-fpv-architectural-vfx`.
- Agents are roles, each with one skill and its own checklist: intake, planner, shot generator,
  compositor, QA, and publisher. Each writes its output to the job's manifest.

## 4. Phases
| Phase | Scope | Exit test |
| --- | --- | --- |
| P0 | This spec; decisions from section 5 | Approved |
| P1 | Local prototype: chat UI, brief form, upload with rights checkbox, job queue, planner, deterministic shots (masks, gold light, logo), exports | One Towers film renders end to end, with the disclosure labels |
| P2 | Google sign-in, encrypted key vault, per-user projects, storage limits | Two test accounts cannot see each other's jobs or keys |
| P3 | Provider adapters for generated clips, retry and cost logging, quality scores and preset memory | Same brief gives a logged cost and a score on two providers |
| P4 | Website from URL or inspiration, reusing the kit; bilingual | One customer site built from a URL, QA passes |
| P5 | Publishing, billing, terms and privacy pages, monitoring | Legal sign-off and a pilot customer |

## 5. Decisions needed before P1
1. **Hosting:** the existing server (srv1786603) or a separate one for the platform?
2. **Google sign-in:** will you create the Google Cloud OAuth client? The client ID and secret go
   into the server's environment, not into chat.
3. **Provider keys for P1:** which video provider and which account owns the key? Keys go into the
   server's environment, not into chat.
4. **First customers and terms:** who will test first, and who signs off the terms?
5. **Office address:** the Towers address I read from your screenshot is "Al Assalah Towers, 2nd
   floor 216". I couldn't confirm it online and the image is blurred. Please confirm it, or send a
   clear copy, before any route is drawn from it.

## 6. Current test status
- **Intake:** the construction photo is 1284×721 landscape; poster and probe work.
- **FPV route from the office to the site:** not built. The office address is unconfirmed, and no
  map or drone footage of the route has been provided.
- **Hybrid style:** the selected direction. It applies once the route and keyframes are approved.
