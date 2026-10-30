# Staging pilot: setup, daily check and full walkthrough (2026-10-30)

The pilot runs cash on delivery and pay on arrival only, with three campaigns and one partner. These scripts were run
against the test database on this machine, because there is no hosted staging here. The same scripts run on staging
unchanged. Evidence is in `pilot-walkthrough/`.

## What the pilot sets up

`food-app/web/scripts/pilot-setup.ts` runs once after migrations. If a `Pilot:` campaign already exists, it changes nothing.

| Item | Setting |
|---|---|
| Payments | Card switched off (audited). Cash on delivery and pay on arrival stay on. |
| Pilot: Welcome 10% | Shared code `WELCOME10`. 10% off, at most AED 20, on orders of AED 30 or more. Once per customer, 500 uses. Budget AED 2,000. |
| Pilot: AED 5 vouchers | AED 5 off orders of AED 25 or more. Single-use codes `PLT-####-@@`, at most 200. The "Pilot card" design (85 × 55 mm, QR) is published, and 50 vouchers are generated for printing. |
| Pilot: Free delivery | Shared code `FREEDEL`, 200 uses. Funding is shared. |
| Pilot partner | Can issue vouchers, read batch status, check a code and read its campaigns. Cannot read code lists. Limited to the AED 5 campaign, 100 codes a day and 30 requests a minute. The key is printed once by the script. |

```sh
cd food-app/web
DATABASE_URL=... VOUCHER_CODE_SECRET=... PARTNER_KEY_SECRET=... APP_ENCRYPTION_KEY=... OTP_SECRET=... \
  node --experimental-strip-types scripts/pilot-setup.ts
```

## The daily check

`scripts/daily-check.ts` does five things:
- moves campaigns along their dates
- finishes any queued batches
- prints the day's figures per campaign
- runs the four reconciliation checks
- records the run in the audit log

If any check is not zero, it exits with status 1, so the scheduler can alert. Schedule it at 06:00 Gulf time (02:00 UTC):

```cron
0 2 * * *  cd /srv/food-app/web && . /etc/food-app/env && node --experimental-strip-types scripts/daily-check.ts >> /var/log/food-app/daily-check.log 2>&1 || /usr/local/bin/alert "promotion checks not zero"
```

The output from the walkthrough database is in `pilot-walkthrough/daily-check-output.txt`. All checks were zero, with AED 15.80 of discount given.

## The walkthrough

`scripts/pilot-walkthrough.mjs` runs the customer, the partner and staff over HTTP against the running API. All 26 steps
passed (`pilot-walkthrough/walkthrough-output.txt`).

**Customer**

1. Card payment shows as off.
2. Signs up by phone.
3. Saves an address in the delivery area.
4. `welcome10` (lower case) applies.
5. The quote is AED 108.00 − AED 10.80 + AED 10.00 delivery = AED 107.20.
6. Card is refused: "Card payment is not available yet."
7. The cash order is placed at AED 107.20.
8. A second WELCOME10 is refused: "used as many times as it allows".
9. A guest under AED 30 is told to "Add 12.00 AED more".

**Partner**

1. Sees only its one campaign.
2. Issues two AED 5 vouchers.
3. Repeating the same request returns the same codes, with `Idempotent-Replayed: true`.
4. Another campaign is refused (403).
5. Reading the code list is refused.
6. A code checks as available.

**Customer uses the partner voucher**

1. Saves it to the wallet.
2. A pickup order with pay on arrival comes to AED 85.00 (AED 5 off).
3. The partner then sees the code as used.
4. Anyone else trying it is refused.

**Free delivery and staff**

1. `FREEDEL` takes the AED 10 fee off.
2. Staff sign in.
3. Staff accept the WELCOME10 order and move it through to delivered; the customer sees each step.
4. Staff cancel the FREEDEL order, which gives its use back.
5. The promotions report says the records agree.

### Screens

| Screen | File |
|---|---|
| App cart, WELCOME10 applied, live API | `pilot-walkthrough/pilot-cart.png` |
| App checkout: cash only, discount line | `pilot-walkthrough/pilot-checkout.png` |
| App wallet with the partner voucher | `pilot-walkthrough/pilot-wallet.png` |
| Printed A4 sheet, pilot card design | `pilot-walkthrough/print-page-1.png` |
| Admin: orders, campaigns, campaign detail, designs, partners, reports | `pilot-walkthrough/admin-*.png` (phone width: `*-phone.png`) |

The app screens were captured from the running pilot API by `mobile/tool/pilot_live_capture_test.dart`, not from mocked answers.

## Fixed during the walkthrough

1. **FREEDEL could not be applied from the cart.** The cart priced delivery with no address, so the fee was 0 and free delivery was refused with "This offer is for delivery orders". Delivery carts are now priced at the customer's default address. With no address, the message asks for one. A test was added.
2. **The checkout screen left out the discount line,** so subtotal plus delivery did not add up to the total. It now shows the discount.
3. **The customer's order view left out the discount.** It now includes `discountMinor`.
4. **The partner form's checkboxes were stretched full width above their labels.** They now sit inline.
5. **The pilot design's discount and terms text did not fit their boxes.** The print check refused the batch, which is the intended behaviour. The boxes were resized in the setup script.

## Still to note for staging

- Sign-up needs `OTP_SECRET`, and a real SMS/email sender. The walkthrough used `OTP_DELIVERY=outbox`, which must not be used on a public staging.
- The admin form cannot set a per-customer limit. The setup script sets it on WELCOME10 directly.
- The "Cancelled" order status shows in green on the orders board. It should be neutral.
- The production blockers in `release-gates-2026-10-29.md` still stand. This is a pilot, not a launch.
