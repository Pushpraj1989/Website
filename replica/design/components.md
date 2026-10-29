# Components: single-restaurant food app

Tokens: `tokens.json` (roles), `tokens.css` (variables), `tailwind.config.js` (mapping).
Every component uses the roles (`bg-surface`, `text-muted`, `border-input`), never raw colours.
Every component is tested in English (LTR) and Arabic (RTL). Icons: Lucide (MIT), mirrored in RTL
only where the direction carries meaning (back arrow, chevron, progress).

## Button
  variants  primary (accent), secondary (border, text), ghost (text only), danger (danger text on bg)
  sizes     sm 32px, md 40px, lg 48px (customer checkout uses lg, full width on phones)
  states    default, hover, pressed, focus-visible (2px ring in accent, 2px offset), disabled (50% opacity, no pointer), loading (spinner, label kept, width fixed)
  tokens    primary: bg accent, text on-accent, radius md, text sm 600
  a11y      a real <button>; loading sets aria-busy and keeps the label; disabled is not focusable
  used on   S02 add to cart, S05, S06, S07, S08, S09, A03, A04 (save)

## Stepper (quantity)
  variants  compact (inline in a line item), full (item detail)
  states    min (minus disabled), max (plus disabled with the reason shown), sold out (replaced by a label)
  tokens    radius pill, border-input, 40px touch target minimum
  a11y      role spinbutton with aria-valuemin, aria-valuemax, aria-valuenow; arrow keys change the value
  used on   S04, S05

## Option group
  variants  single choice (radio), multi choice (checkbox)
  states    selected, unselected, disabled (sold out choice shows a label), required and missing (error text under the group)
  tokens    radius md; selected uses accent border 2px and an accent check
  a11y      a fieldset with a legend; the group error is linked with aria-describedby
  used on   S04, A03

## Item card
  variants  list row (photo left, text right), grid tile (photo top)
  states    available, sold out (photo dimmed, label "Sold out" in text, add button removed), offer badge, loading (skeleton)
  tokens    bg bg, border border, radius lg, shadow card on hover only
  a11y      the whole card is one link to the item; the add button is a separate control; photos have alt text from the admin (EN and AR)
  used on   S02, S03, S11, S15

## Offer card
  variants  banner (wide, carousel on S02), row (list on S03)
  states    active, scheduled (date shown), expired (hidden from customers), member only (lock label), guest allowed
  tokens    accent badge for the offer value; text on-accent on accent
  a11y      a banner in a carousel has pause and next and previous buttons; auto-advance stops on hover, focus or reduced motion
  used on   S02, S03, A04

## Badge
  variants  offer (accent), member only (neutral), new (success), sold out (danger text)
  states    static only
  tokens    radius pill, text xs 500; colour is never the only signal (text always present)
  used on   several

## Promo field
  states    empty, filled, checking (spinner), valid (success text with the saving), invalid (danger text with the reason), minimum not met (warning text with the amount still needed), member only for a guest (sign-in prompt)
  a11y      the result is announced in a live region (polite)
  used on   S05

## Price summary
  variants  itemised (every line and the discount), total only (order cards)
  states    with discount, with VAT shown, delivery fee zero (text "Free")
  tokens    tabular numbers; the total in text lg 600; discounts in success text with a minus sign
  a11y      a definition list; the total is labelled "Total"
  used on   S05, S06, S12

## Address picker
  variants  saved list, new address with map pin
  states    pin set, pin outside the zone (warning under the map), no address yet, saved label chosen
  a11y      the map is a helper, not the only input: the text address is always available
  used on   S06, S14

## Time picker
  variants  ASAP (default), scheduled (day then slot)
  states    slot full (disabled with label), closed day (not listed), closing soon (warning text)
  a11y      radiogroup for days and slots; times are shown in the restaurant's time zone and labelled as such
  used on   S06

## Payment option
  variants  card (online), cash on delivery, pay on arrival (pickup only)
  states    selected, unavailable (with the reason: switched off by the restaurant, or above the cash limit), loading
  a11y      radio group; the reason for an unavailable option is text, not only greyed out
  used on   S06, A07

## Status timeline
  variants  delivery (placed, accepted, preparing, out for delivery, delivered), pickup (placed, accepted, preparing, ready, collected)
  states    done, current (pulsing dot off when reduced motion), pending, failed (cancelled or rejected with the reason)
  a11y      an ordered list; the current step has aria-current="step"; updates announced politely, once per step
  used on   S09, S10, S12, A02

## Order card
  variants  row (list), board card (kitchen)
  states    status chip (placed, accepted, preparing, ready, out, done, cancelled), new (sound and highlight), overdue (warning)
  a11y      the status is text in the chip, not colour alone
  used on   S11, A02

## Toast and banner
  variants  info, success, warning, error
  states    shown, auto-dismiss after 6s (not for errors), sticky (offline)
  a11y      toasts use role status (or alert for errors); keyboard can reach a close button
  used on   all

## Bottom tab bar
  variants  customer app: Menu, Offers, Cart, Orders, Account (5 tabs); RTL mirrors the order
  states    active (accent text and a 2px top line), badge count on Cart, hidden with the keyboard open
  tokens    height 64px plus the safe area inset
  a11y      a nav landmark; active tab has aria-current
  used on   customer app shell

## Admin data table
  variants  plain, with filters, with bulk actions
  states    loading (skeleton rows), empty (what to add first), error (retry), filtered to nothing
  a11y      real table with scope headers; sort buttons announce the sort direction
  used on   A03, A07, A08, A09

## Image uploader
  variants  single (dish photo), multiple (gallery)
  states    empty (drop area with a button), uploading (progress), cropped (preview), too large or wrong type (error text listing the limit)
  a11y      keyboard upload with a button; alt text in EN and AR required before publish
  used on   A03, A06

## Language switch
  variants  segmented (EN | AR), menu item
  states    active
  a11y      the switch changes the page direction (dir attribute) and the language attribute; it keeps the form state
  used on   S01, S13, admin header

## Input and form field
  variants  text, phone (country code from the restaurant's country pack, +971 for the UAE), money (amount in the restaurant's currency, decimal places from the currency table), password, OTP (6 boxes)
  states    default, focus (2px ring), filled, error (text under the field, linked with aria-describedby), disabled, read only
  tokens    border-input for the edge (3:1 checked), radius md, text base 16px (so phones do not zoom)
  a11y      a visible label (not placeholder only); OTP accepts paste and the one-time code autofill
  used on   S07, S14, A03, A04

## Modal and sheet
  variants  dialog (desktop, admin), bottom sheet (phone: options, address, cart changes)
  states    open, closing, with an error inside
  a11y      focus moves in, returns to the trigger on close, Escape closes (not on the sheet's drag only); the background is inert
  used on   S04 (options on small screens), S06, A04 (confirm publish)
