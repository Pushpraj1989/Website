# QA and deploy

## Automated

```
python3 build/build.py                 # all sites, hub, VERIFY.md
python3 tools/qa.py <slug> [<slug>…]    # every page at 1440x900 and 390x844 + reduced motion
python3 tools/qa.py <slug> --shots      # also screenshots of the home page into qa-shots/
```
qa.py fails on JS/console errors, missing local files, sideways scroll, broken images,
content that stays hidden while on screen, and anything hidden with reduced motion.
WebGL needs a real web server (qa.py starts one); file:// pages fall back to CSS crossfades.

## Look at it (the part tools miss)

Take screenshots and actually view them, desktop and phone:
- Home: top, after the slider, mid-page, signature graphic half-way and finished, footer.
- One detail page, one product page, the locations slider and branch panel, contact.
- Every scroll-driven section (depth, scrub, stages, assemble) at its start, middle and end,
  desktop and phone. Scrubbed video must change frame with the scroll (check currentTime moves);
  test in a browser without H.264 too (the WebM twin must load).
Check: text contrast over photos; nothing overlapping (dock vs buttons, rail vs slider
controls); headings not tiny (brand fonts loaded); cards aligned; phone layout has the same
graphics (3D slider, assembly) and not a bare list; offer pop-up not covering key content.

## Content check

- No TODO left (`grep -n TODO data/<slug>.json`).
- Prices, phones, hours match the source; `confirm` lists every open question.
- Image credits complete; "Illustrative" captions on stock.

## Deploy

- Own Linux server: `./deploy/deploy.sh root@<ip>` (SSH), or on the server itself
  `git clone <repo> && bash deploy/install.sh` (adds one nginx server block for the IP and
  leaves other sites alone). Update later: `git pull && bash deploy/install.sh`.
- GitHub Pages: `.github/workflows/pages.yml` (set repository variable DEPLOY_PAGES=true).
- Any static host: upload `index.html`, `assets/`, `sites/`. All links are relative.
Send one link per site: `http://<host>/sites/<slug>/`.
