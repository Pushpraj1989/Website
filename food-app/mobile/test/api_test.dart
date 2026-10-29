import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/api.dart';
import 'helpers.dart';
import 'package:sample_kitchen/core/models.dart';

final _menuJson = {
  'restaurant': {'en': 'Sample Kitchen', 'ar': 'مطبخ تجريبي'},
  'currency': 'AED',
  'payments': {'cod': true, 'payOnArrival': true, 'card': false},
  'categories': [
    {
      'id': 'cat1',
      'name': {'en': 'Starters', 'ar': 'المقبلات'},
      'items': [
        {
          'id': 'itm1',
          'name': {'en': 'Garden salad', 'ar': 'سلطة'},
          'description': {'en': 'Fresh', 'ar': 'طازج'},
          'priceMinor': 1800,
          'soldOut': false,
        },
      ],
    },
  ],
};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('the menu parses both languages and payment switches', () async {
    final client = ApiClient(
      baseUrl: 'http://api.test',
      client: MockClient((request) async => respond(jsonEncode(_menuJson), 200)),
      prefs: await SharedPreferences.getInstance(),
    );
    final menu = await client.menu();
    expect(menu.categories.single.items.single.priceMinor, 1800);
    expect(menu.categories.single.name.of('ar'), 'المقبلات');
    expect(menu.payments.card, isFalse);
    expect(menu.payments.cod, isTrue);
  });

  test('the guest cookie is kept and sent on the next call, as a browser would', () async {
    final seen = <String?>[];
    final client = ApiClient(
      baseUrl: 'http://api.test',
      prefs: await SharedPreferences.getInstance(),
      client: MockClient((request) async {
        seen.add(request.headers['cookie']);
        if (request.url.path == '/v1/cart' && request.method == 'PUT') {
          return respond(jsonEncode({'lines': [], 'quote': null, 'currency': 'AED', 'problem': null}), 200, headers: {'set-cookie': 'guest=tok123; Path=/; HttpOnly; SameSite=Strict'});
        }
        return respond(jsonEncode({'lines': [], 'quote': null, 'currency': 'AED', 'problem': null}), 200);
      }),
    );
    await client.saveCart([]);
    await client.cart();
    expect(seen.first, isNull, reason: 'first call has no cookie yet');
    expect(seen.last, 'guest=tok123');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('guest_cookie'), 'tok123', reason: 'survives an app restart');
  });

  test('a refused request becomes an ApiException with the server message', () async {
    final client = ApiClient(
      baseUrl: 'http://api.test',
      prefs: await SharedPreferences.getInstance(),
      client: MockClient((request) async => respond(jsonEncode({'error': {'code': 'sold_out', 'message': 'Garden salad is sold out.'}}), 422)),
    );
    expect(
      () => client.saveCart([const CartLine(itemId: 'itm1', qty: 1, note: '', name: null, unitMinor: null, soldOut: false)]),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Garden salad is sold out.')),
    );
  });

  test('adding an item reads the cart, adds one, and writes it back', () async {
    final bodies = <Map<String, dynamic>>[];
    final client = ApiClient(
      baseUrl: 'http://api.test',
      prefs: await SharedPreferences.getInstance(),
      client: MockClient((request) async {
        if (request.method == 'PUT') {
          bodies.add(jsonDecode(request.body) as Map<String, dynamic>);
          return respond(jsonEncode({'lines': [], 'quote': null, 'currency': 'AED', 'problem': null}), 200);
        }
        return respond(
          jsonEncode({
            'currency': 'AED',
            'quote': null,
            'problem': null,
            'lines': [
              {'itemId': 'itm1', 'qty': 2, 'note': 'extra lemon', 'name': {'en': 'Garden salad', 'ar': 'سلطة'}, 'unitMinor': 1800, 'soldOut': false},
            ],
          }),
          200,
        );
      }),
    );
    await client.addOne('itm1');
    final items = bodies.single['items'] as List<dynamic>;
    expect(items.single, {'itemId': 'itm1', 'qty': 3, 'note': 'extra lemon'});
  });

  test('an idempotency key is 32 hex characters and differs between visits', () {
    final a = newIdempotencyKey();
    final b = newIdempotencyKey();
    expect(a, matches(RegExp(r'^[0-9a-f]{32}$')));
    expect(a, isNot(b));
  });
}
