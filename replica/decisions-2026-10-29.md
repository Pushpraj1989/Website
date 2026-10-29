# Client decisions (received 2026-10-29)

These answers supersede the open questions in `client-scope-review.md` section 6. Items marked **to confirm**
are our reading of the client's words and need a yes or no.

## Payments and branches
- One merchant account for both branches.
- A customer picks the branch when ordering. Staff cannot move an order to another branch.
- Guest checkout is cash on delivery only. Card requires an account.

## Menu and orderability
- Only food items are sold in the app. Items that are not orderable (for example limited-run cakes, energy and protein
  drinks) are not shown. **To confirm:** "out of order" means hidden, not shown greyed out.

## Membership (paid subscription)
- A separate paid membership gives extra offers, discounts and free delivery. The client's reference is a
  subscription with savings totals, perks and an upgrade prompt. **To confirm:** price, billing period, and whether
  members get free delivery in every zone.

## Loyalty points
- Industry practice from public sources (see the research note below): points are earned per amount spent on
  delivery orders, shown as a balance, and redeemed as discounts. Points expire after a set period. Tiers are less
  common in food delivery than in retail.
- Decide with the client: earn rate, redemption value, expiry, and whether points come from membership or are open to all.

## Notifications and alerts
- Push notifications and SMS in the app. A sound alert on the kitchen screen for each new order.

## Reports
- Period selection (day, week, month, custom). Each report can be consolidated across branches or split per branch.

## Staff and admin
- Any number of admin users. All staff use two-factor sign-in.

## Customer location and region
- The app asks for location permission (and notification permission). Customers may open the app from any country.
- A customer outside the UAE chooses one of the served regions (Dubai, Abu Dhabi, others as configured) and can then
  order for that region. Served regions and zones come from the admin, not from code.
- Reference behaviour: a customer in Oman was offered "Use current location" and saved addresses, then asked to pick
  a location manually when no restaurant served it.

## Wording
- The app's wording is editable in the admin (English and Arabic).

## Store accounts
- Apple and Google developer accounts are owned by the client.

## Languages
- English and Arabic from version 1, with full right-to-left layouts.

## Maps and delivery zones (client decision)
1. Map provider: MapLibre with OpenStreetMap data first. The provider stays configurable (Google, Mapbox or other)
   without changing business logic.
2. Budget: target USD 0 to 25 a month in the pilot. Avoid unnecessary paid calls. Usage monitoring, spending limits
   and alerts.
3. Address pin: search an address, move the pin, confirm. Store latitude, longitude and address details.
4. Delivery zones: polygon drawing on a map (primary). Postal-code zones and radius zones are optional, designed for
   and introduced when a business needs them.
5. Several zones per business, each with its own delivery charge, minimum order, operating hours and availability.
6. Checkout checks the customer's coordinates against the zones. Postal codes are the fallback where data is reliable.
7. GeoJSON polygon boundaries; PostGIS for spatial checks. Map rendering, address search, geocoding and zone logic
   are separate modules.
8. No hardcoded map provider, country or zone method.

Priority: address pin and polygon zones first.

## Research note: loyalty practice (public sources)
- Smiles UAE: 1 point per AED 1 on card payments, including food delivery orders.
- talabat Jordan (tRewards): points on every order whatever the total; earned points valid for 60 days.
- McDonald's KSA: 1 SAR = 10 points, including app delivery orders.
- Khedmah (Oman): points on every transaction, usable against later transactions.
Sources: https://www.gulf-times.com/article/677443/qatar/talabat-rewards-launched-in-qatar ;
https://www.verdictfoodservice.com/news/talabat-jordan-launches-new-rewards ;
https://www.mcdonalds.com/sa/en-sa/jeddah/frequently-asked-questions.html ;
https://www.zawya.com/en/press-release/companies-news/khedmah-launches-innovative-loyalty-program-to-reward-its-customers-p1ya0v5j
The search did not establish tier structures or current UAE rates for talabat, Deliveroo or Noon.
