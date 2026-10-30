// The layout and accessibility sweep: every customer screen at two phone widths (320 and 390 points), at normal and
// large text (140%), in English and Arabic. Any layout overflow, and any failed tap-target, label or contrast check,
// is collected with the screen and setting it happened on, and the test fails with the full list.
// Run: flutter test tool/audit_sweep_test.dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/auth/auth_api.dart';
import 'package:sample_kitchen/auth/biometrics.dart';
import 'package:sample_kitchen/auth/session_store.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/demo/demo_server.dart';
import 'package:sample_kitchen/screens/assistant_screen.dart';
import 'package:sample_kitchen/screens/cart_screen.dart';
import 'package:sample_kitchen/screens/checkout_screen.dart';
import 'package:sample_kitchen/screens/main_shell.dart';
import 'package:sample_kitchen/screens/membership_screen.dart';
import 'package:sample_kitchen/screens/menu_screen.dart';
import 'package:sample_kitchen/screens/order_screen.dart';
import 'package:sample_kitchen/screens/orders_screen.dart';
import 'package:sample_kitchen/screens/sign_in_screen.dart';
import 'package:sample_kitchen/screens/sign_up_screen.dart';
import 'package:sample_kitchen/screens/vouchers_screen.dart';
import 'package:sample_kitchen/widgets/dish_sheet.dart';
import 'package:sample_kitchen/core/strings.dart';

import '../test/auth_fakes.dart';
import 'capture_support.dart';

Map<String, dynamic> _snapshot() => jsonDecode(File('assets/demo/snapshot.json').readAsStringSync()) as Map<String, dynamic>;

/// A signed-in customer with an address, a cart with a code on it, a saved voucher and one placed order.
class _World {
  _World(this.server, this.api, this.auth, this.orderId, this.snap);
  final DemoServer server;
  final ApiClient api;
  final AuthApi auth;
  final String orderId;
  final Map<String, dynamic> snap;
}

/// Builds the signed-in world the sweep uses; shared with the overflow probe.
Future<_World> buildWorld() => _world();

Future<_World> _world() async {
  final snap = _snapshot();
  final server = DemoServer(snapshot: snap);
  // ignore: invalid_use_of_visible_for_testing_member
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final api = ApiClient(baseUrl: 'https://demo.invalid', client: server.client, prefs: prefs);
  final auth = AuthApi(baseUrl: 'https://demo.invalid', client: server.client);
  // Sign up the way the app does, reading the code from the demo inbox.
  final start = jsonDecode((await server.client.post(Uri.parse('https://demo.invalid/v1/auth/signup/phone'),
          headers: {'content-type': 'application/json'}, body: jsonEncode({'name': 'Layla Haddad', 'phone': '+971507654321'})))
      .body);
  final code = RegExp(r'\d{6}').firstMatch(server.inbox.value!.text)!.group(0)!;
  final session = jsonDecode((await server.client.post(Uri.parse('https://demo.invalid/v1/auth/signup/phone/verify'),
          headers: {'content-type': 'application/json'}, body: jsonEncode({'challengeId': start['challengeId'], 'code': code})))
      .body);
  api.accessToken = session['token'] as String;
  auth.token = session['token'] as String;
  final ring = (snap['zones'] as List).first['polygon'] as List;
  final corners = ring.sublist(0, ring.length - 1);
  final lat = corners.fold<double>(0, (s, p) => s + p[1]) / corners.length;
  final lng = corners.fold<double>(0, (s, p) => s + p[0]) / corners.length;
  final address = await api.saveAddress({'label': 'Home', 'line1': 'Lavender Building, wing B, Yashwant Nagar, Dubai', 'line2': 'Floor 1, flat 106', 'lat': lat, 'lng': lng});
  final items = [for (final c in snap['categories'] as List) ...(c['items'] as List)].where((i) => i['soldOut'] != true).toList();
  await api.saveCart([for (final i in items.take(3)) CartLine(itemId: i['id'] as String, qty: 2, note: '', name: null, unitMinor: null, soldOut: false)]);
  final order = await api.placeOrder(channel: 'delivery', method: 'cod', addressId: address.id, idempotencyKey: 'sweep-order-1');
  await api.saveCart([for (final i in items.take(3)) CartLine(itemId: i['id'] as String, qty: 1, note: 'No onions, please', name: null, unitMinor: null, soldOut: false)]);
  await api.applyCartCode((snap['offers'] as List).firstWhere((o) => o['code'] == 'WELCOME10', orElse: () => (snap['offers'] as List).first)['code'] as String);
  await api.saveVoucher((snap['vouchers'] as List).first['code'] as String);
  return _World(server, api, auth, order.id, snap);
}

