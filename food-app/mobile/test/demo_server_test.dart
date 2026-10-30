import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/demo/demo_server.dart';
import 'package:sample_kitchen/screens/checkout_screen.dart';

// The demo runs on the snapshot exported from the database; these tests use the same file the app ships.
Map<String, dynamic> snapshot() => jsonDecode(File('assets/demo/snapshot.json').readAsStringSync()) as Map<String, dynamic>;

String itemId(Map<String, dynamic> snap, String en) => [
      for (final c in snap['categories'] as List) ...(c['items'] as List),
    ].firstWhere((i) => i['name']['en'] == en)['id'] as String;

CartLine line(String id, int qty) => CartLine(itemId: id, qty: qty, note: '', name: null, unitMinor: null, soldOut: false);

/// A point inside the first delivery area: the average of its corners.
(double, double) insideArea(Map<String, dynamic> snap) {
  final ring = (snap['zones'] as List).first['polygon'] as List;
  final corners = ring.sublist(0, ring.length - 1);
  return (corners.fold<double>(0, (s, p) => s + p[1]) / corners.length, corners.fold<double>(0, (s, p) => s + p[0]) / corners.length);
}

Future<Map<String, dynamic>> address(ApiClient api, Map<String, dynamic> snap) async {
  final (lat, lng) = insideArea(snap);
  final saved = await api.saveAddress({'label': 'Home', 'line1': '12 Example Street', 'line2': '', 'notes': '', 'lat': lat, 'lng': lng});
  return {'id': saved.id};
}

Future<void> expectRefused(Future<Object?> call, String message) async {
  await expectLater(call, throwsA(isA<ApiException>().having((e) => e.message, 'message', message)));
}

