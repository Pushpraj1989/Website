import 'dart:ui' show Color;

import 'geo.dart';
// Shapes returned by the /v1 API (food-app/web/app/v1). Parsed defensively: a missing field is a bug on the server.

class Localised {
  const Localised(this.en, this.ar);
  final String en;
  final String ar;

  factory Localised.fromJson(Map<String, dynamic> json) => Localised(json['en'] as String, json['ar'] as String);

  String of(String languageCode) => languageCode == 'ar' ? ar : en;
}

/// Where the server's media files live. The API client sets it; models turn the server's relative media paths into
/// full addresses with it.
class MediaUrls {
  const MediaUrls._();
  static String base = '';
  static String? resolve(Object? path) {
    if (path is! String || path.isEmpty) return null;
    return path.startsWith('http') ? path : '$base$path';
  }
}

/// One version of a product in a shop: a size, colour, shade or flavour, with its own price and stock.
class ItemVariant {
  const ItemVariant({required this.id, required this.name, required this.priceMinor, required this.soldOut});
  final String id;
  final Localised name;
  final int priceMinor;
  final bool soldOut;

  factory ItemVariant.fromJson(Map<String, dynamic> json) => ItemVariant(
        id: json['id'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        priceMinor: json['priceMinor'] as int,
        soldOut: (json['soldOut'] as bool?) ?? false,
      );
}

class MenuItem {
  const MenuItem({required this.id, required this.name, required this.description, required this.priceMinor, required this.soldOut, this.imageUrl, this.rating, this.variants = const []});
  final String id;
  final Localised name;
  final Localised description;
  final int priceMinor;
  final bool soldOut;
  /// The dish's own photo, uploaded by staff, or null when it has none.
  final String? imageUrl;
  /// The dish's score from rated orders, or null until it has as many ratings as the restaurant set.
  final DishRating? rating;
  /// The product's options (shops). With options, [priceMinor] is the lowest one and the customer chooses one.
  final List<ItemVariant> variants;

  factory MenuItem.fromJson(Map<String, dynamic> json) => MenuItem(
        id: json['id'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        description: Localised.fromJson(json['description'] as Map<String, dynamic>),
        priceMinor: json['priceMinor'] as int,
        soldOut: json['soldOut'] as bool,
        imageUrl: MediaUrls.resolve(json['imageUrl']),
        rating: json['rating'] is Map<String, dynamic> ? DishRating.fromJson(json['rating'] as Map<String, dynamic>) : null,
        variants: [for (final v in (json['variants'] as List<dynamic>? ?? const [])) ItemVariant.fromJson(v as Map<String, dynamic>)],
      );
}

class DishRating {
  const DishRating({required this.average, required this.count});
  final double average;
  final int count;

  factory DishRating.fromJson(Map<String, dynamic> json) => DishRating(average: (json['average'] as num).toDouble(), count: json['count'] as int);
}

class MenuCategory {
  const MenuCategory({required this.id, required this.name, required this.items, this.illustration = 'dish'});
  final String id;
  final Localised name;
  final List<MenuItem> items;
  final String illustration;

  factory MenuCategory.fromJson(Map<String, dynamic> json) => MenuCategory(
        id: json['id'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        items: (json['items'] as List<dynamic>).map((i) => MenuItem.fromJson(i as Map<String, dynamic>)).toList(),
        illustration: json['illustration'] as String? ?? 'dish',
      );
}

class PaymentOptions {
  const PaymentOptions({required this.cod, required this.payOnArrival, required this.card});
  final bool cod;
  final bool payOnArrival;
  final bool card;
}

class Menu {
  const Menu({required this.restaurant, required this.currency, required this.categories, required this.payments, this.brandJson});
  final Localised restaurant;
  /// The restaurant's brand as the server sent it; see Brand.fromJson.
  final Map<String, dynamic>? brandJson;
  final String currency;
  final List<MenuCategory> categories;
  final PaymentOptions payments;

