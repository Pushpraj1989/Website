// The app's demo mode: the API's rules, run inside the app on a snapshot of real data, so the app can be tried with no
// server. The snapshot (assets/demo/snapshot.json) is exported from a database by
// food-app/web/scripts/export-demo-snapshot.ts with the functions the API serves from: menu, prices, delivery areas,
// offers and their rules, membership plans and a few real voucher codes. Nothing here is typed in by hand.
//
// What the demo does differently from the live service, and why:
// - One-time codes are sent to the in-app inbox (DemoInbox) instead of by SMS or email.
// - The kitchen's steps (accepted, preparing, ready, out for delivery) happen on a timer, since no staff are watching.
// - Address search, card payment and the assistant need outside services; they answer the way the live API answers
//   when those services are not configured.
// Every message and error code below is the API's own wording (food-app/web/lib).
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// A one-time code the demo "sent". The app shows it the way a phone shows an incoming message.
class DemoMessage {
  const DemoMessage({required this.to, required this.text, required this.at});
  final String to;
  final String text;
  final DateTime at;
}

/// Where the demo delivers one-time codes.
class DemoInbox extends ValueNotifier<DemoMessage?> {
  DemoInbox() : super(null);
}

// The API's limits (food-app/web/lib/accounts.ts, orders.ts, cart).
const _codeTtl = Duration(minutes: 5);
const _maxAttempts = 5;
const _resendCooldown = Duration(seconds: 30);
const _maxSavedAddresses = 10;
const _maxCartQty = 20;
const _notValid = 'That code is not valid. Check it and try again.';

// The kitchen's steps in the demo and when each is reached, in seconds after the order is placed.
const _deliveryTimeline = [('placed', 0), ('accepted', 10), ('preparing', 25), ('ready', 70), ('out_for_delivery', 95), ('delivered', 150)];
const _pickupTimeline = [('placed', 0), ('accepted', 10), ('preparing', 25), ('ready', 70), ('collected', 150)];

class _Refused implements Exception {
  const _Refused(this.message, this.code, [this.status = 422]);
  final String message;
  final String code;
  final int status;
}

class _Order {
  _Order({required this.id, required this.number, required this.channel, required this.method, required this.lines, required this.quote, required this.placedAt, required this.address});
  final String id;
  final String number;
  final String channel;
  final String method;
  final List<Map<String, dynamic>> lines;
  final Map<String, dynamic> quote;
  final DateTime placedAt;
  final String? address;

  List<(String, int)> get timeline => channel == 'pickup' ? _pickupTimeline : _deliveryTimeline;

  List<Map<String, String>> history(DateTime now) {
    final seconds = now.difference(placedAt).inSeconds;
    return [
      for (final (status, at) in timeline)
        if (seconds >= at) {'status': status, 'at': placedAt.add(Duration(seconds: at)).toUtc().toIso8601String()},
    ];
  }

  String status(DateTime now) => history(now).last['status']!;

  /// Minutes until the last step of the timeline, or null once the order is finished or not yet accepted.
  int? etaMinutes(DateTime now) {
    final s = status(now);
    if (s == 'placed' || s == timeline.last.$1) return null;
    final left = timeline.last.$2 - now.difference(placedAt).inSeconds;
    return max(1, (left / 60).ceil());
  }
}

class _Challenge {
  _Challenge({required this.id, required this.purpose, required this.target, required this.code, required this.expiresAt, this.name, this.accountId, this.phone});
  final String id;
  final String purpose;
  final String target;
  final String code;
  final DateTime expiresAt;
  final String? name;
  final String? accountId;
  final String? phone;
  int attempts = 0;
  bool consumed = false;
}

/// The demo server. [client] answers the app's requests the way the real API does, from [snapshot].
class DemoServer {
  DemoServer({required Map<String, dynamic> snapshot, DemoInbox? inbox, DateTime Function()? clock, Random? random})
      : _snap = snapshot,
        inbox = inbox ?? DemoInbox(),
        _now = clock ?? DateTime.now,
        _random = random ?? Random.secure() {
    for (final c in _snap['categories'] as List<dynamic>) {
      for (final i in (c as Map<String, dynamic>)['items'] as List<dynamic>) {
        final item = i as Map<String, dynamic>;
        _items[item['id'] as String] = item;
      }
    }
    var n = 0;
    for (final v in _snap['vouchers'] as List<dynamic>) {
      final voucher = Map<String, dynamic>.from(v as Map);
      // Each exported voucher gets a fixed id for the life of the demo, so ids never repeat.
      voucher['voucherId'] = _uuid('v', ++n);
      voucher['status'] = 'available';
      _vouchers[voucher['code'] as String] = voucher;
    }
  }

  /// Loads the snapshot shipped with the app.
  static Map<String, dynamic> parse(String json) => jsonDecode(json) as Map<String, dynamic>;

  final Map<String, dynamic> _snap;
  final DemoInbox inbox;
  final DateTime Function() _now;
  final Random _random;

  final Map<String, Map<String, dynamic>> _items = {};
  final Map<String, Map<String, dynamic>> _vouchers = {};
  final List<Map<String, dynamic>> _cart = [];
  ({String offerId, String? voucherCode})? _applied;
  final List<String> _favourites = [];
  final List<_Order> _orders = [];
  final Map<String, String> _orderKeys = {};
  final List<Map<String, dynamic>> _addresses = [];
  final Map<String, int> _offerUses = {};
  final List<({String offerId, String? accountId})> _redemptions = [];
  final Map<String, Map<String, dynamic>> _accounts = {};
  final Map<String, String> _sessions = {};
  final Map<String, _Challenge> _challenges = {};
  final Map<String, Set<String>> _wallets = {};
  int _seq = 0;
  int _orderNumber = 0;

  late final http.Client client = MockClient(_handle);

  /// A UUID-shaped id that is never reused: the kind prefix and a counter that only goes up.
  String _uuid(String kind, [int? n]) {
    final count = n ?? ++_seq;
    final tag = kind.codeUnitAt(0).toRadixString(16).padLeft(4, '0');
    return '00000000-0000-4000-$tag-${count.toString().padLeft(12, '0')}';
  }

