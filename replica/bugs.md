# Bugs: food app (slice)

Severity: S1 data loss, security, payments wrong, core flow blocked · S2 feature broken, no workaround ·
S3 broken with a workaround or visibly wrong · S4 cosmetic. Only reproduced bugs are listed.

| ID | sev | found by | steps | expected | actual | status (commit) |
| --- | --- | --- | --- | --- | --- | --- |
| B-01 | S1 | schema run on Postgres 16 | apply `replica/schema.sql` to an empty database | applies cleanly | fails at `geography`: PostGIS never created | fixed: `create extension postgis` added |
| B-02 | S1 | schema run, reading the guest rules | place a guest delivery order | address stored | cannot be stored: addresses referenced customers, and customers reference auth users | fixed: addresses owned by a customer or a guest session |
| B-03 | S2 | axe scan (color-contrast) on the menu | open menu with a sold-out item | text readable, 4.5:1 | sold-out row at opacity 0.6: text 2.87:1, badge 2.96:1 | fixed: opacity removed, muted text token used |
| B-04 | S1 | HTTP exit test on Postgres | place any order | 201, order placed | 500: `$5 * $6` has an untyped parameter, Postgres cannot pick the operator | fixed: explicit `::int` casts |
| B-05 | S3 | browser walkthrough (earlier session) | press the Arabic link, load pages | language stays put | flipped on each prefetch (GET set the cookie) | fixed: POST form (earlier session) |
| B-06 | S4 | Playwright console check | open menu | no console errors | 404 for the icon | fixed: `app/icon.svg` |
| B-07 | S3 | Playwright, full suite, first run | double tap Place order | one order | `dblclick` waited 30 s on a disabled button, once in three full runs | open, watched: passed on the next full run (42/42) and alone; test now waits for the button to be enabled |
| B-08 | S4 | Playwright, negative sign-in | wrong password | no console error | browser logs the expected 401 as an error | test change: allowed for that one negative case only |
| B-09 | S4 | test setup | run tests in a shell with no env | server starts | server started without DATABASE_URL and returned 500 | not a product bug: tests set env (documented) |

## Open: B-07, intermittent double tap

The Place order button is disabled until the server returns the quote. The first full run clicked before that, and
timed out once. Two later full runs (42 of 42 each) and a solo run passed. The test now waits for the button to be
enabled before the double click. Keep watching it in the next runs; if it fails again with the button enabled, it is a
product bug to trace.
