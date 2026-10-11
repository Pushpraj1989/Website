# Optional tools (verified, use when they fit)

None of these are required. Each needs the person's approval, and paid ones need their account.
Keys go in environment variables or the environment's secret settings, never in chat or in the repo.

| Tool | Use it for | Notes |
| --- | --- | --- |
| [Apify](https://apify.com) (Instagram, Google Maps, TikTok scrapers) | Content the site's pages do not carry: Instagram posts and photos, Google Maps branch details and reviews count | Paid account; token in `APIFY_TOKEN`. Respect the platform's terms; use only the company's own public posts. Save results into `research/<slug>/` like tools/scrape.py does. |
| [HyperFrames](https://github.com/heygen-com/hyperframes) (HeyGen, open source) | Turning HTML/CSS/GSAP into MP4: promo-slide videos, captioned product clips, a hero film when no footage exists | Needs Node 22+ and FFmpeg. Render, then run `tools/encode.sh` before using the clip in a `scrub` section. |
| [blader/humanizer](https://github.com/blader/humanizer) | A deeper rewrite pass for long copy | Our short version is references/copy.md. |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | Spec, plan and task discipline for big multi-site jobs | Our short version is references/plan-template.md. |
| [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) | More scroll devices and design rules | Our versions: scrub, depth, stages modules and references/craft.md. |
| Image or video generation (Figma Weave, Higgsfield, Kling, Runway…) | Hero plates, cutout layers for depth heroes, construction-sequence films | Costs money per asset: ask first. Label generated scenes "Illustrative". Never generate fake photos of real people, real staff or a real project's finished state as if it were real. |

Footage you already have is usually better: developers publish project films, renders and
construction updates; restaurants have reels; the company's own YouTube channel often has
usable clips (ask for the originals).