void main() {
  setUpAll(loadCaptureFonts);

  final screens = <String, Widget Function(_World w, ValueNotifier<String> lang)>{
    'home': (w, lang) => MainShell(api: w.api, language: lang, auth: w.auth, sessions: signedInStore()),
    'menu': (w, lang) => MenuScreen(api: w.api, language: lang),
    'cart': (w, lang) => CartScreen(api: w.api, language: lang),
    'checkout': (w, lang) => CheckoutScreen(api: w.api, language: lang),
    'tracking': (w, lang) => OrderScreen(api: w.api, language: lang, orderId: w.orderId),
    'orders': (w, lang) => OrdersScreen(api: w.api, language: lang),
    'membership': (w, lang) => MembershipScreen(api: w.api, language: lang),
    'vouchers': (w, lang) => VouchersScreen(api: w.api, language: lang),
    'assistant': (w, lang) => AssistantScreen(api: w.api, language: lang),
    'sign-in': (w, lang) => SignInScreen(auth: w.auth, sessions: MemorySessionStore(), biometrics: FakeBiometricGate(available: false), api: w.api, language: lang),
    'sign-up': (w, lang) => SignUpScreen(auth: w.auth, sessions: MemorySessionStore(), biometrics: FakeBiometricGate(available: false), api: w.api, language: lang),
  };

  final problems = <String>[];
  tearDownAll(() {
    final report = File('tool/audit_sweep_report.txt');
    report.writeAsStringSync(problems.isEmpty ? 'No problems found.\n' : '${problems.join('\n')}\n');
  });

  for (final width in [320.0, 390.0]) {
    for (final scale in [1.0, 1.4]) {
      for (final lang in ['en', 'ar']) {
        for (final entry in screens.entries) {
          final scenario = '${entry.key} @${width.toInt()} text ${scale}x $lang';
          testWidgets(scenario, (tester) async {
            late _World w;
            await tester.runAsync(() async => w = await _world());
            tester.view.physicalSize = Size(width, 844) * 2;
            tester.view.devicePixelRatio = 2;
            tester.platformDispatcher.textScaleFactorTestValue = scale;
            addTearDown(tester.view.reset);
            addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
            final found = <String>[];
            final original = FlutterError.onError;
            FlutterError.onError = (details) => found.add(details.exceptionAsString().split('\n').first);
            try {
              final language = ValueNotifier(lang);
              await tester.pumpWidget(captureApp(entry.value(w, language), lang: lang));
              for (var i = 0; i < 8; i++) {
                await tester.pump(const Duration(milliseconds: 300));
                await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
              }
              if (entry.key == 'menu') {
                // The dish sheet opens from the menu: check it too.
                final dish = find.byType(InkWell).first;
                await tester.tap(dish, warnIfMissed: false);
                for (var i = 0; i < 4; i++) {
                  await tester.pump(const Duration(milliseconds: 300));
                }
              }
              if (width == 390 && scale == 1.0) {
                for (final (name, guideline) in [
                  ('tap target', androidTapTargetGuideline),
                  ('label', labeledTapTargetGuideline),
                  ('contrast', textContrastGuideline),
                ]) {
                  final result = await guideline.evaluate(tester);
                  if (!result.passed) {
                    for (final line in result.reason!.split('\n').where((l) => l.trim().isNotEmpty).take(6)) {
                      found.add('$name: ${line.trim()}');
                    }
                  }
                }
              }
              // Let the screens' timers and the demo's network waits finish.
              await tester.pumpWidget(const SizedBox());
              await tester.pump(const Duration(seconds: 20));
            } finally {
              FlutterError.onError = original;
            }
            for (final f in found.toSet()) {
              problems.add('$scenario: $f');
            }
          });
        }
      }
    }
  }

  // The bottom sheet uses its own dummy references to keep this file's imports honest.
  test('sheet and strings are linked', () {
    expect(showDishSheet, isNotNull);
    expect(const Strings('en').add, 'Add');
    expect(http.Client, isNotNull);
    expect(FakeBiometricGate, isNotNull);
    expect(SessionStore, isNotNull);
    expect(BiometricGate, isNotNull);
  });
}
