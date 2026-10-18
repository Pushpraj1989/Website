# Motion and interaction, 2026: what premium sites do now

Read with [craft.md](craft.md) (section 9, "living pages") and [modules.md](modules.md).
Gathered 18 Oct 2026 from web search. Confidence is noted per item: most sources are agency
and vendor blogs, and the showcase list came from search snippets, not from opening each site.
Re-check the showcase list before quoting it to a client.

## Sources

Trends (blogs and guides, directional):
- [Lovable: website design trends 2026](https://lovable.dev/it/guides/website-design-trends-2026): micro-interactions as feedback, test motion on phones, let people pause motion.
- [StudioMeyer: webdesign trends 2026](https://studiomeyer.io/en/blog/webdesign-trends-2026): kinetic type, scroll storytelling, native CSS scroll-timelines, performance, WCAG 2.2. Its engagement figures are its own project data, not verified.
- [The23eleven: web design trends 2026](https://the23eleven.com/blog/web-design-trends-2026.html): bolder type, fewer words per page, bento grids, dark mode.
- [Blacktie Digital: stylish web design](https://www.blacktiedigital.com/?p=15184): premium means immersive, but with deliberate restraint and custom type.
- [Figma: web design trends](https://www.figma.com/de-de/resource-library/webdesign-trends/): saturated colour and bold type. This conflicts with the minimal view in the other sources.

Showcases (Awwwards, from snippets, mid-October 2026; open the page before quoting):
- [Awwwards Sites of the Day](https://www.awwwards.com/websites/sites_of_the_day/): the live list. Recent names: Belgrade Arbor (Square43), OFFFForum (REF Digital), Overworld Audio, Nick Ho, Hearst Exhibit 2026 (ELLE and Esquire), Hildén & Kaira.

## What the sources agree on (high confidence)

1. **Motion answers something.** A hover confirms a button, a check animates on submit, a
   progress line shows where you are. Decoration that does not answer anything is the first thing cut.
2. **Scroll is a timeline, not a trigger.** Content that moves with scroll position (scrubbed,
   pinned, receding) feels alive. Content that only fades in once reads as a slideshow.
3. **Type carries the page.** Large display type, few words per screen, one accent word. Kinetic
   type (words that shift or split as you scroll) is common in award sites.
4. **Restraint.** One signature moment per page, not one per section.
5. **Motion must be optional.** Reduced-motion users and slow phones get the same content.
6. **Performance is part of design.** Animate transform and opacity, lazy-load media, measure on a phone.

## Techniques and where the kit stands

| Technique | Status in the kit | Notes |
| --- | --- | --- |
| Scroll-scrubbed hero recede (copy lifts, softens, fades as the hero leaves) | Added (`initHeroRecede`, core.js) | GSAP ScrollTrigger, so it works in every browser. CSS scroll-timelines were tried first and did not behave on a clipped hero (`overflow: hidden` makes the hero the scroller); see the note below. |
| Pointer spotlight on cards (a soft accent light follows the cursor) | Added (`initSpotlight`, core.js; `.spot`, core.css) | Fine pointers only, off for reduced motion. Applies to news, stat, membership and directory cards. |
| Hero load zoom and parallax | Already there (`ph-zoom`, `data-speed`) | Only on load and on scroll, so pair it with a scrub. |
| Pinned films, scrubbed video, stages | Already there | Use at most two per page (craft.md). |
| Kinetic headlines (word, line and character reveals) | Already there (`data-anim` lines, words, chars) | Reveal once. A scroll-scrubbed headline is a candidate for a future module. |
| Magnetic buttons, tilt | Already there | Desktop only. |
| Velocity marquees | Already there | Keep to one per page. |
| Bento grids | Partly (catalogue and services cards) | Use for feature pages rather than long lists. |
| Dark-mode default | Per-site choice (`theme`, `mode`) | Use for tech, nightlife and premium goods, not health or food. |
| Native CSS scroll-timelines (`animation-timeline: view()`) | Not used | Check `root` behaviour first: an `overflow: hidden` ancestor becomes the scroller and the animation stays at its start. Prefer GSAP unless it is a pure CSS effect with no clipped ancestor. |

## Living-page rules (apply to every new or rebuilt site)

- Every inner page (about, services, detail, branch, contact) has **at least two** behaviours
  beyond a one-time reveal: a scroll-linked move (hero recede, scrubbed image, sticky rail) and a
  pointer response on cards, or a second scroll-linked move.
- The home page keeps its signature moment (craft.md section 2) and gets the same two.
- Test each one at the start, middle and end of the scroll, on desktop and phone (qa-deploy.md).
- Write the choice in the plan: which moves each page has, and why.

## Checking it

- The hero should change opacity or transform between scroll 0 and one screen height. If the
  computed values stay at their start, the scroller is wrong (check `overflow` on ancestors).
- A spotlight should show a soft glow only while the pointer is over a card. Move the pointer off and it must disappear.
- With reduced motion on, no transform or opacity should change on scroll.
