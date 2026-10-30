# QA and deploy

## Automated

```
python3 build/build.py                 # all sites, hub, VERIFY.md
python3 tools/qa.py <slug> [<slug>…]    # every page at 1440x900 and 390x844 + reduced motion
python3 tools/qa.py <slug> --shots      # also screenshots of the home page into qa-shots/
```
qa.py fails on JS/console errors, missing local files, sideways scroll, broken images,
content that stays hidden while on screen, anything hidden with reduced motion, and a menu
button that is covered or off-screen after scrolling down on a phone.
WebGL needs a real web server (qa.py starts one); file:// pages fall back to CSS crossfades.

## Navigation and overlays (the mistakes that shipped before)

- **Hidden header on phones:** a header that slides away when scrolling down makes the menu
  unreachable until the visitor scrolls to the top. Never hide the header below 961px. On wide
  screens, hide only while scrolling down and show again on any scroll up.
- **Menu behind the page:** the header's backdrop blur makes it the box a full-screen menu is
  sized to (the menu shrinks to the header's height and the page shows through). Turn the blur
  off while the menu is open. Give the menu a solid background and the header a z-index above
  every page layer (check: `grep -rhoE "z-index: *[0-9]+" shared/css build/templates`).
- **Splash or intro film over the site:** a film that waits for a tap must give up after a time
  limit (9 seconds here). A blocked autoplay must never leave the whole page covered.
- **Test it:** `tools/qa.py` on phones scrolls to 1400px, then checks that the menu button is the
  element at its own centre point. A failure names what covers it.

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

## Living pages

- On one inner page, scroll 0 to one screen: the sub-page hero copy's opacity must drop below 1
  (`getComputedStyle(.ph-inner).opacity`). If it stays at 1, the scroll effect is not running.
- Hover a news or membership card on a fine pointer: the spotlight (`.spot::before`) shows and
  follows the cursor. Off the card it hides. Reduced motion: no scroll or pointer motion at all.
- Each inner page has at least two moves beyond the reveal (craft.md section 9).

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
- Sites with a `shop`: `install.sh` also installs the order service (systemd `tier1-shop`, nginx
  `/api/`) and creates `/etc/tier1-shop.env` once. The owner adds gateway keys there themselves
  (`nano /etc/tier1-shop.env && systemctl restart tier1-shop`); never ask for keys in chat.
  Test the whole order flow before sending the link (commerce.md, "Test locally").
