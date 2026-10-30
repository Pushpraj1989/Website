# Putting the ordering system live on the Hostinger VPS

What it sets up on your own subdomain (called `order.example.com` below; use yours):

| Address | What it is |
|---|---|
| `https://order.example.com/` | The customer website: menu, cart, checkout, order tracking |
| `https://order.example.com/v1/...` | The API the phone app talks to |
| `https://order.example.com/admin` | The order board for the kitchen |
| `https://order.example.com/console/` | The admin console: menu, offers, promotions, themes, settings |
| `https://order.example.com/app/` | The customer app in a browser (only if you build it, step 4) |

The other sites already on the server keep working. This adds one nginx file, `/etc/nginx/conf.d/food-app.conf`,
which answers only your subdomain.

## 1. Point the subdomain at the server

In the DNS settings of the domain (Hostinger: Domains → your domain → DNS / Nameservers), add:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `order` (the part before your domain) | `187.77.125.86` | 300 |

Wait until it answers. On any computer, `nslookup order.example.com` should show `187.77.125.86`. This usually
takes a few minutes and can take up to an hour. The HTTPS certificate in step 3 cannot be issued before it does.

## 2. Open a terminal on the server

Hostinger: VPS → your server → **Browser terminal** (or `ssh root@187.77.125.86` from your computer).

## 3. Run the setup

Paste these lines, with your subdomain and the email you want certificate expiry notices sent to:

```bash
cd /root
curl -fsSL -o setup.sh https://raw.githubusercontent.com/Pushpraj1989/Website/claude/festive-fermat-mvjq25/food-app/deploy/setup.sh
DOMAIN=order.example.com LE_EMAIL=you@example.com bash setup.sh
```

The setup script fetches the rest of the kit itself. It takes 5 to 15 minutes. It:

- installs PostgreSQL with PostGIS, Node.js 22, nginx and certbot;
- creates the database and a service account;
- generates every secret into `/etc/food-app.env`;
- gets the HTTPS certificate, which then renews on its own;
- builds the site and starts it.

The script ends by printing the addresses.

If it stops at the certificate, the DNS record from step 1 has not reached the server yet. Wait, then run the same
last line again. Running it again is safe.

## 4. Fill in your settings

```bash
nano /etc/food-app.env
```

Fill in:

- **`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`**: required. Customers sign up and sign in with a
  code sent to their email, so codes cannot go out until these are set.
  - For a Hostinger mailbox: host `smtp.hostinger.com`, port `465`, the full mailbox address as user and sender,
    and that mailbox's password.
  - Make the mailbox first in Hostinger → Emails.
- **`PLACES_USER_AGENT`**: needed for address search at checkout. Use a name plus a contact address, for example
  `"MyRestaurant-ordering/1.0 (orders@mydomain.com)"`.
- **`STRIPE_...`**: only for card payments. Cash orders work without them.
  - In Stripe, add a webhook to `https://order.example.com/v1/webhooks/payments/stripe`.
  - After setting these, run `update.sh` (step 6), because the publishable key is built into the website.

Save (Ctrl+O, Enter, Ctrl+X), then:

```bash
systemctl restart food-app
```

Your staff password is the `ADMIN_PASSWORD` line in the same file. Sign in at `/console/` and `/admin` with it.

**Back up `/etc/food-app.env` somewhere private.** Without `APP_ENCRYPTION_KEY`, stored assistant keys and printed
voucher codes cannot be read again.

## 5. Make it your restaurant

A new database starts with sample data. In the admin console (`/console/`), set:

- **Restaurant:** your name, logo, colours, theme, buttons, contact details, opening hours.
- **Menu:** your categories, dishes, prices and pictures.
- **Delivery zones:** where you deliver and the fees.
- **Offers and Promotions:** the pop-up, carousel, strip and hero.
- **Assistant:** paste your AI provider key here. It is stored encrypted on the server and never shown again.

## 6. Updating later

When new code is pushed to the branch:

```bash
bash /srv/food-app/repo/food-app/deploy/update.sh
```

This downloads the code, migrates the database in place (your data and uploaded pictures are kept), rebuilds and
restarts.

### The customer app in a browser (optional)

To also serve the Flutter customer app at `/app/`, add `WITH_APP=1`:

```bash
WITH_APP=1 bash /srv/food-app/repo/food-app/deploy/update.sh
```

The first run downloads the Flutter SDK (about 2 GB) and takes longer.

## The phone app

Phone builds talk to the same API. Build them with `--dart-define=API_BASE=https://order.example.com`. Release builds
refuse any address that is not HTTPS.

## When something is wrong

| Check | Command |
|---|---|
| Is it running? | `systemctl status food-app` |
| Its recent log | `journalctl -u food-app -n 100` |
| Web server config | `nginx -t` |
| Codes not arriving | The log shows `delivery_failed` with the mail server's error code. Check the SMTP lines, and that the mailbox can send. |
| Restart | `systemctl restart food-app` |
