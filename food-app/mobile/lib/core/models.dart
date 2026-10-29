// Shapes returned by the /v1 API (food-app/web/app/v1). Parsed defensively: a missing field is a bug on the server.

class Localised {
  const Localised(this.en, this.ar);
  final String en;
  final String ar;

  factory Localised.fromJson(Map<String, dynamic> json) => Localised(json['en'] as String, json['ar'] as String);

  String of(String languageCode) => languageCode == 'ar' ? ar : en;
}

class MenuItem {
  const MenuItem({required this.id, required this.name, required this.description, required this.priceMinor, required this.soldOut});
  final String id;
  final Localised name;
  final Localised description;
  final int priceMinor;
  final bool soldOut;

  factory MenuItem.fromJson(Map<String, dynamic> json) => MenuItem(
        id: json['id'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        description: Localised.fromJson(json['description'] as Map<String, dynamic>),
        priceMinor: json['priceMinor'] as int,
        soldOut: json['soldOut'] as bool,
      );
}

class MenuCategory {
  const MenuCategory({required this.id, required this.name, required this.items});
  final String id;
  final Localised name;
  final List<MenuItem> items;

  factory MenuCategory.fromJson(Map<String, dynamic> json) => MenuCategory(
        id: json['id'] as String,
        name: Localised.fromJson(json['name'] as Map<String, dynamic>),
        items: (json['items'] as List<dynamic>).map((i) => MenuItem.fromJson(i as Map<String, dynamic>)).toList(),
      );
}

class PaymentOptions {
  const PaymentOptions({required this.cod, required this.payOnArrival, required this.card});
  final bool cod;
  final bool payOnArrival;
  final bool card;
}

class Menu {
  const Menu({required this.restaurant, required this.currency, required this.categories, required this.payments});
  final Localised restaurant;
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
    );
  }
}

class CartLine {
  const CartLine({required this.itemId, required this.qty, required this.note, required this.name, required this.unitMinor, required this.soldOut});
  final String itemId;
  final int qty;
  final String note;
  final Localised? name;
  final int? unitMinor;
  final bool soldOut;

  factory CartLine.fromJson(Map<String, dynamic> json) => CartLine(
        itemId: json['itemId'] as String,
        qty: json['qty'] as int,
        note: (json['note'] as String?) ?? '',
        name: json['name'] == null ? null : Localised.fromJson(json['name'] as Map<String, dynamic>),
        unitMinor: json['unitMinor'] as int?,
        soldOut: (json['soldOut'] as bool?) ?? false,
      );

  CartLine copyWith({int? qty, String? note}) =>
      CartLine(itemId: itemId, qty: qty ?? this.qty, note: note ?? this.note, name: name, unitMinor: unitMinor, soldOut: soldOut);
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
  });
  final String currency;
  final int subtotalMinor;
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
      );
}

class OrderStatusEvent {
  const OrderStatusEvent({required this.status, required this.at});
  final String status;
  final DateTime at;
}

class PlacedOrder {
  const PlacedOrder({required this.id, required this.number, required this.status, required this.method, required this.channel, required this.etaMinutes, required this.quote, required this.history});
  final String id;
  final String number;
  final String status;
  final String method;
  final String channel;
  final int? etaMinutes;
  final Quote quote;
  final List<OrderStatusEvent> history;

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
      );
}

class ApiException implements Exception {
  const ApiException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => message;
}
