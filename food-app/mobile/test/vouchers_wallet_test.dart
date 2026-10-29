import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/screens/vouchers_screen.dart';
import 'package:sample_kitchen/widgets/app_button.dart';

import 'helpers.dart';

Map<String, dynamic> _voucher(String id, String state, {String discount = '10% OFF'}) => {
      'voucherId': id,
      'state': state,
      'discount': discount,
      'campaign': 'Spring offer',
      'minOrderMinor': 3000,
      'currency': 'AED',
      'expiresAt': '2026-12-31T20:00:00.000Z',
      'savedAt': '2026-10-29T10:00:00.000Z',
    };

ApiClient _api(MockClient client) => ApiClient(baseUrl: 'http://api.test', client: client);

Future<void> _pump(WidgetTester tester, ApiClient api) async {
  await tester.pumpWidget(MaterialApp(
    locale: const Locale('en'),
    supportedLocales: const [Locale('en'), Locale('ar')],
    localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
    home: VouchersScreen(api: api, language: ValueNotifier('en')),
  ));
  await tester.pumpAndSettle();
}

void main() {
  test('the customer token is sent as a bearer token once signed in, and not before', () async {
    final headers = <Map<String, String>>[];
    final client = MockClient((request) async {
      headers.add(request.headers);
      return respond(jsonEncode({'available': [], 'used': [], 'expired': []}), 200);
    });
    final api = _api(client);
    await api.wallet();
    expect(headers.last.containsKey('authorization'), isFalse);
    api.accessToken = 'token-123';
    await api.wallet();
    expect(headers.last['authorization'], 'Bearer token-123');
  });

  testWidgets('the wallet shows available vouchers, and the used and expired tabs have their own', (tester) async {
    final client = MockClient((request) async => respond(
          jsonEncode({
            'available': [_voucher('v1', 'available', discount: '10% OFF')],
            'used': [_voucher('v2', 'used', discount: 'AED 5 OFF')],
            'expired': [_voucher('v3', 'expired', discount: 'FREE DELIVERY')],
          }),
          200,
        ));
    await _pump(tester, _api(client));
    expect(find.text('10% OFF'), findsOneWidget);
    expect(find.textContaining('Minimum order AED 30.00'), findsOneWidget);
    await tester.tap(find.text('Used'));
    await tester.pumpAndSettle();
    expect(find.text('AED 5 OFF'), findsOneWidget);
    await tester.tap(find.text('Expired'));
    await tester.pumpAndSettle();
    expect(find.text('FREE DELIVERY'), findsOneWidget);
  });

  testWidgets('saving a code sends it, shows that it is saved, and clears the field', (tester) async {
    final sent = <String>[];
    var listed = 0;
    final client = MockClient((request) async {
      if (request.method == 'POST') {
        sent.add(jsonDecode(request.body)['code'] as String);
        return respond(jsonEncode({'voucher': _voucher('v9', 'available')}), 201);
      }
      listed++;
      return respond(jsonEncode({'available': listed > 1 ? [_voucher('v9', 'available')] : [], 'used': [], 'expired': []}), 200);
    });
    await _pump(tester, _api(client));
    await tester.enterText(find.byType(TextField), 'spring-abc');
    await tester.tap(find.widgetWithText(AppButton, 'Save to wallet'));
    await tester.pumpAndSettle();
    expect(sent, ['spring-abc']);
    expect(find.text('Saved to your wallet.'), findsOneWidget);
    expect(find.text('10% OFF'), findsOneWidget);
  });

  testWidgets('a refused code shows the server\'s message, and nothing is saved', (tester) async {
    final client = MockClient((request) async {
      if (request.method == 'POST') {
        return respond(jsonEncode({'error': {'code': 'not_valid', 'message': 'That code is not valid. Check it and try again.'}}), 422);
      }
      return respond(jsonEncode({'available': [], 'used': [], 'expired': []}), 200);
    });
    await _pump(tester, _api(client));
    await tester.enterText(find.byType(TextField), 'WRONG');
    await tester.tap(find.widgetWithText(AppButton, 'Save to wallet'));
    await tester.pumpAndSettle();
    expect(find.text('That code is not valid. Check it and try again.'), findsOneWidget);
    expect(find.text('No vouchers yet. Save one with its code.'), findsOneWidget);
  });

  testWidgets('removing an available voucher calls the server and it leaves the list', (tester) async {
    final deleted = <String>[];
    var removed = false;
    final client = MockClient((request) async {
      if (request.method == 'DELETE') {
        deleted.add(request.url.path);
        removed = true;
        return respond(jsonEncode({'removed': true}), 200);
      }
      return respond(jsonEncode({'available': removed ? [] : [_voucher('v1', 'available')], 'used': [], 'expired': []}), 200);
    });
    await _pump(tester, _api(client));
    await tester.tap(find.byTooltip('Remove'));
    await tester.pumpAndSettle();
    expect(deleted, ['/v1/me/vouchers/v1']);
    expect(find.text('10% OFF'), findsNothing);
  });
}
