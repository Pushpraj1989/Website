// The app's demo mode: a small server that lives inside the app, so the app can be tried without the real API.
// Build with --dart-define=DEMO=true. The menu, codes and rules mirror the staging pilot: WELCOME10, FREEDEL and an
// AED 5 voucher in the wallet; cash on delivery and pay on arrival only. Everything resets when the app restarts.
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _currency = 'AED';
const _zone = {'id': 'z1', 'name': {'en': 'Central', 'ar': 'الوسط'}, 'feeMinor': 1000, 'minOrderMinor': 2000, 'active': true};

class _Item {
  const _Item(this.id, this.category, this.en, this.ar, this.descEn, this.descAr, this.price, {this.soldOut = false});
  final String id;
  final String category;
  final String en;
  final String ar;
  final String descEn;
  final String descAr;
  final int price;
  final bool soldOut;
  Map<String, String> get name => {'en': en, 'ar': ar};
}

const _items = [
  _Item('i1', 'c1', 'Garden salad', 'سلطة الحديقة', 'Crisp leaves, tomato, cucumber and lemon.', 'أوراق خضراء طازجة وطماطم وخيار وليمون.', 1800),
  _Item('i2', 'c1', 'Lentil soup', 'شوربة العدس', 'Red lentils, cumin and a squeeze of lemon.', 'عدس أحمر وكمون وعصرة ليمون.', 1500),
  _Item('i3', 'c2', 'Grilled chicken plate', 'طبق دجاج مشوي', 'Rice, salad and garlic sauce.', 'أرز وسلطة وصلصة الثوم.', 4500),
  _Item('i4', 'c2', 'Vegetable stew', 'يخنة الخضار', 'Slow-cooked vegetables with rice.', 'خضار مطهوة ببطء مع الأرز.', 3800),
  _Item('i5', 'c2', 'Beef kebab', 'كباب لحم', 'Charcoal grilled, with bread.', 'مشوي على الفحم مع الخبز.', 5200, soldOut: true),
  _Item('i6', 'c3', 'Mint lemonade', 'ليمونادة بالنعناع', 'Fresh lemon and mint.', 'ليمون طازج ونعناع.', 1200),
  _Item('i7', 'c3', 'Still water', 'مياه معدنية', '500 ml.', '٥٠٠ مل.', 500),
];

const _categories = [
  {'id': 'c1', 'illustration': 'starters', 'name': {'en': 'Starters', 'ar': 'المقبلات'}},
  {'id': 'c2', 'illustration': 'mains', 'name': {'en': 'Mains', 'ar': 'الأطباق الرئيسية'}},
  {'id': 'c3', 'illustration': 'drinks', 'name': {'en': 'Drinks', 'ar': 'المشروبات'}},
];

// Order states and when each is reached, in seconds after the order is placed.
const _timeline = [('placed', 0), ('accepted', 10), ('preparing', 25), ('ready', 70), ('out_for_delivery', 95), ('delivered', 150)];
const _pickupTimeline = [('placed', 0), ('accepted', 10), ('preparing', 25), ('ready', 70), ('collected', 150)];

class _Order {
  _Order(this.id, this.number, this.channel, this.method, this.lines, this.quote, this.placedAt, this.address);
  final String id;
  final String number;
  final String channel;
  final String method;
  final List<Map<String, dynamic>> lines;
  final Map<String, dynamic> quote;
  final DateTime placedAt;
  final String? address;

  List<Map<String, String>> history(DateTime now) {
    final seconds = now.difference(placedAt).inSeconds;
    return [
      for (final (status, at) in channel == 'pickup' ? _pickupTimeline : _timeline)
        if (seconds >= at) {'status': status, 'at': placedAt.add(Duration(seconds: at)).toUtc().toIso8601String()},
    ];
  }

  String status(DateTime now) => history(now).last['status']!;
}

/// The demo server. [client] answers the app's requests the way the real API does.
class DemoServer {
  DemoServer({DateTime Function()? clock}) : _now = clock ?? DateTime.now {
    // One finished order, so the home screen has a last order to reorder and the orders tab is not empty.
    final past = _now().subtract(const Duration(days: 2));
    final lines = [_line('i3', 2), _line('i6', 1)];
    _orders.add(_Order('o1', 'R-0028', 'delivery', 'cod', lines, _priced(lines, 'delivery', 0), past, '12 Example Street, Dubai'));
  }