  factory Menu.fromJson(Map<String, dynamic> json) {
    final p = json['payments'] as Map<String, dynamic>;
    return Menu(
      restaurant: Localised.fromJson(json['restaurant'] as Map<String, dynamic>),
      currency: json['currency'] as String,
      categories: (json['categories'] as List<dynamic>).map((c) => MenuCategory.fromJson(c as Map<String, dynamic>)).toList(),
      payments: PaymentOptions(cod: p['cod'] as bool, payOnArrival: p['payOnArrival'] as bool, card: p['card'] as bool),
      brandJson: json['brand'] as Map<String, dynamic>?,
    );
  }
}

class CartLine {
  const CartLine({required this.itemId, required this.qty, required this.note, required this.name, required this.unitMinor, required this.soldOut, this.variantId});
  final String itemId;
  /// The chosen option of a product sold in options (shops), or null.
  final String? variantId;
  /// The line's identity: product and option together. The same product in two sizes is two lines.
  String get key => '$itemId:${variantId ?? ''}';
  final int qty;
  final String note;
  final Localised? name;
  final int? unitMinor;
  final bool soldOut;

  factory CartLine.fromJson(Map<String, dynamic> json) => CartLine(
        itemId: json['itemId'] as String,
        variantId: json['variantId'] as String?,
        qty: json['qty'] as int,
        note: (json['note'] as String?) ?? '',
        name: json['name'] == null ? null : Localised.fromJson(json['name'] as Map<String, dynamic>),
        unitMinor: json['unitMinor'] as int?,
        soldOut: (json['soldOut'] as bool?) ?? false,
      );

  CartLine copyWith({int? qty, String? note}) =>
      CartLine(itemId: itemId, variantId: variantId, qty: qty ?? this.qty, note: note ?? this.note, name: name, unitMinor: unitMinor, soldOut: soldOut);
}

class Quote {
  const Quote({
    required this.currency,
    required this.subtotalMinor,
    required this.deliveryFeeMinor,
    required this.serviceFeeMinor,
    required this.totalMinor,
    required this.taxLabel,
    required this.taxIncludedMinor,
    this.discountMinor = 0,
  });
  final String currency;
  final int subtotalMinor;
  /// What the offer or voucher takes off the order. Zero when none applies.
  final int discountMinor;
  final int deliveryFeeMinor;
  final int serviceFeeMinor;
  final int totalMinor;
  final String taxLabel;
  final int taxIncludedMinor;

  factory Quote.fromJson(Map<String, dynamic> json) => Quote(
        currency: json['currency'] as String,
        subtotalMinor: json['subtotalMinor'] as int,
        deliveryFeeMinor: json['deliveryFeeMinor'] as int,
        serviceFeeMinor: json['serviceFeeMinor'] as int,
        totalMinor: json['totalMinor'] as int,
        taxLabel: json['taxLabel'] as String,
        taxIncludedMinor: json['taxIncludedMinor'] as int,
        discountMinor: json['discountMinor'] as int? ?? 0,
      );
}

/// The code on the cart. [applied] is false when the code no longer applies; [reason] says why.
class CartOffer {
  const CartOffer({required this.applied, this.label, this.reason, this.discountMinor = 0});
  final bool applied;
  final String? label;
  final String? reason;
  final int discountMinor;

  factory CartOffer.fromJson(Map<String, dynamic> json) => CartOffer(
        applied: json['applied'] as bool,
        label: json['label'] as String?,
        reason: json['reason'] as String?,
        discountMinor: json['discountMinor'] as int? ?? 0,
      );
}

class OrderStatusEvent {
  const OrderStatusEvent({required this.status, required this.at});
  final String status;
  final DateTime at;
}

class PlacedOrder {
  const PlacedOrder({required this.id, required this.number, required this.status, required this.method, required this.channel, required this.etaMinutes, required this.quote, required this.history, this.lines = const [], this.address, this.ratingStars});
  final String id;
  final String number;
  final String status;
  final String method;
  final String channel;
  final int? etaMinutes;
  final Quote quote;
  final List<OrderStatusEvent> history;
  /// What was ordered, as the server priced it.
  final List<OrderLineView> lines;
  /// The delivery address the order went to, as a line of text; null for pickup.
  final String? address;
  /// The stars the customer gave this order, or null when they have not rated it.
  final int? ratingStars;

