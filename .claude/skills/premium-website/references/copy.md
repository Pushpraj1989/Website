# Copy pass: write like a person

Run this on every headline, intro, promo slide and FAQ answer you wrote yourself (not on
quoted company text). Adapted from the patterns in
[blader/humanizer](https://github.com/blader/humanizer) (MIT), which is built on
Wikipedia's "Signs of AI writing". For long copy, the full humanizer skill can be installed
alongside this one (`git clone https://github.com/blader/humanizer ~/.claude/skills/humanizer`).

## Cut these on sight

- **"Not X, but Y" / "It's not just X, it's Y."** State Y.
- **Dramatic one-line closers and fragments.** "Simple. Fast. Yours." Write a sentence.
- **Forced triads.** Three adjectives or three parallel clauses by reflex. Use the number of
  items that are true.
- **Inflated words:** elevate, seamless, unlock, unleash, empower, cutting-edge, world-class,
  state-of-the-art, journey, tapestry, testament, nestled, vibrant, bespoke (unless literal),
  curated, delve, leverage, holistic, synergy, game-changer, revolutionize.
- **Inflated significance:** "a pivotal moment", "redefining the landscape", "sets a new standard".
- **Sales filler:** "Discover the difference", "Experience excellence", "Your journey starts here".
- **Dashes as the universal connector.** Use a full stop or a comma.
- **Stacked qualifiers and -ing riders:** "…, ensuring a seamless experience for every guest."
- **Decorative bold** inside sentences and headings that repeat the text below them.
- **Chat residue:** "Here's", "Let's dive in", "In today's world", "Whether you're X or Y".

## Do this instead

- Say the concrete thing: the number, the place, the product, the time. "Check-ups from
  OMR 35, results the same day" beats "Comprehensive wellness solutions".
- Vary sentence length. Short ones carry weight because long ones exist.
- Use the company's own vocabulary from their site and documents.
- Headlines: 2–7 words, a real claim or a clear invitation. Intros: one or two sentences.
- Never add a fact, number, name or date that is not in the research. If a line needs a
  detail you do not have, write a simpler line.

## Check

Read every new line aloud. Search the data file for the words above
(`grep -niE "seamless|elevate|unlock|world-class|journey|curated|delve" data/<slug>.json`)
and fix what you find before the build.