  final DateTime Function() _now;
  final List<Map<String, dynamic>> _cart = [];
  String? _code;
  final Set<String> _favourites = {'i1'};
  final Set<String> _usedCodes = {};
  final List<_Order> _orders = [];
  final Map<String, String> _keys = {};
  final List<Map<String, dynamic>> _addresses = [
    {'id': 'a1', 'label': 'Home', 'line1': '12 Example Street, Dubai', 'line2': 'Flat 4', 'notes': '', 'isDefault': true, 'zone': _zone},
  ];
  final List<Map<String, dynamic>> _wallet = [
    {'voucherId': 'v1', 'code': 'PLT-2048-KD', 'state': 'available', 'discount': 'AED 5.00 off', 'campaign': 'AED 5 vouchers', 'minOrderMinor': 2500, 'currency': _currency, 'expiresAt': '2026-11-29T20:00:00Z'},
  ];

  late final http.Client client = MockClient(_handle);

  Future<http.Response> _handle(http.Request request) async {
    // A short wait, so loading states show the way they would on a phone network.
    await Future<void>.delayed(const Duration(milliseconds: 180));
    final path = request.url.path;
    final method = request.method;
    final body = request.body.isEmpty ? <String, dynamic>{} : jsonDecode(request.body) as Map<String, dynamic>;
    try {
      return switch ((method, path)) {
        ('GET', '/v1/menu') => _ok(_menu()),
        ('GET', '/v1/cart') => _ok(_cartView(request.url.queryParameters['channel'] ?? 'delivery')),
        ('PUT', '/v1/cart') => _saveCart(body),
        ('PUT', '/v1/cart/offer') => _applyCode(body),
        ('DELETE', '/v1/cart/offer') => _clearCode(),
        ('POST', '/v1/checkout/quote') => _ok(_quote(body['channel'] as String? ?? 'delivery', body['addressId'] as String?)),
        ('POST', '/v1/orders') => _place(body),
        ('GET', '/v1/orders') => _ok({'orders': [for (final o in _orders.reversed) _historyView(o)]}),
        ('GET', '/v1/addresses') => _ok({'addresses': _addresses}),
        ('POST', '/v1/addresses') => _addAddress(body),
        ('GET', '/v1/delivery-zones') => _ok({'zones': [{..._zone, 'centre': {'lat': 25.2, 'lng': 55.27}}]}),
        ('GET', '/v1/places/search') => _ok({'places': _places(request.url.queryParameters['q'] ?? '')}),
        ('GET', '/v1/places/reverse') => _ok({'place': {'label': 'Sheikh Zayed Road, Dubai', 'lat': 25.2, 'lng': 55.27}}),
        ('GET', '/v1/customer/home') => _ok(_home()),
        ('GET', '/v1/me/vouchers') => _ok(_walletView()),
        ('POST', '/v1/me/vouchers') => _saveVoucher(body),
        ('GET', '/v1/membership') => _ok(_membership),
        ('POST', '/v1/ai/ask') => _ok(_ask(body['message'] as String? ?? '')),
        ('GET', '/v1/auth/me') => _ok({'account': _account}),
        ('POST', '/v1/auth/logout') => _ok({}),
        _ => _other(method, path, body),
      };
    } on _Refused catch (e) {
      return _json({'error': {'code': e.code, 'message': e.message}}, e.status);
    }
  }

  http.Response _other(String method, String path, Map<String, dynamic> body) {
    final parts = path.split('/');
    if (path.startsWith('/v1/favourites/')) {
      method == 'PUT' ? _favourites.add(parts.last) : _favourites.remove(parts.last);
      return _ok({});
    }
    if (path.startsWith('/v1/me/vouchers/') && method == 'DELETE') {
      _wallet.removeWhere((v) => v['voucherId'] == parts.last);
      return _ok({});
    }
    if (path.startsWith('/v1/addresses/') && method == 'DELETE') {
      _addresses.removeWhere((a) => a['id'] == parts.last);
      return _ok({});
    }
    if (path.startsWith('/v1/orders/') && path.endsWith('/reorder')) return _reorder(parts[3]);
    if (path.startsWith('/v1/orders/')) {
      final order = _orders.where((o) => o.id == parts.last).firstOrNull;
      if (order == null) throw const _Refused('not_found', 'Order not found.', 404);
      return _ok({'order': _orderView(order)});
    }
    // Sign-in and sign-up: any six-digit code is accepted in the demo.
    if (path.startsWith('/v1/auth/') && path.endsWith('/verify')) return _json({'token': 'demo-token', 'account': _account}, 201);
    if (path.startsWith('/v1/auth/')) {
      return _ok({'challengeId': 'demo', 'sentTo': body['phone'] ?? body['email'] ?? 'you', 'resendInSeconds': 30});
    }
    throw const _Refused('not_found', 'Not found.', 404);
  }