void main() {
  test('the menu, delivery areas and codes come from the exported snapshot, with no records made up', () async {
    final snap = snapshot();
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(snapshot: snap).client);
    final menu = await api.menu();
    expect(menu.categories.expand((c) => c.items).map((i) => i.name.en).toList(),
        [for (final c in snap['categories'] as List) for (final i in c['items'] as List) i['name']['en']]);
    expect((await api.deliveryZones()).single.name.en, (snap['zones'] as List).first['name']['en']);
    expect(await api.orderHistory(), isEmpty, reason: 'no invented past orders');
    expect(await api.addresses(), isEmpty, reason: 'no invented addresses');
    expect(snap['source']['by'], contains('export-demo-snapshot'));
  });

  test('sign-in starts signed out; the code goes to the demo inbox and is checked like the API checks it', () async {
    final server = DemoServer(snapshot: snapshot());
    final client = server.client;
    Future<http.Response> post(String path, Object body, [String? token]) => client.post(Uri.parse('https://demo.invalid$path'),
        headers: {'content-type': 'application/json', if (token != null) 'authorization': 'Bearer $token'}, body: jsonEncode(body));
    expect((await client.get(Uri.parse('https://demo.invalid/v1/auth/me'))).statusCode, 401);
    final start = jsonDecode((await post('/v1/auth/signup/phone', {'name': 'Layla Haddad', 'phone': '+971 50 765 4321'})).body);
    final sent = server.inbox.value!;
    expect(sent.to, '+971507654321');
    final code = RegExp(r'\d{6}').firstMatch(sent.text)!.group(0)!;
    final wrong = code == '000000' ? '111111' : '000000';
    final refused = await post('/v1/auth/signup/phone/verify', {'challengeId': start['challengeId'], 'code': wrong});
    expect(refused.statusCode, 422);
    expect(jsonDecode(refused.body)['error']['message'], 'That code is wrong. 4 tries left.');
    final ok = await post('/v1/auth/signup/phone/verify', {'challengeId': start['challengeId'], 'code': code});
    expect(ok.statusCode, 201);
    final session = jsonDecode(ok.body);
    expect(session['account']['name'], 'Layla Haddad');
    final again = await post('/v1/auth/signup/phone/verify', {'challengeId': start['challengeId'], 'code': code});
    expect(jsonDecode(again.body)['error']['code'], 'code_used');
    final me = await client.get(Uri.parse('https://demo.invalid/v1/auth/me'), headers: {'authorization': 'Bearer ${session['token']}'});
    expect(jsonDecode(me.body)['account']['phone'], '+971507654321');
  });

  test('sign-up and sign-in by email: the code goes to the email, the account is confirmed, a second sign-up is refused', () async {
    final server = DemoServer(snapshot: snapshot());
    final client = server.client;
    Future<http.Response> post(String path, Object body) =>
        client.post(Uri.parse('https://demo.invalid$path'), headers: {'content-type': 'application/json'}, body: jsonEncode(body));
    String lastCode() => RegExp(r'\d{6}').firstMatch(server.inbox.value!.text)!.group(0)!;
    expect((await post('/v1/auth/login/email', {'email': 'layla@example.com'})).statusCode, 404);
    final start = jsonDecode((await post('/v1/auth/signup/email', {'name': 'Layla Haddad', 'phone': '+971 50 765 4321', 'email': 'Layla@Example.com'})).body);
    expect(server.inbox.value!.to, 'layla@example.com');
    final ok = await post('/v1/auth/signup/email/verify', {'challengeId': start['challengeId'], 'code': lastCode()});
    expect(ok.statusCode, 201);
    final account = jsonDecode(ok.body)['account'];
    expect([account['phone'], account['email'], account['emailVerified']], ['+971507654321', 'layla@example.com', true]);
    final twice = await post('/v1/auth/signup/email', {'name': 'Layla Haddad', 'phone': '+971 50 000 0000', 'email': 'layla@example.com'});
    expect(jsonDecode(twice.body)['error']['code'], 'email_registered');
    final login = jsonDecode((await post('/v1/auth/login/email', {'email': 'layla@example.com'})).body);
    final session = await post('/v1/auth/login/email/verify', {'challengeId': login['challengeId'], 'code': lastCode()});
    expect(jsonDecode(session.body)['account']['id'], account['id']);
  });

  test('WELCOME10 follows its stored rules: 10% at most the cap, once per customer; card is not offered', () async {
    final snap = snapshot();
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(snapshot: snap).client);
    final addr = await address(api, snap);
    await api.saveCart([line(itemId(snap, 'Grilled chicken plate'), 2), line(itemId(snap, 'Garden salad'), 1)]);
    await api.applyCartCode('welcome10');
    final q = await api.quote('delivery', addressId: addr['id'] as String);
    final rules = (snap['rules'] as Map).values.firstWhere((r) => r['type'] == 'percent');
    final expected = [(q.quote.subtotalMinor * rules['value'] / 10000).round(), rules['maxDiscountMinor'] as int].reduce((a, b) => a < b ? a : b);
    expect(q.quote.discountMinor, expected);
    await expectRefused(api.placeOrder(channel: 'delivery', method: 'card', addressId: addr['id'] as String, idempotencyKey: 'key-card-0001'),
        'That payment method is not available for this order.');
    await api.placeOrder(channel: 'delivery', method: 'cod', addressId: addr['id'] as String, idempotencyKey: 'key-cod-00001');
    await api.saveCart([line(itemId(snap, 'Grilled chicken plate'), 2)]);
    await expectRefused(api.applyCartCode('WELCOME10'), 'You have used this offer as many times as it allows.');
  });

  test('the cash limit and an area minimum are enforced at checkout with the API messages', () async {
    final snap = snapshot();
    // The same rule, with a minimum set on the area, as staff can set it in the admin.
    final withMinimum = jsonDecode(jsonEncode(snap)) as Map<String, dynamic>;
    (withMinimum['zones'] as List).first['minOrderMinor'] = 2000;
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(snapshot: withMinimum).client);
    final addr = await address(api, withMinimum);
    await api.saveCart([line(itemId(snap, 'Still water'), 1)]);
    final q = await api.quote('delivery', addressId: addr['id'] as String);
    expect(q.delivery!.deliverable, isFalse);
    await expectRefused(api.placeOrder(channel: 'delivery', method: 'cod', addressId: addr['id'] as String, idempotencyKey: 'key-min-00001'),
        'This area needs a larger order before delivery.');
    await api.saveCart([line(itemId(snap, 'Grilled chicken plate'), 20)]);
    final limit = (snap['restaurant']['cashLimitMinor'] as int) / 100;
    await expectRefused(api.placeOrder(channel: 'delivery', method: 'cod', addressId: addr['id'] as String, idempotencyKey: 'key-cash-0001'),
        'Orders paid in cash can be up to AED ${limit.toStringAsFixed(2)}. Remove something to continue.');
  });

  test('addresses: ids never repeat, deleting the default promotes the newest, and outside the area is refused', () async {
    final snap = snapshot();
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(snapshot: snap).client);
    final (lat, lng) = insideArea(snap);
    final a = await api.saveAddress({'label': 'Home', 'line1': '1 First Street', 'lat': lat, 'lng': lng});
    final b = await api.saveAddress({'label': 'Work', 'line1': '2 Second Street', 'lat': lat, 'lng': lng});
    await api.deleteAddress(a.id);
    final c = await api.saveAddress({'label': 'Gym', 'line1': '3 Third Street', 'lat': lat, 'lng': lng});
    expect({a.id, b.id, c.id}, hasLength(3));
    final list = await api.addresses();
    expect(list.map((x) => x.id), containsAll([b.id, c.id]));
    expect(list.where((x) => x.isDefault).single.id, b.id, reason: 'deleting the default makes the newest remaining address the default');
    await expectRefused(api.saveAddress({'label': 'Far', 'line1': '9 Far Road', 'lat': 0.5, 'lng': 0.5}), 'We do not deliver to this address yet.');
  });

  test('vouchers come from the snapshot, are used once, and the wallet needs a signed-in customer', () async {
    final snap = snapshot();
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(snapshot: snap).client);
    final voucher = (snap['vouchers'] as List).first;
    await expectRefused(api.wallet(), 'Sign in first.');
    await api.saveCart([line(itemId(snap, 'Grilled chicken plate'), 1)]);
    await api.applyCartCode(voucher['code'] as String);
    final order = await api.placeOrder(channel: 'pickup', method: 'pay_on_arrival', idempotencyKey: 'key-vou-00001');
    expect(order.quote.discountMinor, (snap['rules'] as Map)[voucher['offerId']]['value']);
    await api.saveCart([line(itemId(snap, 'Grilled chicken plate'), 1)]);
    await expectRefused(api.applyCartCode(voucher['code'] as String), 'This voucher has already been used.');
    await expectRefused(api.applyCartCode('NOT-A-CODE'), 'That code is not valid. Check it and try again.');
  });

  test('services the demo does not have answer the way the API answers when they are not configured', () async {
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(snapshot: snapshot()).client);
    await expectRefused(api.ask('Is the lentil soup vegetarian?'), 'The assistant is not switched on.');
    await expectRefused(api.placeSearch('Marina'), 'Address search is not configured yet.');
  });

  test('a malformed request gets the API error shape, and the order time estimate follows the timeline', () async {
    var now = DateTime.utc(2026, 10, 30, 12);
    final snap = snapshot();
    final server = DemoServer(snapshot: snap, clock: () => now);
    final bad = await server.client.put(Uri.parse('https://demo.invalid/v1/cart'), body: jsonEncode({'items': [{'itemId': 'x', 'qty': null}]}));
    expect(bad.statusCode, 400);
    expect(jsonDecode(bad.body)['error']['code'], 'bad_input');
    final api = ApiClient(baseUrl: 'https://demo.invalid', client: server.client);
    await api.saveCart([line(itemId(snap, 'Garden salad'), 1)]);
    final order = await api.placeOrder(channel: 'pickup', method: 'pay_on_arrival', idempotencyKey: 'key-eta-00001');
    expect(order.etaMinutes, isNull);
    now = now.add(const Duration(seconds: 30));
    final cooking = await api.order(order.id);
    expect(cooking.status, 'preparing');
    expect(cooking.etaMinutes, 2);
    now = now.add(const Duration(minutes: 3));
    expect((await api.order(order.id)).status, 'collected');
  });

  testWidgets('checkout shows a code that does not apply to pickup, and keeps Place order off until it is removed', (tester) async {
    final snap = snapshot();
    late ApiClient api;
    await tester.runAsync(() async {
      api = ApiClient(baseUrl: 'https://demo.invalid', client: DemoServer(snapshot: snap).client);
      await address(api, snap);
      await api.saveCart([line(itemId(snap, 'Grilled chicken plate'), 1)]);
      await api.applyCartCode('FREEDEL');
    });
    await tester.pumpWidget(MaterialApp(home: CheckoutScreen(api: api, language: ValueNotifier('en'))));
    Future<void> settle() async {
      for (var i = 0; i < 6; i++) {
        // The demo server waits a little like a network does; that wait runs on the test clock.
        await tester.pump(const Duration(milliseconds: 300));
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      }
    }

    await settle();
    expect(find.textContaining('does not apply'), findsNothing);
    await tester.tap(find.text('Pickup'));
    await settle();
    expect(find.text('Your code does not apply to this order: This offer is for delivery orders.'), findsOneWidget);
    final place = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Place order'));
    expect(place.onPressed, isNull);
    await tester.ensureVisible(find.text('Remove').last);
    await tester.tap(find.text('Remove').last);
    await settle();
    expect(find.textContaining('does not apply'), findsNothing);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Place order')).onPressed, isNotNull);
  });
}
