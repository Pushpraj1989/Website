// Retail mode in the app: products sold in options (sizes, colours), the option kept on every cart line, and shop
// words when the business is a shop.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/brand.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/core/strings.dart';
import 'package:sample_kitchen/widgets/dish_sheet.dart';

const _tshirt = {
  'id': 'tee',
  'name': {'en': 'Classic T-shirt', 'ar': 'تيشيرت'},
  'description': {'en': 'Cotton', 'ar': 'قطن'},
  'priceMinor': 4500,
  'soldOut': false,
  'imageUrl': null,
  'variants': [
    {'id': 'tee-s', 'name': {'en': 'S', 'ar': 'صغير'}, 'priceMinor': 4500, 'soldOut': true},
    {'id': 'tee-m', 'name': {'en': 'M', 'ar': 'وسط'}, 'priceMinor': 5000, 'soldOut': false},
    {'id': 'tee-l', 'name': {'en': 'L', 'ar': 'كبير'}, 'priceMinor': 5500, 'soldOut': false},
  ],
};

/// A cart server that remembers what was sent, so a test can read back each line's option.
class _CartServer {
  List<Map<String, dynamic>> lines = [];
  final puts = <List<dynamic>>[];

  http.Client client() => MockClient((request) async {
        if (request.url.path == '/v1/cart' && request.method == 'GET') {
          return http.Response(jsonEncode({'currency': 'AED', 'lines': lines, 'quote': null, 'offer': null, 'problem': null}), 200, headers: {'content-type': 'application/json'});
        }
        if (request.url.path == '/v1/cart' && request.method == 'PUT') {
          final items = (jsonDecode(request.body) as Map<String, dynamic>)['items'] as List<dynamic>;
          puts.add(items);
          lines = [for (final i in items) {...(i as Map<String, dynamic>), 'name': null, 'unitMinor': null, 'soldOut': false}];
          return http.Response(jsonEncode({'currency': 'AED', 'lines': lines, 'quote': null, 'offer': null, 'problem': null}), 200, headers: {'content-type': 'application/json'});
        }
        return http.Response('{}', 404);
      });
}

void main() {
  tearDown(() => Strings.shop = false);

  test('a product reads its options; a cart line keeps its option through a change', () {
    final item = MenuItem.fromJson(_tshirt);
    expect(item.variants.map((v) => v.name.en), ['S', 'M', 'L']);
    expect(item.variants.first.soldOut, isTrue);
    expect(MenuItem.fromJson({..._tshirt, 'variants': null}).variants, isEmpty, reason: 'older servers send no variants');
    final line = CartLine.fromJson({'itemId': 'tee', 'variantId': 'tee-m', 'qty': 1, 'note': '', 'name': null, 'unitMinor': 5000, 'soldOut': false});
    expect(line.copyWith(qty: 3).variantId, 'tee-m');
    expect(line.key, 'tee:tee-m');
  });

  test('the same product in two sizes is two lines, and every save sends both options', () async {
    final server = _CartServer();
    final api = ApiClient(baseUrl: 'http://api.test', client: server.client());
    await api.addToCart('tee', variantId: 'tee-m');
    await api.addToCart('tee', variantId: 'tee-l', qty: 2);
    await api.addOne('tee', variantId: 'tee-m');
    final last = server.puts.last.cast<Map<String, dynamic>>();
    expect(last.map((l) => [l['variantId'], l['qty']]).toList(), [['tee-m', 2], ['tee-l', 2]]);
    // A plain dish is sent without a variant field at all.
    await api.addOne('salad');
    expect(server.puts.last.cast<Map<String, dynamic>>().last.containsKey('variantId'), isFalse);
  });

  testWidgets('the product sheet waits for an option, skips sold-out ones, and adds the chosen one', (tester) async {
    final server = _CartServer();
    final api = ApiClient(baseUrl: 'http://api.test', client: server.client());
    const s = Strings('en');
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) => Scaffold(body: Center(child: TextButton(
      onPressed: () => showDishSheet(context, api: api, item: MenuItem.fromJson(_tshirt), illustration: 'assets/images/dish-mains.png', currency: 'AED', s: s),
      child: const Text('open'),
    ))))));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Choose an option'), findsOneWidget);
    expect(find.textContaining('from AED'), findsOneWidget, reason: 'the price reads "from" until an option is chosen');
    // Add is disabled until an option is chosen.
    final add = find.ancestor(of: find.text('Add'), matching: find.byWidgetPredicate((w) => w is ButtonStyleButton || w is InkWell)).first;
    await tester.tap(add, warnIfMissed: false);
    await tester.pump();
    expect(server.puts, isEmpty);
    // The sold-out size cannot be chosen.
    await tester.ensureVisible(find.text('S · Sold out'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('S · Sold out'), warnIfMissed: false);
    await tester.pump();
    expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'S · Sold out')).selected, isFalse);
    await tester.ensureVisible(find.text('L'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('L'));
    await tester.pump();
    expect(find.textContaining('55.00'), findsWidgets, reason: 'the price follows the chosen option');
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    expect(server.puts.single.cast<Map<String, dynamic>>().single['variantId'], 'tee-l');
  });

  test('a shop says shop and products; a restaurant keeps menu and dishes', () {
    expect(Brand.fromJson({'name': {'en': 'A', 'ar': 'A'}, 'color': '#B45309', 'businessType': 'shop'}).isShop, isTrue);
    expect(Brand.fromJson({'name': {'en': 'A', 'ar': 'A'}, 'color': '#B45309'}).isShop, isFalse, reason: 'older servers send no type');
    expect(const Strings('en').menu, 'Menu');
    Strings.shop = true;
    expect(const Strings('en').menu, 'Shop');
    expect(const Strings('ar').menu, 'المتجر');
    expect(const Strings('en').searchDishes, 'Search products');
    expect(const Strings('en').dishesInCategory(2), '2 products');
  });
}