  // ---- Menu and cart ----

  Map<String, dynamic> _menu() => {
        'restaurant': {'en': 'Sample Kitchen', 'ar': 'مطبخ تجريبي'},
        'currency': _currency,
        'payments': {'cod': true, 'payOnArrival': true, 'card': false},
        'offers': <dynamic>[],
        'categories': [
          for (final c in _categories)
            {
              ...c,
              'items': [
                for (final i in _items.where((i) => i.category == c['id']))
                  {'id': i.id, 'name': i.name, 'description': {'en': i.descEn, 'ar': i.descAr}, 'priceMinor': i.price, 'soldOut': i.soldOut, 'imageUrl': null},
              ],
            },
        ],
      };

  _Item _item(String id) => _items.firstWhere((i) => i.id == id, orElse: () => throw const _Refused('bad_input', 'That dish is not on the menu.', 400));

  Map<String, dynamic> _line(String id, int qty, [String note = '']) {
    final item = _item(id);
    return {'itemId': id, 'name': item.name, 'qty': qty, 'note': note, 'unitMinor': item.price, 'soldOut': item.soldOut};
  }

  http.Response _saveCart(Map<String, dynamic> body) {
    final lines = [for (final l in body['items'] as List<dynamic>) l as Map<String, dynamic>];
    final next = <Map<String, dynamic>>[];
    for (final l in lines) {
      final qty = l['qty'] as int;
      if (qty < 1 || qty > 20) throw const _Refused('bad_input', 'Choose 1 to 20 of each dish.', 400);
      next.add(_line(l['itemId'] as String, qty, l['note'] as String? ?? ''));
    }
    _cart
      ..clear()
      ..addAll(next);
    return _ok(_cartView(body['channel'] as String? ?? 'delivery'));
  }

  Map<String, dynamic> _cartView(String channel) {
    final soldOut = _cart.where((l) => l['soldOut'] == true).map((l) => (l['name'] as Map)['en']).toList();
    final priced = _quote(channel, _defaultAddress());
    return {
      'currency': _currency,
      'lines': _cart,
      'quote': _cart.isEmpty || soldOut.isNotEmpty ? null : priced['quote'],
      'offer': priced['offer'],
      'problem': soldOut.isEmpty ? null : '${soldOut.join(', ')} is sold out. Remove it to continue.',
    };
  }

  String? _defaultAddress() => _addresses.where((a) => a['isDefault'] == true).firstOrNull?['id'] as String?;

  int get _subtotal => _cart.fold(0, (sum, l) => sum + (l['unitMinor'] as int) * (l['qty'] as int));

  // ---- Codes, with the pilot's rules ----

  ({bool applies, int discount, String label, String? reason, String kind}) _outcome(String code, String channel, int subtotal, int fee) {
    switch (code) {
      case 'WELCOME10':
        if (_usedCodes.contains(code)) return (applies: false, discount: 0, label: '10% off', reason: 'You have used this offer as many times as it allows.', kind: 'offer');
        if (subtotal < 3000) return (applies: false, discount: 0, label: '10% off', reason: 'Add ${((3000 - subtotal) / 100).toStringAsFixed(2)} AED more to use this offer.', kind: 'offer');
        final amount = (subtotal * 0.10).round();
        return (applies: true, discount: amount > 2000 ? 2000 : amount, label: '10% off', reason: null, kind: 'offer');
      case 'FREEDEL':
        if (channel != 'delivery') return (applies: false, discount: 0, label: 'Free delivery', reason: 'This offer is for delivery orders.', kind: 'offer');
        if (fee <= 0) return (applies: false, discount: 0, label: 'Free delivery', reason: 'Choose a delivery address with a delivery fee to use this offer.', kind: 'offer');
        return (applies: true, discount: fee, label: 'Free delivery', reason: null, kind: 'offer');
      default:
        final voucher = _wallet.where((v) => v['code'] == code).firstOrNull;
        if (voucher == null || voucher['state'] != 'available') {
          return (applies: false, discount: 0, label: code, reason: voucher == null ? 'That code is not valid. Check it and try again.' : 'This voucher has already been used.', kind: 'voucher');
        }
        if (subtotal < 2500) return (applies: false, discount: 0, label: '5.00 AED off', reason: 'Add ${((2500 - subtotal) / 100).toStringAsFixed(2)} AED more to use this voucher.', kind: 'voucher');
        return (applies: true, discount: 500, label: '5.00 AED off', reason: null, kind: 'voucher');
    }
  }

