# Sector films (Remotion)

Promo films for Business App Kit, one per type of business, in two sizes: `<id>-wide` (1920 × 1080) and
`<id>-feed` (1080 × 1350, for the LinkedIn feed). Built on the `launch-video` skill's template.

Each film: the hook, the business's own app (real screens: offer pop-up, home, products with options, coupon in the
cart, delivery / pickup / courier, live order status, Arabic), then the back office (real console recordings: add a
product with options, stock and a photo; create a coupon; run a campaign; put a pop-up in the app; take orders live),
the dashboard, the feature list with the honest store fine print, and the end card. The salon film also shows the
appointment booking **design** (`food-app/design/booking/`), labelled as built on request.

| File | What it holds |
| --- | --- |
| `src/sectors.ts` | Everything per business: colours, words, which screens and clips, features. Add a business here. |
| `src/Film.tsx` | The scenes and their timing. |
| `public/<id>/app/` | Real app screens (390 × 844 at 3×), captured with demo data. |
| `public/<id>/console/` | Real console screenshots, and the console recordings sped up to their scene length. |
| `SOURCES.md` | Credits for the free photos inside the screens. |

Soundtracks: original upbeat jazz-funk launch music synthesised by `music/compose.py` (no samples or third-party music, so it is free to use anywhere), timed to each film's scenes, in `public/music/`.

Render: `bash render-all.sh` (or `IDS=salon bash render-all.sh`). Output in `out/`; post the `*-linkedin.mp4` files.

To add a business: set the app up as that business with demo data, capture the app screens and record the console
(same steps), put the files under `public/<id>/`, add an entry to `src/sectors.ts`, check stills, render.
