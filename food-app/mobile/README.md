# Sample Kitchen: customer app (Flutter)

The customer app for the single-restaurant food ordering slice. It talks to the same `/v1` API as the web
app (`food-app/web`). Screens: menu (S02), cart (S05), checkout (S06), order status (S10). English and Arabic,
with the whole layout flipping to right-to-left in Arabic.

## Run it

Start the API first (see `food-app/README.md`), then:

```
flutter run -d linux --dart-define=API_BASE=http://localhost:3100
flutter run -d android --dart-define=API_BASE=http://10.0.2.2:3100   # Android emulator reaches the host as 10.0.2.2
```

## Test

```
flutter analyze
flutter test        # money formatting, API client (cookie handling, errors, UTF-8), widget tests (menu, RTL, errors)
```

## Not done

- Card payment: the Stripe payment sheet is not wired in. Card is hidden at checkout.
- Android build: needs the Android SDK, and accepting its licences (the user decides that).
- iOS build: needs macOS and Xcode.
- Push notifications, phone sign-in, saved addresses, order history: not in the slice.
- Realtime: the order screen polls every 5 seconds, as the web app does.
- The Arabic strings are drafts for native review.

## Verified (2026-10-29)

Built and run as the Linux desktop app (Flutter 3.47.8, Dart 3.13.7) against the local API:

- `flutter analyze`: no issues. `flutter test`: 10 of 10 pass (money, API client, widget tests including Arabic RTL).
- Menu loads from the API with prices and the sold-out state; add two items; the cart totals match the server
  (AED 63.00 + AED 10.00 delivery = AED 73.00).
- Checkout: delivery with cash on delivery; card is hidden. Order placed, shows Placed with the server total.
- Staff accepted the order with a 25-minute estimate on the API; the app updated to Accepted on its own, with the estimate.
- Switched to Arabic: the layout flips to right-to-left, the timeline and totals mirror, Arabic labels show.

Not verified: Android and iOS builds (see above).