  http.Response _applyCode(Map<String, dynamic> body) {
    if (_cart.isEmpty) throw const _Refused('empty_cart', 'Add something to your cart first.', 422);
    final code = (body['code'] as String? ?? '').trim().toUpperCase().replaceAll(' ', '');
    final channel = body['channel'] as String? ?? 'delivery';
    final known = code == 'WELCOME10' || code == 'FREEDEL' || _wallet.any((v) => v['code'] == code);
    if (!known) throw const _Refused('not_valid', 'That code is not valid. Check it and try again. Try WELCOME10 or FREEDEL.', 422);
    final fee = channel == 'delivery' && _defaultAddress() != null ? _zone['feeMinor'] as int : 0;
    final outcome = _outcome(code, channel, _subtotal, fee);
    if (!outcome.applies) throw _Refused('offer_not_applicable', outcome.reason!, 422);
    _code = code;
    return _ok({..._quote(channel, _defaultAddress()), 'currency': _currency});
  }

  http.Response _clearCode() {
    _code = null;
    return _ok({'offer': null});
  }

  Map<String, dynamic> _quote(String channel, String? addressId) {
    final address = _addresses.where((a) => a['id'] == addressId).firstOrNull;
    final fee = channel == 'delivery' && address != null ? _zone['feeMinor'] as int : 0;
    final subtotal = _subtotal;
    Map<String, dynamic>? offer;
    var discount = 0;
    if (_code != null) {
      final o = _outcome(_code!, channel, subtotal, fee);
      discount = o.applies ? o.discount : 0;
      offer = {'applied': o.applies, 'label': o.label, 'reason': o.reason, 'discountMinor': discount, 'kind': o.kind};
    }
    return {
      'quote': _priced(_cart, channel, fee, discount),
      'delivery': address == null ? null : {'zoneId': 'z1', 'zoneName': _zone['name'], 'minOrderMinor': 2000, 'deliverable': subtotal >= 2000},
      'offer': offer,
    };
  }

  Map<String, dynamic> _priced(List<Map<String, dynamic>> lines, String channel, int fee, [int discount = 0]) {
    final subtotal = lines.fold<int>(0, (s, l) => s + (l['unitMinor'] as int) * (l['qty'] as int));
    final total = subtotal + fee - discount;
    return {
      'currency': _currency, 'subtotalMinor': subtotal, 'deliveryFeeMinor': fee, 'serviceFeeMinor': 0, 'discountMinor': discount,
      'tipMinor': 0, 'totalMinor': total, 'taxLabel': 'VAT', 'taxBasisPoints': 500, 'taxIncludedMinor': (total * 5 / 105).round(),
    };
  }

  // ---- Orders ----

  http.Response _place(Map<String, dynamic> body) {
    final key = body['idempotencyKey'] as String? ?? '';
    final again = _keys[key];
    if (again != null) return _json({'order': _orderView(_orders.firstWhere((o) => o.id == again))}, 201);
    if (_cart.isEmpty) throw const _Refused('empty_cart', 'Your cart is empty.', 422);
    final channel = body['channel'] as String? ?? 'delivery';
    final method = body['method'] as String? ?? 'cod';
    if (method == 'card') throw const _Refused('payment_unavailable', 'Card payment is not available yet.', 422);
    if (method == 'pay_on_arrival' && channel != 'pickup') throw const _Refused('payment_unavailable', 'Pay on arrival is for pickup orders.', 422);
    final addressId = body['addressId'] as String?;
    final address = _addresses.where((a) => a['id'] == addressId).firstOrNull;
    if (channel == 'delivery' && address == null) throw const _Refused('address_required', 'Choose a delivery address.', 422);
    final priced = _quote(channel, addressId);
    final offer = priced['offer'] as Map<String, dynamic>?;
    if (offer != null && offer['applied'] != true) throw _Refused('offer_not_applicable', 'Your code no longer applies: ${offer['reason']}', 409);
    final id = 'o${_orders.length + 1}';
    final order = _Order(id, 'R-${(28 + _orders.length).toString().padLeft(4, '0')}', channel, method, [..._cart], priced['quote'] as Map<String, dynamic>,
        _now(), address == null ? null : '${address['line1']}');
    _orders.add(order);
    _keys[key] = id;
    if (_code != null) {
      _usedCodes.add(_code!);
      for (final v in _wallet.where((v) => v['code'] == _code)) {
        v['state'] = 'used';
      }
    }
    _cart.clear();
    _code = null;
    return _json({'order': _orderView(order)}, 201);
  }