  Map<String, dynamic> get _restaurant => _snap['restaurant'] as Map<String, dynamic>;
  String get _currency => _restaurant['currency'] as String;

  Future<http.Response> _handle(http.Request request) async {
    // A short wait, so loading states show the way they would on a phone network.
    await Future<void>.delayed(const Duration(milliseconds: 150));
    try {
      final body = request.body.isEmpty ? <String, dynamic>{} : jsonDecode(request.body);
      if (body is! Map<String, dynamic>) throw const _Refused('The request is not valid.', 'bad_input', 400);
      return _route(request, body);
    } on _Refused catch (e) {
      return _json({'error': {'code': e.code, 'message': e.message}}, e.status);
    } on Object {
      // Anything malformed is answered like the API answers a bad request, never as an unhandled failure.
      return _json({'error': {'code': 'bad_input', 'message': 'The request is not valid.'}}, 400);
    }
  }

  http.Response _route(http.Request request, Map<String, dynamic> body) {
    final method = request.method;
    final path = request.url.path;
    final query = request.url.queryParameters;
    final account = _accountOf(request);
    final parts = path.split('/');
    switch ((method, path)) {
      case ('GET', '/v1/menu'):
        return _ok(_menu());
      case ('GET', '/v1/cart'):
        return _ok(_cartView(_channel(query['channel']), account));
      case ('PUT', '/v1/cart'):
        return _ok(_saveCart(body, account));
      case ('PUT', '/v1/cart/offer'):
        return _ok(_applyCode(body, account));
      case ('DELETE', '/v1/cart/offer'):
        _applied = null;
        return _ok({'offer': null});
      case ('POST', '/v1/checkout/quote'):
        if (_cart.isEmpty) throw const _Refused('Your cart is empty.', 'empty_cart');
        final channel = _channel(body['channel']);
        return _ok(_quote(channel, body['addressId'] is String ? body['addressId'] as String : null, account));
      case ('POST', '/v1/orders'):
        return _json({'order': _orderView(_place(body, account))}, 201);
      case ('GET', '/v1/orders'):
        return _ok({
          'orders': [for (final o in _orders.reversed) _historyView(o)],
          // As lib/customer.ts savingsFor: the discounts on orders that went ahead.
          'savedMinor': _orders.where((o) => !const {'cancelled', 'rejected', 'awaiting_payment'}.contains(o.status(_now()))).fold<int>(0, (sum, o) => sum + ((o.quote['discountMinor'] as num?)?.toInt() ?? 0)),
        });
      case ('GET', '/v1/addresses'):
        return _ok({'addresses': _addresses.map(_addressView).toList()});
      case ('POST', '/v1/addresses'):
        return _json({'address': _addressView(_saveAddress(body))}, 201);
      case ('GET', '/v1/delivery-zones'):
        return _ok({'zones': _zones.map(_zoneListView).toList()});
      case ('GET', '/v1/places/search'):
      case ('GET', '/v1/places/reverse'):
        throw const _Refused('Address search is not configured yet.', 'places_unavailable', 503);
      case ('GET', '/v1/customer/home'):
        return _ok(_home());
      case ('GET', '/v1/brand'):
        return _ok({'brand': _snap['brand']});
      case ('GET', '/v1/home'):
        // The promotions published in the database, minus those that need a picture from the server.
        return _ok((_snap['home'] as Map<String, dynamic>?) ?? {'hero': <Object>[], 'midFeed': <Object>[]});
      case ('GET', '/v1/membership'):
        return _ok(_snap['membership'] as Map<String, dynamic>);
      case ('POST', '/v1/ai/ask'):
        throw const _Refused('The assistant is not switched on.', 'assistant_off', 503);
      case ('GET', '/v1/me/vouchers'):
        return _ok(_walletView(_signedIn(account)));
      case ('POST', '/v1/me/vouchers'):
        return _json({'voucher': _saveVoucher(_signedIn(account), body['code'])}, 201);
      case ('POST', '/v1/auth/signup/phone'):
        return _ok(_signupStart(body));
      case ('POST', '/v1/auth/signup/phone/verify'):
        return _json(_signupVerify(body), 201);
      case ('POST', '/v1/auth/login/phone'):
        return _ok(_loginStart(body));
      case ('POST', '/v1/auth/login/phone/verify'):
        return _ok(_loginVerify(body));
      case ('POST', '/v1/auth/signup/email'):
        return _ok(_signupEmailStart(body));
      case ('POST', '/v1/auth/signup/email/verify'):
        return _json(_signupEmailVerify(body), 201);
      case ('POST', '/v1/auth/login/email'):
        return _ok(_loginEmailStart(body));
      case ('POST', '/v1/auth/login/email/verify'):
        return _ok(_loginEmailVerify(body));
      case ('POST', '/v1/auth/email/start'):
        return _ok(_emailStart(_signedIn(account), body));
      case ('POST', '/v1/auth/email/verify'):
        return _ok({'account': _emailVerify(_signedIn(account), body)});
      case ('GET', '/v1/auth/me'):
        return _ok({'account': _signedIn(account)});
      case ('POST', '/v1/auth/logout'):
        _sessions.remove(_token(request));
        return _ok({'ok': true});
    }
    if (path.startsWith('/v1/favourites/') && parts.length == 4) {
      _setFavourite(parts[3], method == 'PUT');
      return _ok({'ok': true});
    }
    if (path.startsWith('/v1/me/vouchers/') && method == 'DELETE' && parts.length == 5) {
      final account = _signedIn(_accountOf(request));
      final wallet = _wallets[account['id']] ?? {};
      if (!wallet.remove(parts[4])) throw const _Refused('That voucher is not in your wallet.', 'not_found', 404);
      return _ok({'removed': true});
    }
    if (path.startsWith('/v1/addresses/') && method == 'DELETE' && parts.length == 4) {
      _deleteAddress(parts[3]);
      return _ok({'ok': true});
    }
    if (path.startsWith('/v1/orders/') && path.endsWith('/reorder') && method == 'POST') return _ok(_reorder(parts[3]));
    if (path.startsWith('/v1/orders/') && path.endsWith('/rating') && method == 'PUT') return _ok({'rating': _rate(parts[3], body)});
    if (path.startsWith('/v1/orders/') && method == 'GET' && parts.length == 4) {
      final order = _orders.where((o) => o.id == parts[3]).firstOrNull;
      if (order == null) throw const _Refused('Order not found.', 'not_found', 404);
      return _ok({'order': _orderView(order)});
    }
    throw const _Refused('Not found.', 'not_found', 404);
  }