  factory PlacedOrder.fromJson(Map<String, dynamic> json) => PlacedOrder(
        id: json['id'] as String,
        number: json['number'] as String,
        status: json['status'] as String,
        method: json['method'] as String,
        channel: json['channel'] as String,
        etaMinutes: json['etaMinutes'] as int?,
        quote: Quote.fromJson(json['quote'] as Map<String, dynamic>),
        history: ((json['history'] as List<dynamic>?) ?? [])
            .map((h) => OrderStatusEvent(status: (h as Map<String, dynamic>)['status'] as String, at: DateTime.parse(h['at'] as String)))
            .toList(),
        lines: [
          for (final l in (json['lines'] as List<dynamic>? ?? []))
            OrderLineView(
              name: Localised.fromJson((l as Map<String, dynamic>)['name'] as Map<String, dynamic>),
              qty: l['qty'] as int,
              note: l['note'] as String? ?? '',
              unitMinor: l['unitMinor'] as int? ?? 0,
            ),
        ],
        address: json['address'] as String?,
        ratingStars: ((json['rating'] as Map<String, dynamic>?)?['stars'] as num?)?.toInt(),
      );
}

class OrderLineView {
  const OrderLineView({required this.name, required this.qty, required this.note, required this.unitMinor});
  final Localised name;
  final int qty;
  final String note;
  final int unitMinor;
}

class ApiException implements Exception {
  const ApiException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => message;
}

/// An item the assistant points to. The app shows it from its own data; the assistant only chose the id.
class ItemRef {
  const ItemRef({required this.id, required this.name, required this.priceMinor, required this.soldOut});
  final String id;
  final Localised name;
  final int priceMinor;
  final bool soldOut;

  factory ItemRef.fromJson(Map<String, dynamic> json) => ItemRef(
        id: json['id'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        priceMinor: json['priceMinor'] as int,
        soldOut: json['soldOut'] as bool? ?? false,
      );
}

class OrderRef {
  const OrderRef({required this.id, required this.number, required this.status, required this.etaMinutes, required this.totalMinor, required this.currency});
  final String id;
  final String number;
  final String status;
  final int? etaMinutes;
  final int totalMinor;
  final String currency;

  factory OrderRef.fromJson(Map<String, dynamic> json) => OrderRef(
        id: json['id'] as String,
        number: json['number'] as String,
        status: json['status'] as String,
        etaMinutes: json['etaMinutes'] as int?,
        totalMinor: json['totalMinor'] as int,
        currency: json['currency'] as String,
      );
}

/// A dish the assistant offers to add, for the customer to confirm. Price and name come from the server's menu.
class CartProposal {
  const CartProposal({required this.itemId, required this.name, required this.qty, required this.priceMinor, this.imageUrl});
  final String itemId;
  final Localised name;
  final int qty;
  final int priceMinor;
  final String? imageUrl;

  factory CartProposal.fromJson(Map<String, dynamic> json) => CartProposal(
        itemId: json['itemId'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        qty: (json['qty'] as num).toInt(),
        priceMinor: (json['priceMinor'] as num).toInt(),
        imageUrl: MediaUrls.resolve(json['imageUrl']),
      );
}

class AssistantReply {
  const AssistantReply({required this.intent, required this.answer, required this.items, required this.orders, this.proposals = const [], this.choices = const [], this.currency = ''});
  final String intent;
  /// The restaurant's currency for the cards' prices.
  final String currency;
  final String answer;
  final List<ItemRef> items;
  final List<OrderRef> orders;
  final List<CartProposal> proposals;
  /// Fixed answers to tap when the assistant asks whether the question is about an order or the menu.
  final List<String> choices;

