# Food app: the whole build

Single restaurant, English and Arabic. Four parts, all in this folder.

| part | folder | stack |
| --- | --- | --- |
| API and customer web | `web/` | Next.js 15, TypeScript, Postgres 16 with PostGIS |
| Admin console | `admin/` | React 18.3.1, Vite 5.4.11 |
| Customer app | `mobile/` | Flutter 3.47.8 (Dart 3.13) |
| Design system | `../replica/design/` | tokens.json, tokens.css |

## Put it live

On the Hostinger VPS: follow [`deploy/README.md`](deploy/README.md). One script sets up the database, HTTPS,
the service and nginx for your subdomain.

## Run it locally

```
# 1. Database (local Postgres 16 with PostGIS)
cd web && DATABASE_URL=postgres://postgres@127.0.0.1:5432/food node db/migrate.mjs --reset

# 2. API on :3100. Codes go to web/data/outbox.jsonl in development.
DATABASE_URL=postgres://postgres@127.0.0.1:5432/food ADMIN_PASSWORD='at-least-12-chars' \
  OTP_SECRET='a-long-random-string' npm run build && npm start

# 3. Admin console on :5173 (proxies /v1 and /media to :3100)
cd ../admin && npm install && npm run dev

# 4. Customer app (Linux desktop here; iOS and Android on a device)
cd ../mobile && flutter run -d linux --dart-define=API_BASE=http://localhost:3100
```

## Tests

```
cd web
npm run test:unit        # money, pricing, webhook signature, status
npm run test:accounts    # sign-up and sign-in codes, email step, sessions, admin products, images, offers (15)
npm run test:api         # full order flow over HTTP (17)
npm run test:db          # row-level security as a non-owner role (8)
npm run test:e2e         # Playwright, phone and desktop (42)

cd ../admin && npm test  # money entry and display (2)
cd ../mobile && flutter analyze && flutter test   # (28)
```

## What is built

**Sign-up and sign-in (API and app)**
- Sign-up step 1: name and mobile number. A code is sent by SMS.
- Step 2: the code is checked. A wrong code says how many tries are left. Five wrong tries lock the code.
- Step 3: email. Nothing is sent until the user taps **Verify email**; then the email code arrives.
- The code sheet slides up from the bottom and takes half the screen: six boxes, paste and SMS auto-fill,
  submit by itself at six digits, a resend countdown, and a clear error.
- Codes expire after 5 minutes and cannot be used twice. A new code waits 30 seconds. Codes are stored
  as HMACs, sessions as hashes. The token lives in the Keychain or Keystore on a phone.
- Sign-in by mobile number and code. Unknown numbers are told to create an account.
- Face ID (iPhone only) is offered once after the first sign-in and gates the app on later launches.

**Admin console (React)**
- Staff sign-in. Products: list, add, edit, show or hide, delete (a product that was ever ordered is hidden,
  not deleted). Picture upload (JPEG, PNG or WebP, up to 3 MB, checked by its first bytes), replace, remove.
- Categories: add, rename, show or hide.
- Offers: percent, fixed amount, free delivery, item free, bundle. Dates, minimum order, largest discount, code,
  usage limit, audience, on or off. Status shows as Live, Scheduled, Ended or Stopped. A used offer is stopped,
  not deleted.

**Customer app**
- Sign-up, sign-in, and the code sheet (above).
- Home built from widgets the customer chooses and orders (quick actions, cart, active order, popular dishes).
- Menu, cart, checkout, order status. English and Arabic with right-to-left layout.

## Verified here, and what is not

Verified in this environment:
- All suites above pass.
- The sign-up flow ran in the Linux app against the live API: name and mobile, SMS code, email, email code,
  home. The session survived a restart and the account was saved with its verified email.
- The admin console ran in a browser: sign-in, product list and editor, a picture upload that the menu then serves.

Not verified, and why:
- **Face ID.** It needs an iPhone with Face ID and an iOS build. Neither is available here. The code path is in place
  and unit-tested with a fake; the device behaviour is untested.
- **iOS and Android builds.** iOS needs macOS and Xcode. Android needs the SDK licences accepted, which needs your approval.
- **Real SMS and email.** Codes go to the outbox in development. In production the server refuses to send until a
  provider is configured (`OTP_DELIVERY=provider` and the provider's settings). Choose the SMS provider and the
  email provider; both need an account from you.

## Decisions for you

1. **Auth provider.** The architecture plans Supabase Auth. The app accounts above are separate (`accounts` table)
   so sign-up works now. Choose one: move to Supabase Auth (the `customers` table then links to it and `accounts`
   goes), or keep `accounts` and link orders to it.
2. **SMS and email providers**, and the sender name the customer sees.
3. **Admin access.** Today it is one shared staff password. Real staff accounts with two-factor sign-in come next.
4. **Image storage.** Pictures are on the server's disk for now (`web/storage/media`). Supabase Storage or a
   CDN bucket is the production choice.