  String _channel(Object? value) => value == 'pickup' ? 'pickup' : 'delivery';

  // ---- Menu and cart (web/app/v1/menu, web/app/v1/cart) ----

  Map<String, dynamic> _menu() => {
        'restaurant': _restaurant['name'],
        if (_snap['brand'] != null) 'brand': _snap['brand'],
        'currency': _currency,
        'categories': _snap['categories'],
        'offers': _snap['menuOffers'],
        'payments': _restaurant['payments'],
      };

  Map<String, dynamic> _item(String id) => _items[id] ?? (throw const _Refused('That item is not on the menu.', 'item_missing'));

  Map<String, dynamic> _saveCart(Map<String, dynamic> body, Map<String, dynamic>? account) {
    final raw = body['items'];
    if (raw is! List) throw const _Refused('Cart must be a list.', 'bad_input', 400);
    final lines = <Map<String, dynamic>>[];
    for (final entry in raw) {
      final line = entry is Map ? entry : const {};
      final qty = line['qty'];
      if (line['itemId'] is! String || qty is! int || qty < 0 || qty > _maxCartQty) {
        throw const _Refused('Each line needs an item and a quantity from 0 to 20.', 'bad_input', 400);
      }
      if (qty == 0) continue;
      final item = _item(line['itemId'] as String);
      if (item['soldOut'] == true) throw _Refused('${(item['name'] as Map)['en']} is sold out.', 'sold_out');
      final note = line['note'] is String ? (line['note'] as String).trim() : '';
      lines.add({'itemId': item['id'], 'qty': qty, 'note': note.length > 200 ? note.substring(0, 200) : note});
    }
    _cart
      ..clear()
      ..addAll(lines);
    return _cartView(_channel(body['channel']), account);
  }

  Map<String, dynamic> _cartView(String channel, Map<String, dynamic>? account) {
    Map<String, dynamic>? quote;
    Object? offer;
    String? problem;
    if (_cart.isNotEmpty) {
      try {
        for (final l in _cart) {
          final item = _item(l['itemId'] as String);
          if (item['soldOut'] == true) throw _Refused('${(item['name'] as Map)['en']} is sold out.', 'sold_out');
        }
        final priced = _quote(channel, _defaultAddressId(channel), account);
        quote = priced['quote'] as Map<String, dynamic>;
        offer = priced['offer'];
      } on _Refused catch (e) {
        problem = e.message;
      }
    }
    return {
      'currency': _currency,
      'lines': [
        for (final l in _cart)
          {
            'itemId': l['itemId'], 'qty': l['qty'], 'note': l['note'],
            'name': _items[l['itemId']]?['name'], 'unitMinor': _items[l['itemId']]?['priceMinor'], 'soldOut': _items[l['itemId']]?['soldOut'] ?? false,
          },
      ],
      'quote': quote,
      'offer': offer,
      'problem': problem,
    };
  }

  /// The address a delivery cart is priced for when none is chosen: the default (web/lib/orders.ts cartAddressId).
  String? _defaultAddressId(String channel) {
    if (channel != 'delivery') return null;
    return _addresses.where((a) => a['isDefault'] == true).firstOrNull?['id'] as String?;
  }

  int _subtotal(List<Map<String, dynamic>> lines) =>
      lines.fold(0, (sum, l) => sum + (_items[l['itemId']]!['priceMinor'] as int) * (l['qty'] as int));

  // ---- Offers (a port of web/lib/discounts.ts outcomeFor and offers-checkout.ts) ----

  Map<String, dynamic>? _rules(String offerId) => (_snap['rules'] as Map<String, dynamic>)[offerId] as Map<String, dynamic>?;

  int _usedByCustomer(String offerId, String? accountId) =>
      _redemptions.where((r) => r.offerId == offerId && (r.accountId == null || accountId == null || r.accountId == accountId)).length;

