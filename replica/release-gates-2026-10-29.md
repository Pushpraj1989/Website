# Release gates: promotions and vouchers

Date: 2026-10-29. Branch: `claude/festive-fermat-mvjq25`.
Decision: **not ready for production.** Ready for a staging pilot under the conditions at the end.

## Gates that were run, and passed

Run with `food-app/web/scripts/verify.sh` (against the local test database) on the final code, after the app analysis fixes:

| Gate | Result |
| --- | --- |
| Type check (web) | Pass |
| Database suites: vouchers (12), campaigns (15), templates (11), print (11), wallet (9), checkout offers (14), partners (12), reporting (10), gates (4) | Pass, 98 tests |
| Unit tests | Pass (8) |
| End-to-end API test | Pass (42 of 42) |
| Admin build | Pass |
| App tests (Flutter) | Pass (69) |
| App analysis (Flutter) | Pass (no issues) |
| Admin smoke test (browser): 11 sections at 390 px and 1280 px | Pass: no page errors, no sideways scrolling |
| Load check, sandbox: menu and home data, 200 requests each at concurrency 10 | Pass: p95 64 ms and 31 ms, no errors |
| Dependency audit, production packages (web and admin) | Pass: no known vulnerabilities |
| Scan of committed files for credentials | Pass: only test placeholders found |
| QR codes: 300 random strings across versions 1 to 8, read by an independent decoder | Pass (sandbox check, not a repository test) |
| Printed sheets and cards: codes scanned back from the rendered PDF match the export | Pass (sandbox check) |
| Live HTTP runs: checkout with a code, partner flow, reporting and audit, wallet | Pass (sandbox checks) |

## Gates that are not met

These block a production release.

1. **No migration path for production.** Every schema change is applied by `db/migrate.mjs --reset`, which drops the schema.
   Production needs forward-only, versioned migrations, and a rehearsal on a copy of production data. Until then the
   schema cannot be changed on a live database.
2. **Card payments are not safe to launch.** A payment that succeeds after the 30-minute timeout cancels the order, and
   the money stays with the restaurant without an order. A refund path is needed. Payment failures are not reported by the
   webhook either, so unpaid orders are released only by the timeout.
3. **No background worker.** Large batches, unpaid-order timeouts, the report schedule and reservation clean-up run only
   when a request or an admin triggers them. A scheduled runner is needed.
4. **No individual staff accounts.** The admin console uses one shared password, so the audit log records every staff action as
   "staff". The audit trail cannot be relied on until each person has their own sign-in.
5. **Orders are not linked to customer accounts.** Orders belong to the guest session. A signed-in customer's orders do not
   appear under their account. The customer-table decision (`accounts` or `customers`) is still open.
6. **Required secrets must be set in production.** `VOUCHER_CODE_SECRET`, `PARTNER_KEY_SECRET`, `APP_ENCRYPTION_KEY`, and
   `OTP_SECRET` all refuse to run without them in production. Losing `APP_ENCRYPTION_KEY` makes stored codes unreadable.
7. **Not tested on devices.** The app was tested in the test environment and captured with bundled fonts. It has not been run
   on iOS or Android, with TalkBack or VoiceOver, or with Arabic on a device.
8. **Copy not reviewed.** The Arabic copy has not been reviewed by a native speaker, and the UAE regional rules are not applied yet.
9. **Print limits.** Arabic voucher text cannot be printed (the PDF uses a Latin font), and crop marks are not drawn.
10. **Admin gaps.** The console cannot find a voucher and revoke it (the endpoint exists). The Partners and Reports pages
    have been checked by the browser smoke test, but not reviewed by eye.
11. **Load was measured only in the sandbox.** The load check ran against a shared sandbox. It must be repeated on
    production-like hardware with realistic data.
12. **Item and bundle offers** are refused at checkout. They are shown as "not available yet".

## Conditions for a staging pilot

- Card payment switched off. Cash and pay-on-arrival only.
- A small set of campaigns and partners, with daily reconciliation by hand using the report's checks.
- All secrets set in the staging environment, stored in the secrets store.
- Staff reminded that the audit trail names "staff", not people, until individual accounts exist.
- Load check repeated on staging hardware before any real traffic.

## Rollback

- **The application** rolls back by deploying the previous build. The schema changes so far are additive (new tables and new
  nullable columns), so the previous build keeps working on the newer schema. Do not run `--reset` on a live database.
- **Emergency switches**, in order of how fast they act: pause the campaign (its rules switch off at once); revoke the partner
  (its keys stop working at once); cancel the campaign with a reason (recorded in the audit log).
- **Vouchers already issued** stay valid unless revoked. Revoke only vouchers that are not in use. Used vouchers cannot be revoked.

## Operating checklist for the pilot

1. Set the four secrets above in the staging environment. Confirm the server refuses to start without them.
2. Run `scripts/verify.sh` on the release commit against a fresh test database.
3. Run the admin smoke test and the load check against the staging deployment.
4. Each day: open the promotion report, and confirm the reconciliation checks show zero. Investigate any non-zero count
   before the next day's report.
5. Keep a record of each emergency switch used, with the reason.
