# Resource Efficiency and Sustainable UX

## Status

W3C Web Sustainability Guidelines work is emerging/draft. Treat this module as a UX/performance pilot unless stronger applicable requirements exist.

## Why it belongs in UX

Excessive network, media, rendering, polling, motion, or AI calls can worsen loading, bandwidth cost, battery use, accessibility, low-connectivity resilience, and task continuity.

Audit:
- Largest/critical content loading and perceived responsiveness;
- unnecessary autoplay/background media;
- oversized images/video;
- repeated requests/polling;
- expensive AI calls where deterministic logic would serve better;
- loading feedback and cancellation;
- offline/retry/resume where relevant;
- motion/render effects that add cost without task value;
- low-bandwidth mode or graceful degradation where target context warrants it.

Do not claim sustainability certification from this check. Report user-facing efficiency impacts separately from environmental claims.