  ({bool applies, int discount, String label, String? reason}) _outcome(
      String offerId, int subtotal, int fee, String channel, Map<String, dynamic>? account) {
    final r = _rules(offerId);
    ({bool applies, int discount, String label, String? reason}) no(String why) => (applies: false, discount: 0, label: '', reason: why);
    if (r == null) return no(_notValid);
    final now = _now();
    if (r['active'] != true) return no('This offer is not running.');
    final campaign = r['campaignStatus'] as String?;
    if (campaign != null && campaign != 'active' && campaign != 'scheduled') return no('This offer is not running.');
    if (now.isBefore(DateTime.parse(r['startsAt'] as String))) return no('This offer has not started yet.');
    if (now.isAfter(DateTime.parse(r['endsAt'] as String))) return no('This offer has ended.');
    final type = r['type'] as String;
    if (!['percent', 'fixed', 'free_delivery'].contains(type)) return no('This kind of offer is not available yet.');
    final audience = r['audience'] as String;
    if (audience == 'guest' && account != null) return no('This offer is for guests only.');
    // The demo has no membership sign-up, so a members-only offer cannot apply.
    if (audience == 'member') return no('This offer is for members.');
    final limit = r['usageLimit'] as int?;
    if (limit != null && (r['usedCount'] as int) + (_offerUses[offerId] ?? 0) >= limit) return no('This offer has been used up.');
    final perCustomer = r['perCustomerLimit'] as int?;
    if (perCustomer != null && _usedByCustomer(offerId, account?['id'] as String?) >= perCustomer) {
      return no('You have used this offer as many times as it allows.');
    }
    final min = r['minSubtotalMinor'] as int;
    if (subtotal < min) return no('Add ${((min - subtotal) / 100).toStringAsFixed(2)} AED more to use this offer.');
    if (type == 'free_delivery') {
      if (channel != 'delivery') return no('This offer is for delivery orders.');
      if (fee <= 0) return no('Choose a delivery address with a delivery fee to use this offer.');
      return (applies: true, discount: fee, label: 'Free delivery', reason: null);
    }
    final appliesTo = r['appliesTo'] as String;
    final ids = (r['appliesToIds'] as List<dynamic>).cast<String>();
    final eligible = _cart
        .where((l) => appliesTo == 'order' || (appliesTo == 'item' ? ids.contains(l['itemId']) : ids.contains(_items[l['itemId']]!['categoryId'])))
        .fold<int>(0, (s, l) => s + (_items[l['itemId']]!['priceMinor'] as int) * (l['qty'] as int));
    if (eligible == 0) return no('This offer does not apply to the items in your cart.');
    final value = r['value'] as int;
    int amount;
    String label;
    if (type == 'percent') {
      amount = (eligible * value / 10000).round();
      final cap = r['maxDiscountMinor'] as int?;
      if (cap != null) amount = min_(amount, cap);
      final pct = value / 100;
      label = '${pct == pct.roundToDouble() ? pct.toInt() : pct}% off';
    } else {
      amount = min_(value, eligible);
      label = '${(value / 100).toStringAsFixed(2)} AED off';
    }
    amount = min_(amount, eligible);
    if (amount <= 0) return no('This offer gives no discount on your cart.');
    return (applies: true, discount: amount, label: label, reason: null);
  }

  static int min_(int a, int b) => a < b ? a : b;

  /// Turns a typed code into an offer or a voucher, the way web/lib/discounts.ts resolveCode does.
  ({String offerId, String? voucherCode}) _resolveCode(Object? raw) {
    final code = (raw is String ? raw : '').trim().toUpperCase().replaceAll(RegExp(r'\s+'), '');
    if (!RegExp(r'^[A-Z0-9-]{4,30}$').hasMatch(code)) throw const _Refused('A code is 4 to 30 letters, digits or dashes.', 'bad_input', 400);
    final voucher = _vouchers[code];
    if (voucher != null) {
      if (voucher['status'] == 'redeemed') throw const _Refused('This voucher has already been used.', 'used', 409);
      if (DateTime.parse(voucher['expiresAt'] as String).isBefore(_now())) throw const _Refused('This voucher has expired.', 'expired', 409);
      return (offerId: voucher['offerId'] as String, voucherCode: code);
    }
    for (final o in _snap['offers'] as List<dynamic>) {
      final offer = o as Map<String, dynamic>;
      if ((offer['code'] as String).toUpperCase() == code) return (offerId: offer['id'] as String, voucherCode: null);
    }
    throw const _Refused(_notValid, 'not_valid');
  }

  Map<String, dynamic> _applyCode(Map<String, dynamic> body, Map<String, dynamic>? account) {
    if (_cart.isEmpty) throw const _Refused('Add something to your cart first.', 'empty_cart');
    final channel = _channel(body['channel']);
    final resolved = _resolveCode(body['code']);
    final addressId = _defaultAddressId(channel);
    final fee = _feeFor(channel, addressId);
    final outcome = _outcome(resolved.offerId, _subtotal(_cart), fee, channel, account);
    if (!outcome.applies) throw _Refused(outcome.reason!, 'offer_not_applicable');
    _applied = resolved;
    final priced = _quote(channel, addressId, account);
    return {'offer': priced['offer'], 'quote': priced['quote'], 'currency': _currency};
  }

  // ---- Pricing (web/lib/pricing.ts computeQuote; prices include tax) ----

  int _feeFor(String channel, String? addressId) {
    if (channel != 'delivery' || addressId == null) return 0;
    final zone = _zoneOfAddress(addressId);
    return zone == null ? 0 : zone['feeMinor'] as int;
  }

  Map<String, dynamic> _priced(int subtotal, int fee, int discount) {
    final service = _restaurant['serviceFeeMinor'] as int;
    final total = subtotal + fee + service - discount;
    final bp = _restaurant['taxBasisPoints'] as int;
    return {
      'currency': _currency, 'subtotalMinor': subtotal, 'deliveryFeeMinor': fee, 'serviceFeeMinor': service,
      'discountMinor': discount, 'tipMinor': 0, 'totalMinor': total, 'taxLabel': _restaurant['taxLabel'],
      'taxBasisPoints': bp, 'taxIncludedMinor': (total * bp / (10000 + bp)).round(),
    };
  }

  Map<String, dynamic> _quote(String channel, String? addressId, Map<String, dynamic>? account) {
    final zone = channel == 'delivery' && addressId != null ? _zoneOfAddress(addressId) : null;
    final fee = zone == null ? 0 : zone['feeMinor'] as int;
    final subtotal = _subtotal(_cart);
    Map<String, dynamic>? offer;
    var discount = 0;
    final applied = _applied;
    if (applied != null) {
      final o = _outcome(applied.offerId, subtotal, fee, channel, account);
      if (o.applies) discount = o.discount;
      offer = {
        'applied': o.applies,
        'label': o.applies ? o.label : null,
        'reason': o.reason,
        'discountMinor': discount,
        'kind': applied.voucherCode == null ? 'offer' : 'voucher',
      };
    }
    return {
      'quote': _priced(subtotal, fee, discount),
      'delivery': zone == null
          ? null
          : {'zoneId': zone['id'], 'zoneName': zone['name'], 'minOrderMinor': zone['minOrderMinor'], 'deliverable': subtotal >= (zone['minOrderMinor'] as int)},
      'offer': offer,
    };
  }

  // ---- Orders (web/lib/orders.ts placeOrder) ----