  Map<String, dynamic> _orderView(_Order o) {
    final now = _now();
    final status = o.status(now);
    final left = (o.channel == 'pickup' ? 150 : 150) - now.difference(o.placedAt).inSeconds;
    return {
      'id': o.id, 'number': o.number, 'status': status, 'method': o.method, 'channel': o.channel,
      'etaMinutes': status == 'placed' || status == 'delivered' || status == 'collected' ? null : (left / 60).ceil().clamp(1, 60),
      'lines': [for (final l in o.lines) {'name': l['name'], 'qty': l['qty'], 'note': l['note'], 'unitMinor': l['unitMinor']}],
      'quote': o.quote, 'address': o.address, 'history': o.history(now),
    };
  }

  Map<String, dynamic> _historyView(_Order o) => {
        'id': o.id, 'number': o.number, 'status': o.status(_now()), 'channel': o.channel,
        'placedAt': o.placedAt.toUtc().toIso8601String(), 'totalMinor': o.quote['totalMinor'], 'currency': _currency,
        'items': [for (final l in o.lines) {'name': l['name'], 'qty': l['qty']}],
      };

  http.Response _reorder(String id) {
    final order = _orders.where((o) => o.id == id).firstOrNull;
    if (order == null) throw const _Refused('not_found', 'Order not found.', 404);
    final added = <String>[];
    final skipped = <String>[];
    for (final l in order.lines) {
      final item = _item(l['itemId'] as String);
      if (item.soldOut) {
        skipped.add(item.en);
        continue;
      }
      final existing = _cart.where((c) => c['itemId'] == item.id).firstOrNull;
      if (existing != null) {
        existing['qty'] = ((existing['qty'] as int) + (l['qty'] as int)).clamp(1, 20);
      } else {
        _cart.add(_line(item.id, l['qty'] as int));
      }
      added.add(item.en);
    }
    return _ok({'added': added, 'skipped': skipped});
  }

  // ---- Home, wallet, addresses, assistant ----

  Map<String, dynamic> _dish(_Item i, int times) => {'id': i.id, 'name': i.name, 'priceMinor': i.price, 'soldOut': i.soldOut, 'timesOrdered': times};

  Map<String, dynamic> _home() {
    final counts = <String, int>{};
    for (final o in _orders) {
      for (final l in o.lines) {
        counts[l['itemId'] as String] = (counts[l['itemId']] ?? 0) + (l['qty'] as int);
      }
    }
    final frequent = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final last = _orders.isEmpty ? null : _orders.last;
    return {
      'lastOrder': last == null ? null : _historyView(last),
      'frequent': [for (final e in frequent.take(6)) _dish(_item(e.key), e.value)],
      'favourites': [for (final id in _favourites) _dish(_item(id), counts[id] ?? 0)],
    };
  }

  Map<String, dynamic> _walletView() => {
        'available': _wallet.where((v) => v['state'] == 'available').toList(),
        'used': _wallet.where((v) => v['state'] == 'used').toList(),
        'expired': <dynamic>[],
      };

  http.Response _saveVoucher(Map<String, dynamic> body) {
    final code = (body['code'] as String? ?? '').trim().toUpperCase();
    if (_wallet.any((v) => v['code'] == code)) throw const _Refused('duplicate', 'This voucher is already in your wallet.', 409);
    if (!RegExp(r'^PLT-\d{4}-[A-Z]{2}$').hasMatch(code)) throw const _Refused('not_valid', 'That code is not valid. Demo vouchers look like PLT-1234-AB.', 422);
    final voucher = {'voucherId': 'v${_wallet.length + 1}', 'code': code, 'state': 'available', 'discount': 'AED 5.00 off', 'campaign': 'AED 5 vouchers', 'minOrderMinor': 2500, 'currency': _currency, 'expiresAt': '2026-11-29T20:00:00Z'};
    _wallet.add(voucher);
    return _json({'voucher': voucher}, 201);
  }