  factory AssistantReply.fromJson(Map<String, dynamic> json) => AssistantReply(
        intent: json['intent'] as String,
        answer: json['answer'] as String,
        items: ((json['items'] as List<dynamic>?) ?? []).map((i) => ItemRef.fromJson(i as Map<String, dynamic>)).toList(),
        orders: ((json['orders'] as List<dynamic>?) ?? []).map((o) => OrderRef.fromJson(o as Map<String, dynamic>)).toList(),
        proposals: ((json['proposals'] as List<dynamic>?) ?? []).map((p) => CartProposal.fromJson(p as Map<String, dynamic>)).toList(),
        choices: ((json['choices'] as List<dynamic>?) ?? []).whereType<String>().toList(),
        currency: json['currency'] as String? ?? '',
      );
}

/// A delivery address saved on the customer's account (the server's `addresses` rows that are saved).
class SavedAddress {
  const SavedAddress({
    required this.id,
    required this.label,
    required this.line1,
    required this.line2,
    required this.notes,
    required this.isDefault,
    required this.zoneId,
    required this.zoneName,
  });
  final String id;
  final String label;
  final String line1;
  final String line2;
  final String notes;
  final bool isDefault;
  final String? zoneId;
  final Localised? zoneName;

  factory SavedAddress.fromJson(Map<String, dynamic> json) {
    final zone = json['zone'] as Map<String, dynamic>?;
    return SavedAddress(
      id: json['id'] as String,
      label: json['label'] as String,
      line1: json['line1'] as String,
      line2: json['line2'] as String? ?? '',
      notes: json['notes'] as String? ?? '',
      isDefault: json['isDefault'] as bool? ?? false,
      zoneId: zone?['id'] as String?,
      zoneName: zone == null ? null : Localised.fromJson(zone['name'] as Map<String, dynamic>),
    );
  }
}

/// A delivery area the restaurant serves, with its fee and the smallest order it accepts.
class DeliveryZone {
  const DeliveryZone({required this.id, required this.name, required this.feeMinor, required this.minOrderMinor, this.centre});
  final String id;
  final Localised name;
  final int feeMinor;
  final int minOrderMinor;
  final GeoPoint? centre;

  factory DeliveryZone.fromJson(Map<String, dynamic> json) {
    final c = json['centre'] as Map<String, dynamic>?;
    return DeliveryZone(
      id: json['id'] as String,
      name: Localised.fromJson(json['name'] as Map<String, dynamic>),
      feeMinor: json['feeMinor'] as int,
      minOrderMinor: json['minOrderMinor'] as int,
      centre: c == null ? null : GeoPoint((c['lat'] as num).toDouble(), (c['lng'] as num).toDouble()),
    );
  }
}

/// A place from search or from a pin: a label and its coordinates.
class Place {
  const Place({required this.label, required this.lat, required this.lng});
  final String label;
  final double lat;
  final double lng;

  GeoPoint get point => GeoPoint(lat, lng);

  factory Place.fromJson(Map<String, dynamic> json) => Place(
        label: json['label'] as String,
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
      );
}

/// The zone of the chosen address and whether the cart meets its minimum. Null until an address is chosen.
class DeliveryQuote {
  const DeliveryQuote({required this.zoneId, required this.zoneName, required this.minOrderMinor, required this.deliverable});
  final String zoneId;
  final Localised zoneName;
  final int minOrderMinor;
  final bool deliverable;

  factory DeliveryQuote.fromJson(Map<String, dynamic> json) => DeliveryQuote(
        zoneId: json['zoneId'] as String,
        zoneName: Localised.fromJson(json['zoneName'] as Map<String, dynamic>),
        minOrderMinor: json['minOrderMinor'] as int,
        deliverable: json['deliverable'] as bool,
      );
}

class QuoteResult {
  const QuoteResult({required this.quote, required this.delivery, this.offer});
  final Quote quote;
  final DeliveryQuote? delivery;
  /// The cart's code checked against this order type and address; null when the cart has no code.
  final CartOffer? offer;
}

/// One past order in the history list, with its dish names and quantities.
class OrderHistory {
  const OrderHistory({
    required this.id,
    required this.number,
    required this.status,
    required this.channel,
    required this.placedAt,
    required this.totalMinor,
    required this.currency,
    required this.items,
    this.ratingStars,
  });
  final String id;
  final String number;
  final String status;
  final String channel;
  final int? ratingStars;
  final DateTime placedAt;
  final int totalMinor;
  final String currency;
  final List<HistoryItem> items;

