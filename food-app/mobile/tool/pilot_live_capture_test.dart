// Captures the customer's pilot screens from the running pilot API, not from canned answers: a new customer signs up,
// fills a delivery cart, applies WELCOME10 and saves a partner-issued voucher to the wallet.
// Needs the API running with OTP_DELIVERY=outbox after scripts/pilot-setup.ts, and a voucher code from the partner:
//   PILOT_API=http://127.0.0.1:3100 PILOT_VOUCHER=PLT-1234-AB flutter test tool/pilot_live_capture_test.dart --update-goldens
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/screens/cart_screen.dart';
import 'package:sample_kitchen/screens/checkout_screen.dart';
import 'package:sample_kitchen/screens/vouchers_screen.dart';

import 'capture_support.dart';

final base = Platform.environment['PILOT_API'] ?? 'http://127.0.0.1:3100';
final voucher = Platform.environment['PILOT_VOUCHER'];
const outbox = '../web/data/outbox.jsonl';

/// Signs a new customer up by phone, reading the one-time code from the development outbox.
Future<String> signUp() async {
  final phone = '+97155${DateTime.now().millisecondsSinceEpoch.toString().substring(6)}';
  final start = await http.post(Uri.parse('$base/v1/auth/signup/phone'), headers: {'content-type': 'application/json'}, body: jsonEncode({'name': 'Pilot Customer', 'phone': phone}));
  final challengeId = (jsonDecode(start.body) as Map<String, dynamic>)['challengeId'];
  final code = File(outbox).readAsLinesSync().map((l) => jsonDecode(l) as Map<String, dynamic>).lastWhere((m) => m['to'] == phone)['code'];
  final done = await http.post(Uri.parse('$base/v1/auth/signup/phone/verify'), headers: {'content-type': 'application/json'}, body: jsonEncode({'challengeId': challengeId, 'code': code}));
  return (jsonDecode(done.body) as Map<String, dynamic>)['token'] as String;
}

void main() {
  late ApiClient api;

  setUpAll(() async {
    await loadCaptureFonts();
  });

  Future<void> shoot(WidgetTester tester, String name, Widget screen) async {
    tester.view.physicalSize = const Size(390, 844) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(captureApp(screen));
    // Real network calls finish outside the test clock, so give them real time between frames.
    for (var i = 0; i < 10; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 250)));
      await tester.pump(const Duration(milliseconds: 100));
    }
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/pilot-$name.png'));
  }

  testWidgets('pilot customer screens', (tester) async {
    await tester.runAsync(() async {
      HttpOverrides.global = null; // the test runner blocks real requests unless this is cleared
      // ignore: invalid_use_of_visible_for_testing_member
      SharedPreferences.setMockInitialValues({});
      api = ApiClient(baseUrl: base, prefs: await SharedPreferences.getInstance());
      await api.init();
      api.accessToken = await signUp();
      await api.saveCart([const CartLine(itemId: '00000000-0000-4000-8000-000000000201', qty: 2, note: '', name: null, unitMinor: null, soldOut: false), const CartLine(itemId: '00000000-0000-4000-8000-000000000101', qty: 1, note: '', name: null, unitMinor: null, soldOut: false)]);
      await api.saveAddress({'label': 'Home', 'line1': '12 Example Street, Dubai', 'line2': 'Flat 4', 'notes': '', 'lat': 25.1, 'lng': 55.3});
      await api.applyCartCode('WELCOME10');
      if (voucher != null) await api.saveVoucher(voucher!);
    });
    final language = ValueNotifier('en');
    await shoot(tester, 'cart', CartScreen(api: api, language: language));
    await shoot(tester, 'checkout', CheckoutScreen(api: api, language: language));
    await shoot(tester, 'wallet', VouchersScreen(api: api, language: language));
    // Let the screens' timers and the HTTP keep-alive timer (15 seconds) run out before the test ends.
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 20));
  });
}