  _Order _place(Map<String, dynamic> body, Map<String, dynamic>? account) {
    final key = body['idempotencyKey'];
    if (key is! String || key.length < 8) throw const _Refused('Send an idempotency key.', 'bad_input', 400);
    final repeat = _orderKeys[key];
    if (repeat != null) return _orders.firstWhere((o) => o.id == repeat);
    if (_cart.isEmpty) throw const _Refused('Your cart is empty.', 'empty_cart');
    for (final l in _cart) {
      final item = _items[l['itemId']];
      if (item == null) throw const _Refused('An item in the cart is no longer on the menu.', 'item_missing');
      if (item['soldOut'] == true) throw _Refused('${(item['name'] as Map)['en']} is sold out.', 'sold_out');
    }
    final channel = _channel(body['channel']);
    final method = body['method'];
    final payments = _restaurant['payments'] as Map<String, dynamic>;
    final methodOk = (method == 'card' && payments['card'] == true) ||
        (method == 'cod' && payments['cod'] == true && channel == 'delivery') ||
        (method == 'pay_on_arrival' && payments['payOnArrival'] == true && channel == 'pickup');
    if (!methodOk) throw const _Refused('That payment method is not available for this order.', 'method_unavailable');

    Map<String, dynamic>? address;
    Map<String, dynamic>? zone;
    if (channel == 'delivery') {
      final id = body['addressId'];
      if (id is! String) throw const _Refused('Choose a delivery address.', 'address_missing', 400);
      address = _addresses.where((a) => a['id'] == id).firstOrNull;
      if (address == null) throw const _Refused('That address is not on your account.', 'address_missing');
      zone = _zoneOfAddress(id);
      if (zone == null) throw const _Refused('We do not deliver to that address.', 'outside_zone');
    }
    final subtotal = _subtotal(_cart);
    if (zone != null && subtotal < (zone['minOrderMinor'] as int)) {
      throw const _Refused('This area needs a larger order before delivery.', 'below_minimum');
    }
    final priced = _quote(channel, address?['id'] as String?, account);
    final offer = priced['offer'] as Map<String, dynamic>?;
    if (offer != null && offer['applied'] != true) {
      throw _Refused('Your code no longer applies: ${offer['reason'] ?? 'please remove it'}', 'offer_not_applicable', 409);
    }
    final quote = priced['quote'] as Map<String, dynamic>;
    final cashLimit = _restaurant['cashLimitMinor'] as int?;
    if (method != 'card' && cashLimit != null && (quote['totalMinor'] as int) > cashLimit) {
      throw _Refused('Orders paid in cash can be up to $_currency ${(cashLimit / 100).toStringAsFixed(2)}. Remove something to continue.', 'over_cash_limit');
    }
    final applied = _applied;
    if (applied != null) {
      // Cash and pay-on-arrival orders are confirmed by being placed, so the code is used now.
      if (applied.voucherCode != null) {
        _vouchers[applied.voucherCode]!['status'] = 'redeemed';
      } else {
        _offerUses[applied.offerId] = (_offerUses[applied.offerId] ?? 0) + 1;
      }
      _redemptions.add((offerId: applied.offerId, accountId: account?['id'] as String?));
    }
    final order = _Order(
      id: _uuid('o'),
      number: '${++_orderNumber}',
      channel: channel,
      method: method as String,
      lines: [
        for (final l in _cart) {'itemId': l['itemId'], 'name': _items[l['itemId']]!['name'], 'qty': l['qty'], 'note': l['note'], 'unitMinor': _items[l['itemId']]!['priceMinor']},
      ],
      quote: quote,
      placedAt: _now(),
      address: address == null ? null : [address['line1'], address['line2']].where((s) => (s as String).isNotEmpty).join(', '),
    );
    _orders.add(order);
    _orderKeys[key] = order.id;
    _cart.clear();
    _applied = null;
    return order;
  }

  Map<String, dynamic> _orderView(_Order o) {
    final now = _now();
    return {
      'id': o.id, 'number': o.number, 'channel': o.channel, 'method': o.method, 'status': o.status(now), 'etaMinutes': o.etaMinutes(now),
      'lines': [for (final l in o.lines) {'name': l['name'], 'qty': l['qty'], 'note': l['note'], 'unitMinor': l['unitMinor']}],
      'quote': o.quote, 'address': o.address, 'history': o.history(now),
      'rating': _ratings[o.id] == null ? null : {'stars': _ratings[o.id], 'comment': ''},
    };
  }

  // Order ratings, as lib/ratings.ts: the owner rates a delivered or collected order from 1 to 5; again replaces it.
  final Map<String, int> _ratings = {};
  Map<String, dynamic> _rate(String id, Map<String, dynamic> body) {
    final order = _orders.where((o) => o.id == id).firstOrNull;
    if (order == null) throw const _Refused('Order not found.', 'not_found', 404);
    final stars = body['stars'];
    if (stars is! int || stars < 1 || stars > 5) throw const _Refused('Choose from 1 to 5 stars.', 'bad_input', 400);
    if (!const {'delivered', 'collected'}.contains(order.status(_now()))) throw const _Refused('You can rate an order once it has reached you.', 'not_finished', 409);
    _ratings[id] = stars;
    return {'stars': stars, 'comment': ''};
  }

  Map<String, dynamic> _historyView(_Order o) => {
        'id': o.id, 'number': o.number, 'status': o.status(_now()), 'channel': o.channel,
        'placedAt': o.placedAt.toUtc().toIso8601String(), 'totalMinor': o.quote['totalMinor'], 'currency': _currency,
        'items': [for (final l in o.lines) {'name': l['name'], 'qty': l['qty']}],
        'ratingStars': _ratings[o.id],
      };

