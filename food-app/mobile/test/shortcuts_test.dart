import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/dashboard.dart';
import 'package:sample_kitchen/screens/home_screen.dart';
import 'package:sample_kitchen/screens/orders_screen.dart';

import 'helpers.dart';

Map<String, dynamic> _dish(String id, String en, {int times = 0, bool soldOut = false}) => {
      'id': id,
      'name': {'en': en, 'ar': en},
      'priceMinor': 4500,
      'soldOut': soldOut,
      'timesOrdered': times,
    };

Map<String, dynamic> _order(String id) => {
      'id': id,
      'number': 'R-0001',
      'status': 'delivered',
      'channel': 'delivery',
      'placedAt': '2026-10-29T10:00:00Z',
      'totalMinor': 5500,
      'currency': 'AED',
      'items': [
        {'name': {'en': 'Grilled chicken', 'ar': 'دجاج مشوي'}, 'qty': 2},
        {'name': {'en': 'Mint lemonade', 'ar': 'ليمون بالنعناع'}, 'qty': 1},
      ],
    };

class _Server {
  final List<String> requests = [];
  final favourites = <Map<String, dynamic>>[];
  String reorderMessageSkipped = '';
  late final client = MockClient((request) async {
    requests.add('${request.method} ${request.url.path}');
    final path = request.url.path;
    if (path == '/v1/customer/home') {
      return respond(jsonEncode({
        'lastOrder': _order('o1'),
        'frequent': [_dish('d1', 'Grilled chicken', times: 5)],
        'favourites': List.of(favourites),
      }), 200);
    }
    if (path == '/v1/orders') return respond(jsonEncode({'orders': [_order('o1')]}), 200);
    if (path == '/v1/orders/o1/reorder') {
      return respond(jsonEncode({'added': ['Grilled chicken'], 'skipped': reorderMessageSkipped.isEmpty ? [] : [reorderMessageSkipped]}), 200);
    }
    if (request.method == 'PUT' && path.startsWith('/v1/favourites/')) {
      favourites.add(_dish(path.split('/').last, 'Mint lemonade'));
      return respond('', 204);
    }
    if (request.method == 'DELETE' && path.startsWith('/v1/favourites/')) {
      favourites.clear();
      return respond('', 204);
    }
    if (path == '/v1/menu') return respond(jsonEncode(menuPayload()), 200);
    if (path == '/v1/cart') return respond(jsonEncode({'currency': 'AED', 'lines': [], 'quote': null, 'problem': null}), 200);
    return respond('{}', 200);
  });
}

Future<void> _pumpHome(WidgetTester tester, _Server server, {required List<String> layout}) async {
  SharedPreferences.setMockInitialValues({'dashboard_layout': jsonEncode(layout)});
  final prefs = await SharedPreferences.getInstance();
  final api = ApiClient(baseUrl: 'http://api.test', client: server.client, prefs: prefs);
  await tester.pumpWidget(MaterialApp(home: HomeScreen(api: api, language: ValueNotifier('en'))));
  await tester.pumpAndSettle();
}

void main() {
  test('the three new widgets are in the catalogue and the default layout is unchanged', () {
    for (final id in ['last_order', 'frequent', 'favourites']) {
      expect(defFor(id), isNotNull, reason: id);
    }
    expect(defaultDashboard, ['quick_actions', 'cart_summary', 'popular']);
  });

  testWidgets('the last order shows its dishes, and Order again adds them and says what was added', (tester) async {
    final server = _Server();
    server.reorderMessageSkipped = 'Beef kebab';
    await _pumpHome(tester, server, layout: ['last_order']);

    await expectOnHome(tester, '2 × Grilled chicken, 1 × Mint lemonade');
    await tester.tap(find.widgetWithText(FilledButton, 'Order again'));
    await tester.pumpAndSettle();
    expect(server.requests, contains('POST /v1/orders/o1/reorder'));
    expect(find.text('Added 1 to your cart. Not available right now: Beef kebab.'), findsOneWidget);
  });

  testWidgets('the frequent list shows how often each dish was ordered and can be saved to favourites', (tester) async {
    final server = _Server();
    await _pumpHome(tester, server, layout: ['frequent', 'favourites']);

    await expectOnHome(tester, 'AED 45.00 · Ordered 5 times');
    await tester.tap(find.byTooltip('Save to favourites').first);
    await tester.pumpAndSettle();
    expect(server.requests, contains('PUT /v1/favourites/d1'));
    expect(find.text('Mint lemonade'), findsOneWidget, reason: 'the favourites widget shows the saved dish');
  });

  testWidgets('the order history lists past orders with their dishes', (tester) async {
    final server = _Server();
    final prefs = await SharedPreferences.getInstance();
    final api = ApiClient(baseUrl: 'http://api.test', client: server.client, prefs: prefs);
    await tester.pumpWidget(MaterialApp(home: OrdersScreen(api: api, language: ValueNotifier('en'))));
    await tester.pumpAndSettle();

    expect(find.text('R-0001'), findsOneWidget);
    expect(find.text('2 × Grilled chicken, 1 × Mint lemonade'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Order again'), findsOneWidget);
  });
}
