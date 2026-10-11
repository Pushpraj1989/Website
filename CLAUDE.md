# Project notes for Claude

This repository is a kit for building premium, multi-page, motion-rich websites for any
company from its existing website. To build or redesign a site, follow
`.claude/skills/premium-website/SKILL.md` step by step:

1. Intake: ask the questions in `.claude/skills/premium-website/references/intake.md` first.
2. Research: `python3 tools/scrape.py <url> --slug <slug> --images`.
3. Plan with a sector preset from `presets/`.
4. Data: `python3 tools/new_site.py --slug <slug> --brief briefs/<slug>.json --scrape research/<slug>/summary.json`,
   then replace every TODO with real, sourced content (schema in `references/data-schema.md`).
5. Build and test: `ONLY=<slug> python3 build/build.py` then `python3 tools/qa.py <slug>`; look at screenshots.
6. Deliver: full build, commit, deploy (`deploy/`), share links and VERIFY.md.

Never invent facts, prices, people or reviews. Reference builds: `data/badr-al-samaa.json`,
`data/demo-coffee.json`.

Use the `premium-website` skill (`/premium-website`) for any website request.
