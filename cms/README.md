# Azaiba Gardens content manager

Email-and-password accounts, invitation-only sign-up, password reset, optional two-step sign-in
(authenticator app), roles, validated editing, uploads, and one-click publishing of the
Azaiba Gardens website. No GitHub account is needed. Runs on a Hostinger VPS with Node.js.

## What editors can change

| Screen | What |
| --- | --- |
| Home heading and slides | the small label, title, lead text, two buttons, and the hero slides (photo or film, tag, title, text, button) |
| Buildings and rents | buildings (name, area, floors, units, status from a list, description, photo) and flats per building: type from a list; **build area** and **carpet area**, each a number with its own unit (sq m, sq yd or sq ft); **rent amount** with a currency and a rent period from lists; photo; link |
| Lists | admins maintain the dropdown values: area units, currencies with their decimal places, rent periods, flat types and building status. Editors can read them |
| Phone and WhatsApp | phone numbers; one number is marked WhatsApp and drives the WhatsApp chat button on every page |
| Media | upload photos (JPEG, PNG, WebP, up to 10 MB) and films (MP4, WebM, up to 200 MB); files are checked by their contents |
| People | administrators invite editors and administrators, reset passwords, disable or remove people |
| My account | change password; turn on the authenticator-app step |
| Activity | who signed in, what changed, when |

Sections not on this list (wording on other pages, colours, the rest of the design) stay as the
builder has them. The CMS never rewrites them.

## How numbers and money are stored

- Area is stored as a number and a unit code: `{ "build": { "value": 88.5, "unit": "sqm" }, "carpet": { "value": 75, "unit": "sqm" } }`. Either area can be left out, but not both.
- Rent is stored as an amount, a currency code and a period: `{ "amount": 375.25, "currency": "OMR", "period": "month" }`. Decimal places follow the currency (OMR allows 3, USD 2).
- Every save also writes the display text the site prints (for example "Build 88.5 sq m · Carpet 75 sq m" and "OMR 375.25"), so the public pages need no change.
- Values saved before this version are converted when the CMS reads them.

## Security

- **Accounts by invitation only.** Nobody can sign up on their own. An administrator sends an invitation; the link works once and expires in 72 hours.
- **Passwords:** at least 12 characters, not common, not containing the email name. Stored with scrypt and a per-user salt.
- **Sign-in:** the same message for an unknown email and a wrong password. Five wrong passwords lock the account for 15 minutes. Login requests are rate-limited per IP.
- **Two-step sign-in (recommended for everyone):** a 6-digit code from an authenticator app (RFC 6238).
- **Sessions:** random token, stored only as a hash; HttpOnly, SameSite=Strict, Secure cookie; 8-hour limit and 60-minute idle timeout. Changing your password signs out your other devices.
- **Forms:** every change needs a CSRF token and must come from the site's own address.
- **Uploads:** checked by file signature, not extension; size-limited; stored under a hashed name, so an upload never overwrites a site image.
- **Publishing:** each save writes a backup to `data/history/`. If the site does not build, the previous file is restored.
- **Headers:** strict Content-Security-Policy on the admin, no framing, no indexing, no caching of pages with data.
- **Activity log:** every sign-in, invitation, change and publish is recorded.

## Run it locally

```
cd cms
npm ci                                            # installs nodemailer only
CMS_COOKIE_SECURE=false CMS_PYTHON=python3 npm start
node src/cli.mjs invite you@example.com admin     # first administrator: prints a one-time link
```

Open the link, choose a name and password, then sign in at `http://127.0.0.1:8800/admin/`.
Without SMTP settings, invitation and reset emails are written to `data/outbox.log`.

## Tests

```
npm test
```

Runs the real server against a temporary copy of the data, with the site builder replaced by a
no-op, so the live site files are not touched. 15 checks cover sign-in, lockout, CSRF, validation,
uploads, path safety, roles, reset, and two-step sign-in.

## Deploy on a Hostinger VPS

Requirements: Ubuntu 22.04 or 24.04 VPS, Node.js 22.13 or newer, Python 3.10 or newer with
`jinja2` and `pillow` (the site builder), nginx, certbot.

1. **DNS:** point `example.com`, `www` and `cms` at the VPS. Use hPanel's DNS zone.
2. **Packages:**
   ```
   apt update && apt install -y nginx certbot python3-pip python3-venv
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
   python3 -m venv /srv/venv && /srv/venv/bin/pip install jinja2 pillow
   ```
3. **Code:** copy the repo to `/srv/website` (git clone, or upload). Then:
   ```
   cd /srv/website/cms && npm ci --omit=dev
   ```
4. **Service user and settings:**
   ```
   useradd --system --home /srv/website --shell /usr/sbin/nologin cms
   chown -R cms:cms /srv/website/cms/data /srv/website/data /srv/website/shared/img /srv/website/sites
   cp /srv/website/cms/.env.example /etc/azaiba-cms.env && chmod 600 /etc/azaiba-cms.env
   nano /etc/azaiba-cms.env       # set CMS_PUBLIC_URL, CMS_PYTHON=/srv/venv/bin/python, SMTP_*
   ```
5. **Service:**
   ```
   cp /srv/website/cms/deploy/azaiba-cms.service /etc/systemd/system/
   systemctl daemon-reload && systemctl enable --now azaiba-cms
   ```
6. **Build the site once and create the first administrator:**
   ```
   cd /srv/website && set -a && . /etc/azaiba-cms.env && set +a
   /srv/venv/bin/python build/build.py         # ONLY=azaiba-gardens for this site
   cd cms && sudo -u cms node src/cli.mjs invite owner@yourcompany.com admin
   ```
   Open the printed link within 72 hours, then turn on the authenticator-app step under My account.
7. **nginx and HTTPS:** edit `deploy/nginx-azaiba.conf` (domains), copy it to `/etc/nginx/sites-available/`, enable it, then:
   ```
   cp deploy/cms-proxy-headers.conf /etc/nginx/
   certbot --nginx -d example.com -d www.example.com -d cms.example.com
   nginx -t && systemctl reload nginx
   ```
8. **Check:** `https://cms.example.com/admin/` loads, sign-in works, the public site shows the change after Publish.

### Day to day

- Editors change content at `https://cms.example.com/admin/`, then press **Publish site**. Each save also publishes.
- Back up `cms/data/cms.sqlite`, `cms/data/history/`, `data/` and `shared/img/` (the repo and git history cover the JSON and images).
- To remove an editor: People → Remove. Their sessions end at once.
- Logs: `journalctl -u azaiba-cms -f`.

## WhatsApp

The phone numbers screen marks one number as WhatsApp. The site then shows a WhatsApp button on
every page, and "Chat with us" links open WhatsApp with that number. This needs no account.

Not included yet: WhatsApp Business Cloud API (sending messages from the site or receiving them into the CMS). That needs a Meta Business account and a verified number; it is a separate piece of work.

## Known limits

- One server process: the login rate limiter and sessions are in memory and in SQLite. Run one instance.
- Films are stored as uploaded. Compress them before upload (for example to 720p) to keep the site fast.
- The public site is static HTML built from `data/azaiba-gardens.json`. Each publish rebuilds it (a few seconds).