  factory OrderHistory.fromJson(Map<String, dynamic> json) => OrderHistory(
        ratingStars: (json['ratingStars'] as num?)?.toInt(),
        id: json['id'] as String,
        number: json['number'] as String,
        status: json['status'] as String,
        channel: json['channel'] as String,
        placedAt: DateTime.parse(json['placedAt'] as String),
        totalMinor: json['totalMinor'] as int,
        currency: json['currency'] as String,
        items: ((json['items'] as List<dynamic>?) ?? [])
            .map((i) => HistoryItem.fromJson(i as Map<String, dynamic>))
            .toList(),
      );
}

class HistoryItem {
  const HistoryItem({required this.name, required this.qty});
  final Localised name;
  final int qty;

  factory HistoryItem.fromJson(Map<String, dynamic> json) => HistoryItem(
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        qty: json['qty'] as int,
      );
}

/// A dish shown on the home screen: frequent, favourite or in the menu, with the server's price and availability.
class DishCard {
  const DishCard({required this.id, required this.name, required this.priceMinor, required this.soldOut, required this.timesOrdered, this.imageUrl});
  final String id;
  final Localised name;
  final int priceMinor;
  final bool soldOut;
  final int timesOrdered;
  final String? imageUrl;

  factory DishCard.fromJson(Map<String, dynamic> json) => DishCard(
        id: json['id'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        priceMinor: json['priceMinor'] as int,
        soldOut: json['soldOut'] as bool? ?? false,
        imageUrl: MediaUrls.resolve(json['imageUrl']),
        timesOrdered: json['timesOrdered'] as int? ?? 0,
      );
}

class HomeShortcuts {
  const HomeShortcuts({required this.lastOrder, required this.frequent, required this.favourites});
  final OrderHistory? lastOrder;
  final List<DishCard> frequent;
  final List<DishCard> favourites;

  factory HomeShortcuts.fromJson(Map<String, dynamic> json) => HomeShortcuts(
        lastOrder: json['lastOrder'] == null ? null : OrderHistory.fromJson(json['lastOrder'] as Map<String, dynamic>),
        frequent: ((json['frequent'] as List<dynamic>?) ?? []).map((d) => DishCard.fromJson(d as Map<String, dynamic>)).toList(),
        favourites: ((json['favourites'] as List<dynamic>?) ?? []).map((d) => DishCard.fromJson(d as Map<String, dynamic>)).toList(),
      );
}

class ReorderResult {
  const ReorderResult({required this.added, required this.skipped});
  final List<String> added;
  final List<String> skipped;

  factory ReorderResult.fromJson(Map<String, dynamic> json) => ReorderResult(
        added: (json['added'] as List<dynamic>).cast<String>(),
        skipped: (json['skipped'] as List<dynamic>).cast<String>(),
      );
}

/// One benefit of a membership plan: a tile on the membership screen and the details sheet it opens.
class MembershipBenefit {
  const MembershipBenefit({required this.id, required this.title, required this.summary, required this.icon, required this.accent, required this.points});
  final String id;
  final Localised title;
  final Localised summary;
  final String icon;
  final String accent;
  final List<Localised> points;

  factory MembershipBenefit.fromJson(Map<String, dynamic> json) => MembershipBenefit(
        id: json['id'] as String,
        title: Localised.fromJson(json['title'] as Map<String, dynamic>),
        summary: Localised.fromJson(json['summary'] as Map<String, dynamic>),
        icon: json['icon'] as String? ?? 'star',
        accent: json['accent'] as String? ?? 'lilac',
        points: ((json['points'] as List<dynamic>?) ?? []).map((p) => Localised.fromJson(p as Map<String, dynamic>)).toList(),
      );
}

class MembershipPlan {
  const MembershipPlan({required this.id, required this.name, required this.amountMinor, required this.currency, required this.period, required this.active, required this.benefits});
  final String id;
  final Localised name;
  final int amountMinor;
  final String currency;
  final String period;
  final bool active;
  final List<MembershipBenefit> benefits;

