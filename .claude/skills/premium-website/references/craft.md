# Craft: making it feel designed, not generated

Read before planning the home page. Several ideas here are adapted from
[nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) (MIT), verified and
rewritten for this kit.

## 1. Pick a page grammar (and let it forbid things)

Two sites from this kit must not look like siblings. Choose one grammar per site and
follow its bans:

| Grammar | Shape | Leans on | Avoid |
| --- | --- | --- | --- |
| Filmic | One continuous camera move, scenes cut by scroll | scrub, depth, stages | grids of cards early on |
| Chaptered editorial | Numbered chapters, big type, image beside text | statement, split, chapters | sliders |
| Catalogue-first | Product is the hero; browse fast | catalogue, assemble, compare | long story sections |
| Service desk | Task-first: book, find, apply | rail, locations, directory, calculators | slow cinematic openers |
| Poster | Huge type, few images, bold colour blocks | statement, maximal style | photo sliders |
| Gallery | Image-led, quiet copy | split, stages, horizontal scroll | dense text |

Write down the grammar, the navigation idea, the hero device, the closing section and one
**signature move** (an interaction that exists only on this site). Compare with the sites
already in `data/`: a new site should differ on at least four of those five.

## 2. Feeling curve, one peak

Before choosing sections, write one line per section: the feeling, then what causes it
("calm: the building floats in clouds"; "pride: the construction story plays as you scroll").
- Two neighbouring sections with the same feeling: cut one.
- Name one peak (usually the signature graphic). Give it the most scroll room and a quieter
  section right before it. Three peaks means none.
- At most two scroll-scrubbed films per page; they are heavy and lose surprise.

## 3. Hero depth is the baseline

A single full-screen photo with a fade reads flat. Default to layers (the `depth` module):
sky or background, subject, foreground (clouds, mist, foliage), headline placed between planes.
Layers must move at visibly different rates. Keep the headline readable at every scroll
position, and keep contact points anchored (a building stays on its ground). Art-direct the
phone: crop, headline above the subject, shorter travel.

## 4. Typography and space floor

- Two type families at most. Tighter tracking as size grows (−0.02 to −0.03em on display).
- Body measure 45–75 characters; line height 1.5–1.75 for body, 0.9–1.05 for display.
- Body text contrast 4.5:1 minimum, also over photos (use the shade layers).
- More space above a heading than below it. Sections breathe: 4–8rem on desktop, less on phones.
- No headline wraps to more than four lines on a 390 px phone.

## 5. Colour

One accent. Secondary text is a tint of the foreground (the `--muted` token), not flat grey.
No pure black backgrounds in dark modes (#0b0b0b to #141414 range). Check the accent on
both the page background and the photo shades.

## 6. Design styles (`brand.style`)

Glass, liquid glass, neumorphism, claymorphism, skeuomorphism, brutalism, minimalism,
maximalism, bento grid, spatial UI. Match the style to the brand:
- glass or liquid: tech, premium real estate, fintech, nightlife;
- neumorph or clay: friendly apps, kids, health tech, playful food;
- skeuo: luxury goods, watches, audio, heritage;
- brutal: fashion, creative studios, streetwear;
- minimal: architecture, law, consulting, high-end real estate;
- maximal: food, entertainment, youth brands;
- bento: product-feature pages, SaaS, many-category catalogues;
- spatial: tech, automotive, launches.
One style per site; never mix.

## 7. Verify by looking

Screenshot the opening, mid-way and end states of every scroll-driven section (scrub, depth,
stages, assemble) on desktop and phone. A passing test suite does not prove the effect looks
good. If you could not check visually, say so.