  Map<String, dynamic> _reorder(String id) {
    final order = _orders.where((o) => o.id == id).firstOrNull;
    if (order == null) throw const _Refused('Order not found.', 'not_found', 404);
    final added = <String>[];
    final skipped = <String>[];
    for (final l in order.lines) {
      final item = _items[l['itemId']];
      final name = (l['name'] as Map)['en'] as String;
      if (item == null || item['soldOut'] == true) {
        skipped.add(name);
        continue;
      }
      final existing = _cart.where((c) => c['itemId'] == item['id']).firstOrNull;
      final qty = min_(_maxCartQty, ((existing?['qty'] as int?) ?? 0) + (l['qty'] as int));
      if (existing != null) {
        existing['qty'] = qty;
      } else {
        _cart.add({'itemId': item['id'], 'qty': qty, 'note': ''});
      }
      added.add(name);
    }
    return {'added': added, 'skipped': skipped};
  }

  // ---- Home and favourites (web/lib/customer.ts) ----

  Map<String, dynamic> _card(Map<String, dynamic> item, int times) =>
      {'id': item['id'], 'name': item['name'], 'priceMinor': item['priceMinor'], 'soldOut': item['soldOut'], 'imageUrl': null, 'timesOrdered': times};

  Map<String, dynamic> _home() {
    final counts = <String, int>{};
    final last = <String, DateTime>{};
    final now = _now();
    for (final o in _orders.where((o) => !['cancelled', 'rejected'].contains(o.status(now)))) {
      for (final l in o.lines) {
        final id = l['itemId'] as String;
        counts[id] = (counts[id] ?? 0) + (l['qty'] as int);
        last[id] = o.placedAt;
      }
    }
    final frequent = counts.keys.where(_items.containsKey).toList()
      ..sort((a, b) => counts[b]!.compareTo(counts[a]!) != 0 ? counts[b]!.compareTo(counts[a]!) : last[b]!.compareTo(last[a]!));
    return {
      'lastOrder': _orders.isEmpty ? null : _historyView(_orders.last),
      'frequent': [for (final id in frequent.take(5)) _card(_items[id]!, counts[id]!)],
      'favourites': [for (final id in _favourites.reversed) if (_items[id] != null) _card(_items[id]!, 0)],
    };
  }

  void _setFavourite(String itemId, bool on) {
    if (on) {
      if (!_items.containsKey(itemId)) throw const _Refused('That dish is not on the menu.', 'item_missing', 404);
      if (!_favourites.contains(itemId)) _favourites.add(itemId);
    } else {
      _favourites.remove(itemId);
    }
  }

  // ---- Addresses and delivery areas (web/lib/orders.ts validateAddress, resolveZone; web/lib/data.ts) ----

  List<Map<String, dynamic>> get _zones => (_snap['zones'] as List<dynamic>).cast<Map<String, dynamic>>().where((z) => z['active'] == true).toList();

  Map<String, dynamic>? _zoneOfAddress(String addressId) {
    final a = _addresses.where((a) => a['id'] == addressId).firstOrNull;
    return a == null ? null : _zones.where((z) => z['id'] == a['zoneId']).firstOrNull;
  }