  factory MembershipPlan.fromJson(Map<String, dynamic> json) {
    final price = json['price'] as Map<String, dynamic>;
    return MembershipPlan(
      id: json['id'] as String,
      name: Localised.fromJson(json['name'] as Map<String, dynamic>),
      amountMinor: price['amountMinor'] as int,
      currency: price['currency'] as String,
      period: price['period'] as String,
      active: json['active'] as bool,
      benefits: ((json['benefits'] as List<dynamic>?) ?? []).map((b) => MembershipBenefit.fromJson(b as Map<String, dynamic>)).toList(),
    );
  }
}

class MembershipState {
  const MembershipState({required this.plans, required this.membershipPlanId, required this.startedAt});
  final List<MembershipPlan> plans;
  final String? membershipPlanId;
  final DateTime? startedAt;

  factory MembershipState.fromJson(Map<String, dynamic> json) {
    final m = json['membership'] as Map<String, dynamic>?;
    return MembershipState(
      plans: ((json['plans'] as List<dynamic>?) ?? []).map((p) => MembershipPlan.fromJson(p as Map<String, dynamic>)).toList(),
      membershipPlanId: m?['planId'] as String?,
      startedAt: m == null ? null : DateTime.parse(m['startedAt'] as String),
    );
  }
}

/// One voucher in the customer's wallet. [state] is available, used, expired or unavailable (revoked).
class WalletVoucher {
  const WalletVoucher({
    required this.voucherId,
    required this.state,
    required this.discount,
    required this.campaign,
    required this.minOrderMinor,
    required this.currency,
    required this.expiresAt,
  });
  final String voucherId;
  final String state;
  final String discount;
  final String campaign;
  final int minOrderMinor;
  final String currency;
  final DateTime expiresAt;

  factory WalletVoucher.fromJson(Map<String, dynamic> json) => WalletVoucher(
        voucherId: json['voucherId'] as String,
        state: json['state'] as String,
        discount: json['discount'] as String,
        campaign: json['campaign'] as String,
        minOrderMinor: json['minOrderMinor'] as int,
        currency: json['currency'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
      );
}

class Wallet {
  const Wallet({required this.available, required this.used, required this.expired});
  final List<WalletVoucher> available;
  final List<WalletVoucher> used;
  final List<WalletVoucher> expired;

  factory Wallet.fromJson(Map<String, dynamic> json) {
    List<WalletVoucher> group(String key) => [for (final v in json[key] as List<dynamic>) WalletVoucher.fromJson(v as Map<String, dynamic>)];
    return Wallet(available: group('available'), used: group('used'), expired: group('expired'));
  }
}

/// A promotion staff publish in the admin: a picture or a video, with an optional title and button, shown at the top
/// of the home screen (hero) or between its sections (mid-feed).
/// How a promotion looks and arrives, as staff set it in the admin.
class PromoLook {
  const PromoLook({this.animation = 'slide_up', this.size = 'standard', this.frame = 'rounded', this.colour, this.durationSeconds = 5, this.frequency = 'once_per_day'});
  final String animation;
  final String size;
  final String frame;
  final Color? colour;
  final int durationSeconds;
  final String frequency;

