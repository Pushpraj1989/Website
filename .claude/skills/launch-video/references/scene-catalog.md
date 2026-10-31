# Scene catalogue

Scene ids for `scenes` in the brief (order is yours; `brand` early, `end` last). Frames are at 30 fps. Each scene
lays itself out for both sizes (`usePortrait()`). Words come from `COPY` in `src/content.ts`; the structure is code.

| id | Frames | Shows | Needs | Swap or adapt |
| --- | --- | --- | --- | --- |
| `hook` | 96 | The opening question, word by word, last word in the accent colour. | `copy.hook` (landscape and portrait line breaks) | Always rewrite for the product's pain. |
| `brand` | 126 | Three beats ("Meet / your *own* / product."), then the logo draws on with the name. | `copy.brandBeats`, `brand`, logo | Beats must read as one sentence. |
| `promise` | 96 | A line types in; a big number counts; a word gets an underline; a muted sub-line. | `copy.promise` | Only claims the product backs up ("0% commission" only if true). Swap the number for any single fact (24/7, 5 min). |
| `deploy` | 174 | A terminal types an install command, checks tick, a "live" card appears. | `copy.deploy` | For products with a one-command install. Otherwise drop it, or edit `Deploy` into "sign up → live". |
| `details` | 186 | A settings card (name typed, colour swatch picked by a cursor) turns into a product list. | `copy.details`, `demo.dishes` + images | Product-specific: set the demo list to the product's real kind of data. |
| `offers` | 180 | Three offer/voucher/campaign cards pop in; a "new order" toast arrives. | edit `Offers` in `scenes/Steps.tsx` | Product-specific cards: replace with the product's own proof moments (a booking, a payment, a report). |
| `dashboard` | 198 | A dashboard counts up (sales tiles, bar chart), a cursor picks a filter, the camera drops to a live list. | `demo` numbers | Use the product's real demo numbers only; edit `Dashboard` for other metrics. |
| `stores` | 174 | A headline, platform chips, two phones rising, a fine-print line. | `copy.stores`, `shots/app-home.png`, `shots/web-menu.png` | Keep the honest fine print about publishing. |
| `sectors` | 22 per item + 42 | A ring of phones along a curve; the centre one upright and large; a label names each ("Your fashion app is ready."). | `sectors` + `shots/sector-<key>.png` (one real capture each) | The curved-slider pattern: also good for "works for every X": team sizes, languages, devices. |
| `end` | 108 | Logo, name, tagline, tag pills, the link typing in. | `brand`, `copy.end` | Link must be real and live before posting. |

## Adding a new scene type
1. Look at the closest scene and copy its structure; keep everything frame-based (no timers, no CSS animation, no
   `Math.random()`: the render must be identical every time).
2. Put its words in `COPY` (content.ts), its default length in `SCENE_PLAN`, register it in `REGISTRY` (Launch.tsx), add
   it to `SCENE_NAMES` in `tools/new_video.py` and a row here.
3. Lay out both sizes; test with `render.sh --stills`; then re-run the scaffold smoke test (render-qa.md).

## Patterns worth reusing
- **Typed field + cursor click** (`details`): shows configuration as a few real actions.
- **Counting tiles + bars** (`dashboard`): proof without a claim.
- **Curved ring of phones** (`sectors`): `x = sin(a)·R, y = (1−cos a)·K, scale = 0.62 + 0.38·cos a, rotateY(−a·38°)`,
  `a = d·0.42`, fade by |a|; step every 22 frames with an ease. A wider radius in portrait.
- **Toast arrival** (`offers`): something happening live, top right, drops in.
