import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/screens/checkout_screen.dart';

import 'helpers.dart';

const _quote = {
  'currency': 'AED',
  'subtotalMinor': 4500,
  'deliveryFeeMinor': 1000,
  'serviceFeeMinor': 0,
  'totalMinor': 5500,
  'taxLabel': 'VAT',
  'taxIncludedMinor': 0,
};

Map<String, dynamic> _address(String id, String label, {bool isDefault = false}) => {
      'id': id,
      'label': label,
      'line1': '12 Example Street',
      'line2': '',
      'notes': '',
      'isDefault': isDefault,
      'zone': {'id': 'z1', 'name': {'en': 'Central', 'ar': 'الوسط'}, 'feeMinor': 1000, 'minOrderMinor': 5000, 'active': true},
    };

/// A fake server with a mutable address book, so a saved address shows up in the next list.
class _Server {
  final List<String> requests = [];
  final List<Map<String, dynamic>> addresses = [_address('a1', 'Home', isDefault: true), _address('a2', 'Work')];

  late final client = MockClient((request) async {
    requests.add('${request.method} ${request.url.path} ${request.body}');
    final path = request.url.path;
    if (path == '/v1/menu') return respond(jsonEncode(menuPayload()), 200);
    if (path == '/v1/addresses' && request.method == 'GET') return respond(jsonEncode({'addresses': addresses}), 200);
    if (path == '/v1/addresses' && request.method == 'POST') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final saved = _address('a3', body['label'] as String);
      addresses.add(saved);
      return respond(jsonEncode({'address': saved}), 201);
    }
    if (path == '/v1/delivery-zones') {
      return respond(jsonEncode({'zones': [{'id': 'z1', 'name': {'en': 'Central', 'ar': 'الوسط'}, 'feeMinor': 1000, 'minOrderMinor': 5000}]}), 200);
    }
    if (path == '/v1/checkout/quote') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final addressId = body['addressId'] as String?;
      final delivery = addressId == null
          ? null
          : {'zoneId': 'z1', 'zoneName': {'en': 'Central', 'ar': 'الوسط'}, 'minOrderMinor': 5000, 'deliverable': addressId != 'small'};
      return respond(jsonEncode({'quote': _quote, 'delivery': delivery}), 200);
    }
    if (path == '/v1/orders') {
      return respond(
        jsonEncode({'order': {'id': 'o1', 'number': '1001', 'status': 'placed', 'method': 'cod', 'channel': 'delivery', 'etaMinutes': 30, 'quote': _quote, 'history': []}}),
        201,
      );
    }
    return respond(jsonEncode({'error': {'code': 'not_found', 'message': 'not found'}}), 404);
  });
}

Future<(_Server, ApiClient)> _setup() async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final server = _Server();
  final api = ApiClient(baseUrl: 'http://api.test', client: server.client, prefs: prefs);
  return (server, api);
}

Future<void> _pumpCheckout(WidgetTester tester, ApiClient api) async {
  await tester.pumpWidget(MaterialApp(home: CheckoutScreen(api: api, language: ValueNotifier('en'))));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the default saved address is chosen and the quote is priced for it', (tester) async {
    final (server, api) = await _setup();
    await _pumpCheckout(tester, api);

    expect(find.text('Home · Default'), findsOneWidget);
    expect(find.text('Work'), findsOneWidget);
    expect(find.text('AED 55.00'), findsOneWidget, reason: 'the total includes the zone fee for the default address');
    expect(server.requests.where((r) => r.startsWith('POST /v1/checkout/quote')).last, contains('"addressId":"a1"'));
  });

  testWidgets('choosing another address re-prices the order for that address', (tester) async {
    final (server, api) = await _setup();
    await _pumpCheckout(tester, api);

    await tester.tap(find.text('Work'));
    await tester.pumpAndSettle();
    expect(server.requests.where((r) => r.startsWith('POST /v1/checkout/quote')).last, contains('"addressId":"a2"'));
  });

  testWidgets('a new address is added from a sheet, saved on the account and selected', (tester) async {
    final (server, api) = await _setup();
    await _pumpCheckout(tester, api);

    await tester.tap(find.text('Add a new address'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Street, building and area'), '5 Office Tower, 7th floor');
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Central · AED 10.00').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save address'));
    await tester.pumpAndSettle();

    final post = server.requests.firstWhere((r) => r.startsWith('POST /v1/addresses'));
    expect(post, contains('"zoneId":"z1"'));
    expect(post, contains('"line1":"5 Office Tower, 7th floor"'));
    expect(find.text('Home · Default'), findsOneWidget, reason: 'the default does not change when a new address is added');
    expect(server.requests.where((r) => r.startsWith('POST /v1/checkout/quote')).last, contains('"addressId":"a3"'));
  });

  testWidgets('a delivery under the zone minimum shows the minimum and cannot be placed', (tester) async {
    final (server, api) = await _setup();
    server.addresses.add(_address('small', 'Small order area'));
    await _pumpCheckout(tester, api);

    await tester.tap(find.text('Small order area'));
    await tester.pumpAndSettle();
    expect(find.text('Orders to this area start at AED 50.00.'), findsOneWidget);
    await tester.scrollUntilVisible(find.widgetWithText(FilledButton, 'Place order'), 200);
    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Place order'));
    expect(button.onPressed, isNull);
  });

  testWidgets('placing a delivery order sends the saved address id, never free text', (tester) async {
    final (server, api) = await _setup();
    await _pumpCheckout(tester, api);

    await tester.scrollUntilVisible(find.widgetWithText(FilledButton, 'Place order'), 200);
    await tester.tap(find.widgetWithText(FilledButton, 'Place order'));
    await tester.pump();
    final order = server.requests.firstWhere((r) => r.startsWith('POST /v1/orders'));
    expect(order, contains('"addressId":"a1"'));
    expect(order, isNot(contains('"address":')));
  });
}