  factory PromoLook.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PromoLook();
    final hex = (json['colour'] as String?)?.replaceFirst('#', '');
    final n = hex == null ? null : int.tryParse(hex, radix: 16);
    return PromoLook(
      animation: json['animation'] as String? ?? 'slide_up',
      size: json['size'] as String? ?? 'standard',
      frame: json['frame'] as String? ?? 'rounded',
      colour: n == null ? null : Color(0xFF000000 | n),
      durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 5,
      frequency: json['frequency'] as String? ?? 'once_per_day',
    );
  }
}

/// The terms of the offer a promotion is linked to, worked out by the server from the offer itself.
class PromoOffer {
  const PromoOffer({required this.headline, required this.code, required this.minSpendMinor, required this.maxSavingMinor, required this.currency, required this.endsAt, required this.daysLeft, required this.appliesTo});
  final Localised headline;
  final String? code;
  final int minSpendMinor;
  final int? maxSavingMinor;
  final String currency;
  final DateTime endsAt;
  final int daysLeft;
  final String appliesTo;

  factory PromoOffer.fromJson(Map<String, dynamic> json) => PromoOffer(
        headline: Localised.fromJson(json['headline'] as Map<String, dynamic>),
        code: json['code'] as String?,
        minSpendMinor: (json['minSpendMinor'] as num?)?.toInt() ?? 0,
        maxSavingMinor: (json['maxSavingMinor'] as num?)?.toInt(),
        currency: json['currency'] as String? ?? 'AED',
        endsAt: DateTime.parse(json['endsAt'] as String),
        daysLeft: (json['daysLeft'] as num?)?.toInt() ?? 0,
        appliesTo: json['appliesTo'] as String? ?? 'order',
      );
}

class Promotion {
  const Promotion({required this.id, required this.kind, required this.url, this.posterUrl, required this.title, required this.cta, this.menuItemId, this.kicker = const Localised('', ''), this.body = const Localised('', ''), this.offer, this.look = const PromoLook()});
  final String id;
  /// 'image' or 'video', or 'none' when the promotion runs on colour and words alone.
  final String kind;
  /// The picture, GIF or video; empty when there is none.
  final String url;
  /// For a video: a still of its first frame, shown at once while the video loads. Null when the server has none.
  final String? posterUrl;
  final Localised title;
  final Localised cta;
  final String? menuItemId;
  final Localised kicker;
  final Localised body;
  final PromoOffer? offer;
  final PromoLook look;

  bool get hasMedia => url.isNotEmpty;

  factory Promotion.fromJson(Map<String, dynamic> json) {
    final media = json['media'] as Map<String, dynamic>?;
    Localised text(String key) => json[key] is Map<String, dynamic> ? Localised.fromJson(json[key] as Map<String, dynamic>) : const Localised('', '');
    return Promotion(
      id: json['id'] as String,
      kind: media?['kind'] as String? ?? 'none',
      url: media == null ? '' : MediaUrls.resolve(media['url'])!,
      posterUrl: media == null ? null : MediaUrls.resolve(media['posterUrl']),
      title: text('title'),
      cta: text('cta'),
      menuItemId: json['menuItemId'] as String?,
      kicker: text('kicker'),
      body: text('body'),
      offer: json['offer'] is Map<String, dynamic> ? PromoOffer.fromJson(json['offer'] as Map<String, dynamic>) : null,
      look: PromoLook.fromJson(json['look'] as Map<String, dynamic>?),
    );
  }
}

class HomePromotions {
  const HomePromotions({required this.hero, required this.midFeed, this.carousel = const [], this.welcome, this.strip});
  final List<Promotion> hero;
  final List<Promotion> midFeed;
  final List<Promotion> carousel;
  /// The pop-up shown when the app opens, if staff published one.
  final Promotion? welcome;
  /// The slim offer line above the menu bar.
  final Promotion? strip;

  static List<Promotion> _list(Object? raw) => [for (final p in (raw as List<dynamic>? ?? [])) Promotion.fromJson(p as Map<String, dynamic>)];

  factory HomePromotions.fromJson(Map<String, dynamic> json) => HomePromotions(
        hero: _list(json['hero']),
        midFeed: _list(json['midFeed']),
        carousel: _list(json['carousel']),
        welcome: json['welcome'] is Map<String, dynamic> ? Promotion.fromJson(json['welcome'] as Map<String, dynamic>) : null,
        strip: json['strip'] is Map<String, dynamic> ? Promotion.fromJson(json['strip'] as Map<String, dynamic>) : null,
      );
}