  /// Whether a point is inside an area's outline (ray casting over [longitude, latitude] pairs).
  static bool _inside(List<dynamic> polygon, double lat, double lng) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = (polygon[i][0] as num).toDouble(), yi = (polygon[i][1] as num).toDouble();
      final xj = (polygon[j][0] as num).toDouble(), yj = (polygon[j][1] as num).toDouble();
      if ((yi > lat) != (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  Map<String, dynamic> _zoneListView(Map<String, dynamic> z) {
    final ring = (z['polygon'] as List<dynamic>);
    // The outline repeats its first corner at the end; the centre is the average of the corners.
    final corners = ring.length > 1 && ring.first[0] == ring.last[0] && ring.first[1] == ring.last[1] ? ring.sublist(0, ring.length - 1) : ring;
    final lat = corners.fold<double>(0, (s, p) => s + (p[1] as num)) / corners.length;
    final lng = corners.fold<double>(0, (s, p) => s + (p[0] as num)) / corners.length;
    return {'id': z['id'], 'name': z['name'], 'feeMinor': z['feeMinor'], 'minOrderMinor': z['minOrderMinor'], 'centre': {'lat': lat, 'lng': lng}};
  }

  Map<String, dynamic> _addressView(Map<String, dynamic> a) {
    final zone = _zones.where((z) => z['id'] == a['zoneId']).firstOrNull;
    return {
      'id': a['id'], 'label': a['label'], 'line1': a['line1'], 'line2': a['line2'], 'notes': a['notes'], 'isDefault': a['isDefault'],
      'lat': a['lat'], 'lng': a['lng'],
      'zone': zone == null ? null : {'id': zone['id'], 'name': zone['name'], 'feeMinor': zone['feeMinor'], 'minOrderMinor': zone['minOrderMinor'], 'active': true},
    };
  }

  Map<String, dynamic> _saveAddress(Map<String, dynamic> body) {
    String text(String key, int max) {
      final v = body[key] is String ? (body[key] as String).trim() : '';
      return v.length > max ? v.substring(0, max) : v;
    }

    final line1 = text('line1', 200);
    if (line1.length < 3) throw const _Refused('Enter the street, building and area.', 'bad_input', 400);
    final hasLat = body['lat'] != null, hasLng = body['lng'] != null;
    if (hasLat != hasLng) throw const _Refused('Send both latitude and longitude, or neither.', 'bad_input', 400);
    final lat = hasLat ? (body['lat'] as num).toDouble() : null;
    final lng = hasLng ? (body['lng'] as num).toDouble() : null;
    if (lat != null && lat.abs() > 90) throw const _Refused('The latitude is not valid.', 'bad_input', 400);
    if (lng != null && lng.abs() > 180) throw const _Refused('The longitude is not valid.', 'bad_input', 400);
    if (_addresses.length >= _maxSavedAddresses) {
      throw const _Refused('You can save up to $_maxSavedAddresses addresses. Delete one to add another.', 'address_limit');
    }
    String zoneId;
    if (lat != null && lng != null) {
      final zone = _zones.where((z) => _inside(z['polygon'] as List<dynamic>, lat, lng)).firstOrNull;
      if (zone == null) throw const _Refused('We do not deliver to this address yet.', 'outside_zone');
      zoneId = zone['id'] as String;
    } else {
      final picked = text('zoneId', 40);
      if (picked.isEmpty) throw const _Refused('Choose a delivery area for this address.', 'zone_required');
      if (!_zones.any((z) => z['id'] == picked)) throw const _Refused('Choose one of the delivery areas.', 'zone_missing');
      zoneId = picked;
    }
    final isDefault = body['isDefault'] == true || _addresses.isEmpty;
    if (isDefault) {
      for (final a in _addresses) {
        a['isDefault'] = false;
      }
    }
    final address = {
      'id': _uuid('a'), 'label': text('label', 30).isEmpty ? 'Home' : text('label', 30), 'line1': line1, 'line2': text('line2', 200),
      'notes': text('notes', 200), 'zoneId': zoneId, 'lat': lat, 'lng': lng, 'isDefault': isDefault,
    };
    _addresses.add(address);
    return address;
  }

  void _deleteAddress(String id) {
    final index = _addresses.indexWhere((a) => a['id'] == id);
    if (index < 0) throw const _Refused('Address not found.', 'not_found', 404);
    final wasDefault = _addresses.removeAt(index)['isDefault'] == true;
    // Like the API, the newest remaining address becomes the default.
    if (wasDefault && _addresses.isNotEmpty) _addresses.last['isDefault'] = true;
  }

  // ---- Wallet (web/lib/wallet.ts) ----

  Map<String, dynamic> _walletEntry(Map<String, dynamic> v) {
    final expired = DateTime.parse(v['expiresAt'] as String).isBefore(_now());
    return {
      'voucherId': v['voucherId'], 'state': v['status'] == 'redeemed' ? 'used' : expired ? 'expired' : 'available',
      'discount': v['discount'], 'campaign': v['campaign'], 'minOrderMinor': v['minOrderMinor'], 'currency': v['currency'],
      'expiresAt': v['expiresAt'],
    };
  }

  Map<String, dynamic> _walletView(Map<String, dynamic> account) {
    final ids = _wallets[account['id']] ?? {};
    final entries = [for (final v in _vouchers.values) if (ids.contains(v['voucherId'])) _walletEntry(v)];
    return {
      'available': entries.where((e) => e['state'] == 'available').toList(),
      'used': entries.where((e) => e['state'] == 'used').toList(),
      'expired': entries.where((e) => e['state'] == 'expired').toList(),
    };
  }

  Map<String, dynamic> _saveVoucher(Map<String, dynamic> account, Object? raw) {
    final code = (raw is String ? raw : '').trim().toUpperCase().replaceAll(RegExp(r'\s+'), '');
    final v = _vouchers[code];
    if (v == null) throw const _Refused(_notValid, 'not_valid');
    if (v['status'] == 'redeemed') throw const _Refused('This voucher has already been used.', 'used', 409);
    if (DateTime.parse(v['expiresAt'] as String).isBefore(_now())) throw const _Refused('This voucher has expired.', 'expired', 409);
    (_wallets[account['id'] as String] ??= {}).add(v['voucherId'] as String);
    return _walletEntry(v);
  }

  // ---- Sign-in (web/lib/accounts.ts and web/app/v1/auth) ----

  String? _token(http.Request request) {
    final header = request.headers['authorization'] ?? request.headers['Authorization'];
    return header != null && header.startsWith('Bearer ') ? header.substring(7) : null;
  }

  Map<String, dynamic>? _accountOf(http.Request request) {
    final id = _sessions[_token(request)];
    return id == null ? null : _accounts.values.where((a) => a['id'] == id).firstOrNull;
  }

  Map<String, dynamic> _signedIn(Map<String, dynamic>? account) => account ?? (throw const _Refused('Sign in first.', 'unauthorised', 401));

  static String _phone(Object? raw) {
    final cleaned = (raw is String ? raw : '').replaceAll(RegExp(r'[\s()-]'), '');
    if (!RegExp(r'^\+[1-9][0-9]{7,14}$').hasMatch(cleaned)) {
      throw const _Refused('Enter the mobile number with its country code, like +971 50 123 4567.', 'bad_phone', 400);
    }
    return cleaned;
  }

  static String _mask(String target) {
    if (target.contains('@')) {
      final [user, domain] = target.split('@');
      return '${user.substring(0, min(2, user.length))}${'•' * max(2, user.length - 2)}@$domain';
    }
    return '${target.substring(0, 4)} ${'•' * max(3, target.length - 7)}${target.substring(target.length - 3)}';
  }

  Map<String, dynamic> _challenge(String purpose, String target, {String? name, String? accountId, String? phone}) {
    final now = _now();
    final recent = _challenges.values.where((c) => c.target == target && c.purpose == purpose).toList();
    if (recent.isNotEmpty) {
      final age = now.difference(recent.last.expiresAt.subtract(_codeTtl));
      if (age < _resendCooldown) {
        throw _Refused('Wait ${(_resendCooldown - age).inSeconds + 1} seconds before asking for another code.', 'cooldown', 429);
      }
    }
    final code = _random.nextInt(1000000).toString().padLeft(6, '0');
    final c = _Challenge(id: _uuid('c'), purpose: purpose, target: target, code: code, expiresAt: now.add(_codeTtl), name: name, accountId: accountId, phone: phone);
    _challenges[c.id] = c;
    final restaurant = (_restaurant['name'] as Map)['en'];
    inbox.value = DemoMessage(to: target, text: '$code is your $restaurant code. It expires in ${_codeTtl.inMinutes} minutes.', at: now);
    return {'challengeId': c.id, 'sentTo': _mask(target), 'resendInSeconds': _resendCooldown.inSeconds};
  }

  _Challenge _check(Map<String, dynamic> body, String purpose) {
    final id = body['challengeId'], code = body['code'];
    if (id is! String || code is! String || !RegExp(r'^\d{6}$').hasMatch(code)) throw const _Refused('Enter the 6-digit code.', 'bad_code', 400);
    final c = _challenges[id];
    if (c == null || c.purpose != purpose || c.consumed) throw const _Refused('This code is no longer valid. Ask for a new one.', 'code_used', 410);
    if (c.expiresAt.isBefore(_now())) throw const _Refused('This code has expired. Ask for a new one.', 'code_expired', 410);
    if (c.attempts >= _maxAttempts) throw const _Refused('Too many wrong codes. Ask for a new one.', 'too_many_attempts', 429);
    if (c.code != code) {
      c.attempts++;
      final left = _maxAttempts - c.attempts;
      throw _Refused(left > 0 ? 'That code is wrong. $left tries left.' : 'That code is wrong. Ask for a new one.', 'wrong_code');
    }
    c.consumed = true;
    return c;
  }

  Map<String, dynamic> _session(Map<String, dynamic> account) {
    final token = List.generate(32, (_) => _random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    _sessions[token] = account['id'] as String;
    return {'token': token, 'account': account};
  }

  Map<String, dynamic> _signupStart(Map<String, dynamic> body) {
    final name = (body['name'] is String ? body['name'] as String : '').trim().replaceAll(RegExp(r'\s+'), ' ');
    if (name.length < 2 || name.length > 80) throw const _Refused('Enter your name (2 to 80 characters).', 'bad_name', 400);
    final phone = _phone(body['phone']);
    if (_accounts.containsKey(phone)) throw const _Refused('This number already has an account. Sign in instead.', 'phone_registered', 409);
    return _challenge('signup_phone', phone, name: name);
  }

  Map<String, dynamic> _signupVerify(Map<String, dynamic> body) {
    final c = _check(body, 'signup_phone');
    if (_accounts.containsKey(c.target)) throw const _Refused('This number already has an account. Sign in instead.', 'phone_registered', 409);
    final account = {'id': _uuid('u'), 'name': c.name, 'phone': c.target, 'email': null, 'emailVerified': false};
    _accounts[c.target] = account;
    return _session(account);
  }

  Map<String, dynamic> _loginStart(Map<String, dynamic> body) {
    final phone = _phone(body['phone']);
    final account = _accounts[phone];
    if (account == null) throw const _Refused('No account uses this number. Create one first.', 'no_account', 404);
    return _challenge('login_phone', phone, accountId: account['id'] as String);
  }

  Map<String, dynamic> _loginVerify(Map<String, dynamic> body) {
    final c = _check(body, 'login_phone');
    final account = _accounts[c.target];
    if (account == null) throw const _Refused('No account uses this number.', 'no_account', 404);
    return _session(account);
  }

  static String _email(Object? value) {
    final email = (value is String ? value : '').trim().toLowerCase();
    if (email.length > 254 || !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email)) throw const _Refused('Enter a valid email address.', 'bad_email', 400);
    return email;
  }

  Map<String, dynamic>? _accountByEmail(String email) => _accounts.values.where((a) => a['email'] == email && a['emailVerified'] == true).firstOrNull;

  // Sign-up by email, as on the server: name, mobile and email, then the code sent to the email.
  Map<String, dynamic> _signupEmailStart(Map<String, dynamic> body) {
    final name = (body['name'] is String ? body['name'] as String : '').trim().replaceAll(RegExp(r'\s+'), ' ');
    if (name.length < 2 || name.length > 80) throw const _Refused('Enter your name (2 to 80 characters).', 'bad_name', 400);
    final phone = _phone(body['phone']);
    final email = _email(body['email']);
    if (_accountByEmail(email) != null) throw const _Refused('This email already has an account. Sign in instead.', 'email_registered', 409);
    if (_accounts.containsKey(phone)) throw const _Refused('This number already has an account. Sign in instead.', 'phone_registered', 409);
    return _challenge('signup_email', email, name: name, phone: phone);
  }

  Map<String, dynamic> _signupEmailVerify(Map<String, dynamic> body) {
    final c = _check(body, 'signup_email');
    if (_accountByEmail(c.target) != null || _accounts.containsKey(c.phone)) {
      throw const _Refused('This email or number already has an account. Sign in instead.', 'already_registered', 409);
    }
    final account = {'id': _uuid('u'), 'name': c.name, 'phone': c.phone, 'email': c.target, 'emailVerified': true};
    _accounts[c.phone!] = account;
    return _session(account);
  }

  Map<String, dynamic> _loginEmailStart(Map<String, dynamic> body) {
    final email = _email(body['email']);
    final account = _accountByEmail(email);
    if (account == null) throw const _Refused('No account uses this email. Create one first.', 'no_account', 404);
    return _challenge('login_email', email, accountId: account['id'] as String);
  }

  Map<String, dynamic> _loginEmailVerify(Map<String, dynamic> body) {
    final c = _check(body, 'login_email');
    final account = _accountByEmail(c.target);
    if (account == null) throw const _Refused('No account uses this email.', 'no_account', 404);
    return _session(account);
  }

  Map<String, dynamic> _emailStart(Map<String, dynamic> account, Map<String, dynamic> body) {
    final email = (body['email'] is String ? body['email'] as String : '').trim().toLowerCase();
    if (email.length > 254 || !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email)) throw const _Refused('Enter a valid email address.', 'bad_email', 400);
    if (_accounts.values.any((a) => a['email'] == email && a['id'] != account['id'])) {
      throw const _Refused('That email is already used by another account.', 'email_taken', 409);
    }
    return _challenge('verify_email', email, accountId: account['id'] as String);
  }

  Map<String, dynamic> _emailVerify(Map<String, dynamic> account, Map<String, dynamic> body) {
    final c = _check(body, 'verify_email');
    if (c.accountId != account['id']) throw const _Refused('This code is for another account.', 'forbidden', 403);
    account['email'] = c.target;
    account['emailVerified'] = true;
    return account;
  }

  http.Response _ok(Object body) => _json(body, 200);

  http.Response _json(Object body, int status) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json; charset=utf-8'});
}
