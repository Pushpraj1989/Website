# Intake: what to ask, and the brief file

Ask only what you can't find out yourself. First read the project (README, docs, the running product, its repo) and
fill in what you can; then confirm your understanding and ask for what is missing. Use AskUserQuestion when you
have it (up to 4 questions a call, with real options plus "Other"); otherwise one message with numbered questions.

## The questions

1. **The product and the promise.** Its name, and what it does for the customer in one line. The audience (who
   watches: owners, developers, customers?).
2. **The hook.** The pain the opening question names ("Still paying for…?"). If the user has no idea, propose three.
3. **Where it will be posted.** LinkedIn feed is the default: 1080×1350 (4:5) plus a 1920×1080 master. Vertical
   9:16 (Reels, Shorts, Stories) is not built yet: say so, and offer to add it (see learning-log.md).
4. **Length.** 45–60 seconds by default. Shorter is fine; each scene is 3–8 seconds.
5. **The scenes.** Offer the catalogue (scene-catalog.md) and recommend an arc. Drop scenes the product can't back up.
6. **The real product to film.** Where it runs, how to start it with demo data, and who can approve demo content.
   Never film a mock-up and call it the product.
7. **Claims.** Every number, price, comparison, "0%", "free", "in a day": where does it come from? What fine print
   does an honest version need? Write the fine print on screen where it matters.
8. **Brand.** Colour (one accent), logo (an existing file, or "design one": see house-style.md), the link to type on
   the end card, the call to action.
9. **Photos and screens.** What's available and licensed. The default is free CC0 / public-domain photos with sources
   recorded (capture-assets.md). Ask before using anything paid, such as AI image credits.
10. **Sound.** Silent by default. Music only from a track the user has the rights to.

## Reference videos

If the user sends reference videos or a storyboard package, learn from them first (learning-log.md) and say what you
took (grammar, pacing, structure) and what you did not (their brand, words, screens). The new film is original.

## The brief: `briefs/<slug>.video.json`

Everything is optional except `brand.name`; whatever you leave out uses the defaults in `tools/defaults.json`.

```json
{
  "slug": "acme-booking",
  "brand": { "name": "Acme Booking", "wordmark": ["Acme", "Booking"], "tagline": "…", "repo": "github.com/acme/booking", "logo": "monogram" },
  "colours": { "accent": "#1D4ED8", "amber": "#38BDF8", "saffron": "#BAE6FD", "cream": "#F8FBFF" },
  "copy": { "hook": { "landscape": "Still booking\nby *phone?*", "portrait": "Still booking\nby *phone?*" },
            "brandBeats": ["Meet", "your *own*", "booking *page.*"],
            "end": { "tagline": "Live in an afternoon.", "tags": ["Free", "Open source"] } },
  "demo": { "restaurant": "Demo Salon", "currency": "USD" },
  "sectors": [{ "key": "salon", "name": "salon" }, { "key": "clinic", "name": "clinic" }],
  "scenes": ["hook", "brand", "promise", "sectors", "end"],
  "frames": { "hook": 90 }
}
```

- `copy` merges section by section with `src/content.ts` (see its comments for every field). Words in `*stars*` take the accent colour.
- `colours` keys: cream, ink, muted, line, card, accent, amber, saffron, chilli, green, greenSoft (hex like `#1D4ED8`).
- `scenes` is the order; the last must be `end`. `frames` overrides a scene's length (30 fps).
- `sectors` feed the carousel scene; each needs `public/shots/sector-<key>.png`.
