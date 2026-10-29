import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/app.dart';
import 'auth_fakes.dart';
import 'helpers.dart';
import 'package:sample_kitchen/auth/auth_api.dart';
import 'package:sample_kitchen/auth/biometrics.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/widgets/app_button.dart';

MockClient _router({int menuStatus = 200}) => MockClient((request) async {
      if (request.url.path == '/v1/cart') return respond(jsonEncode({'currency': 'AED', 'lines': [], 'quote': null, 'problem': null}), 200);
      if (request.url.path == '/v1/auth/me') return respond(jsonEncode({'account': {'id': 'a', 'name': 'Sara', 'phone': '+971501234567', 'email': 'sara@example.com', 'emailVerified': true}}), 200);
      return respond(jsonEncode(menuPayload()), menuStatus);
    });

ApiClient _api(MockClient client, SharedPreferences prefs) => ApiClient(baseUrl: 'http://api.test', client: client, prefs: prefs);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('the menu shows items with prices, a sold-out item has no Add button', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    final api = _api(_router(), prefs);
    await tester.pumpWidget(SampleKitchenApp(apiBase: 'http://api.test', api: api, auth: AuthApi(baseUrl: 'http://api.test', client: _router()), sessions: signedInStore(), biometrics: FakeBiometricGate(available: false)));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(AppButton, 'Menu'));
    await tester.pumpAndSettle();

    expect(find.text('Grilled chicken plate'), findsWidgets);
    expect(find.text('AED 45.00'), findsWidgets);
    expect(find.text('Sold out'), findsOneWidget);
    expect(find.text('Add: Beef kebab'), findsNothing);
  });

  testWidgets('switching to Arabic flips the layout to right-to-left and shows Arabic labels', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    final api = _api(_router(), prefs);
    await tester.pumpWidget(SampleKitchenApp(apiBase: 'http://api.test', api: api, auth: AuthApi(baseUrl: 'http://api.test', client: _router()), sessions: signedInStore(), biometrics: FakeBiometricGate(available: false)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('العربية'));
    await tester.pumpAndSettle();
    expect(find.text('الرئيسية'), findsOneWidget);

    await tester.tap(find.widgetWithText(AppButton, 'القائمة'));
    await tester.pumpAndSettle();
    expect(find.text('الأطباق الرئيسية'), findsOneWidget);
    expect(find.text('نفدت الكمية'), findsOneWidget);
    final direction = Directionality.of(tester.element(find.text('الأطباق الرئيسية')));
    expect(direction, TextDirection.rtl);
  });

  testWidgets('a failed menu load shows a message and a retry button', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    final api = _api(_router(menuStatus: 500), prefs);
    await tester.pumpWidget(SampleKitchenApp(apiBase: 'http://api.test', api: api, auth: AuthApi(baseUrl: 'http://api.test', client: _router()), sessions: signedInStore(), biometrics: FakeBiometricGate(available: false)));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(AppButton, 'Menu'));
    await tester.pumpAndSettle();
    expect(find.text('Something went wrong. Please try again.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('customise: remove a widget, add another, confirm, and the change is kept', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    final api = _api(_router(), prefs);
    await tester.pumpWidget(SampleKitchenApp(apiBase: 'http://api.test', api: api, auth: AuthApi(baseUrl: 'http://api.test', client: _router()), sessions: signedInStore(), biometrics: FakeBiometricGate(available: false)));
    await tester.pumpAndSettle();

    expect(find.text('Popular on the menu'), findsOneWidget);
    await tester.tap(find.widgetWithText(AppButton, 'Customise'));
    await tester.pumpAndSettle();

    // Shown list: quick actions, cart, popular. Remove the last one, then add the active order widget.
    await tester.tap(find.widgetWithText(AppButton, 'Remove').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(AppButton, 'Add').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(AppButton, 'Confirm'));
    await tester.pumpAndSettle();

    expect(find.text('Popular on the menu'), findsNothing, reason: 'the removed widget is gone');
    expect(find.text('Active order'), findsOneWidget, reason: 'the added widget shows');
    expect(prefs.getString('dashboard_layout'), isNot(contains('"popular"')));
  });

  testWidgets('a button keeps a 48 px tap target even when it looks smaller', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: AppButton(label: 'Small', size: ButtonSize.sm, onPressed: () {})),
    ));
    final hit = tester.getSize(find.byType(InkWell));
    expect(hit.height, greaterThanOrEqualTo(48));
    final visual = tester.getSize(find.byType(Container).last);
    expect(visual.height, 32);
  });
}
