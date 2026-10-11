# Plan file: `briefs/<slug>.plan.md`

Write this after step 3 (Plan) and keep it updated. It lets a fresh session, another person,
or another AI tool pick up the build where it stopped. (Spec-then-plan habit adapted from
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), MIT.)

```markdown
# <Company> website plan

## Brief
- Goal, audience, languages, motion level, style, deadline, hosting (from briefs/<slug>.json)

## Sources
- Current site: <url> (scraped <date>, research/<slug>/)
- References: <url> - what we take from it

## Direction
- Preset: <sector>   Theme: <studio|…>   Style: <glass|…>   Slider: <promo_fx>
- Grammar: <filmic|editorial|…>   Signature move: <one sentence>
- Feeling curve:
  1. <section> - <feeling> - <cause>
  2. ...
  Peak: <section>

## Sitemap
- index (sections in order)
- about, <services> (+ n pages), <catalogue> (+ n pages, compare), <locations> (+ n branch pages), news (+ n), contact

## Assets
- Photos: n from the site, n stock (credits done?), n generated (approved?)
- Films / sequences: <file> - source - encoded? (tools/encode.sh / frames.sh)

## Status
- [ ] intake  [ ] research  [ ] data  [ ] build  [ ] QA pass  [ ] visual check  [ ] deployed
- Open questions (also in data confirm): ...
- Next step: <exact command or file to edit>
```