  http.Response _addAddress(Map<String, dynamic> body) {
    final first = _addresses.isEmpty;
    final makeDefault = first || body['isDefault'] == true;
    if (makeDefault) {
      for (final a in _addresses) {
        a['isDefault'] = false;
      }
    }
    final address = {
      'id': 'a${_addresses.length + 1}', 'label': body['label'] ?? 'Home', 'line1': body['line1'] ?? '', 'line2': body['line2'] ?? '',
      'notes': body['notes'] ?? '', 'isDefault': makeDefault, 'zone': _zone,
    };
    _addresses.add(address);
    return _json({'address': address}, 201);
  }

  List<Map<String, dynamic>> _places(String q) => q.trim().length < 3
      ? []
      : [
          {'label': '${q.trim()}, Downtown Dubai', 'lat': 25.197, 'lng': 55.274},
          {'label': '${q.trim()}, Business Bay, Dubai', 'lat': 25.186, 'lng': 55.262},
        ];

  Map<String, dynamic> _ask(String message) {
    final text = message.toLowerCase();
    final matches = _items.where((i) => text.contains(i.en.toLowerCase().split(' ').last) || text.contains(i.en.toLowerCase())).toList();
    if (text.contains('order') && _orders.isNotEmpty) {
      final o = _orders.last;
      return {
        'intent': 'order_status',
        'answer': 'Your latest order ${o.number} is ${o.status(_now()).replaceAll('_', ' ')}.',
        'items': <dynamic>[],
        'orders': [{'id': o.id, 'number': o.number, 'status': o.status(_now()), 'etaMinutes': null, 'totalMinor': o.quote['totalMinor'], 'currency': _currency}],
      };
    }
    if (matches.isNotEmpty) {
      return {
        'intent': 'menu',
        'answer': matches.map((i) => '${i.en}: ${i.descEn} AED ${(i.price / 100).toStringAsFixed(2)}.').join(' '),
        'items': [for (final i in matches) {'id': i.id, 'name': i.name, 'priceMinor': i.price, 'soldOut': i.soldOut}],
        'orders': <dynamic>[],
      };
    }
    return {
      'intent': 'general',
      'answer': 'This is the demo assistant. Ask about a dish, like "Is the lentil soup vegetarian?", or about your order.',
      'items': <dynamic>[],
      'orders': <dynamic>[],
    };
  }

  static const _account = {'id': 'demo', 'name': 'Demo Customer', 'phone': '+971500000000', 'email': 'demo@example.com', 'emailVerified': true};

  static const _membership = {
    'plans': [
      {
        'id': 'p1', 'code': 'solo', 'name': {'en': 'Solo', 'ar': 'الفردية'},
        'price': {'amountMinor': 0, 'currency': _currency, 'period': 'year'}, 'active': false,
        'benefits': [
          {'id': 'b1', 'title': {'en': 'Free delivery', 'ar': 'توصيل مجاني'}, 'summary': {'en': 'No delivery fee on your member orders.', 'ar': 'لا رسوم توصيل على طلباتك.'}, 'icon': 'delivery', 'accent': 'lilac', 'points': [{'en': 'No delivery fee from any served area', 'ar': 'بدون رسوم توصيل'}]},
          {'id': 'b2', 'title': {'en': 'Member deals', 'ar': 'عروض الأعضاء'}, 'summary': {'en': 'Offers only members can use.', 'ar': 'عروض للأعضاء فقط.'}, 'icon': 'tag', 'accent': 'peach', 'points': [{'en': 'Limited-time offers for members', 'ar': 'عروض محدودة المدة'}]},
          {'id': 'b3', 'title': {'en': 'Member days', 'ar': 'أيام الأعضاء'}, 'summary': {'en': 'Bigger savings on selected days.', 'ar': 'وفورات أكبر في أيام مختارة.'}, 'icon': 'calendar', 'accent': 'mint', 'points': [{'en': 'Bigger discounts on announced days', 'ar': 'خصومات أكبر'}]},
        ],
      },
    ],
    'membership': null,
  };

  http.Response _ok(Object body) => _json(body, 200);

  http.Response _json(Object body, int status) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json; charset=utf-8'});
}

class _Refused implements Exception {
  const _Refused(this.code, this.message, this.status);
  final String code;
  final String message;
  final int status;
}
