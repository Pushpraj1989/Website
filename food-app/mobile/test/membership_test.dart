import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/screens/membership_screen.dart';

import 'helpers.dart';

Map<String, dynamic> _plan({bool active = false}) => {
      'id': 'p1',
      'code': 'solo',
      'name': {'en': 'Solo', 'ar': 'الفردية'},
      'price': {'amountMinor': 0, 'currency': 'AED', 'period': 'year'},
      'active': active,
      'benefits': [
        {
          'id': 'b1',
          'title': {'en': 'Free delivery', 'ar': 'توصيل مجاني'},
          'summary': {'en': 'No delivery fee on your member orders.', 'ar': 'لا رسوم توصيل على طلباتك كعضو.'},
          'icon': 'delivery',
          'accent': 'lilac',
          'points': [
            {'en': 'No delivery fee from any served area', 'ar': 'بدون رسوم توصيل من أي منطقة'},
            {'en': 'Applies to every order while active', 'ar': 'ينطبق على كل طلب'},
          ],
        },
        {
          'id': 'b2',
          'title': {'en': 'Member deals', 'ar': 'عروض الأعضاء'},
          'summary': {'en': 'Offers only members can use.', 'ar': 'عروض للأعضاء فقط.'},
          'icon': 'tag',
          'accent': 'peach',
          'points': [
            {'en': 'Limited-time offers for members', 'ar': 'عروض للأعضاء'},
          ],
        },
      ],
    };

ApiClient _api(Map<String, dynamic> plan, {Map<String, dynamic>? membership}) {
  SharedPreferences.setMockInitialValues({});
  return ApiClient(
    baseUrl: 'http://api.test',
    prefs: null,
    client: MockClient((request) async {
      if (request.url.path == '/v1/membership') {
        return respond(jsonEncode({'plans': [plan], 'membership': membership}), 200);
      }
      return respond(jsonEncode(menuPayload()), 200);
    }),
  );
}

// The same locale and delegates the app uses, so Arabic is laid out right-to-left as it is in the app.
Future<void> _pump(WidgetTester tester, ApiClient api, {String language = 'en'}) async {
  await tester.pumpWidget(MaterialApp(
    locale: Locale(language),
    supportedLocales: const [Locale('en'), Locale('ar')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: MembershipScreen(api: api, language: ValueNotifier(language)),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the plan shows its benefit tiles and an upgrade that is not offered until the plan is active', (tester) async {
    await _pump(tester, _api(_plan()));

    expect(find.text('Solo'), findsWidgets);
    expect(find.text('Free delivery'), findsOneWidget);
    expect(find.text('Member deals'), findsOneWidget);
    expect(find.text('You are not a member yet'), findsOneWidget);
    // The page scrolls vertically; the first ListView on the screen is that page (the benefits row is the second).
    await tester.dragUntilVisible(find.text('Coming soon'), find.byType(ListView).first, const Offset(0, -200));
    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Coming soon'));
    expect(button.onPressed, isNull, reason: 'an inactive plan cannot be bought');
  });

  testWidgets('tapping a tile opens its details from the bottom, with its points, and closes', (tester) async {
    await _pump(tester, _api(_plan()));

    await tester.tap(find.text('Free delivery'));
    await tester.pumpAndSettle();
    final sheet = find.byType(BottomSheet);
    expect(find.descendant(of: sheet, matching: find.text('No delivery fee on your member orders.')), findsOneWidget);
    expect(find.descendant(of: sheet, matching: find.text('No delivery fee from any served area')), findsOneWidget);
    expect(find.descendant(of: sheet, matching: find.text('Applies to every order while active')), findsOneWidget);
    expect(find.descendant(of: sheet, matching: find.byIcon(Icons.check_circle)), findsNWidgets(2));

    await tester.tap(find.widgetWithText(FilledButton, 'Close'));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);
  });

  testWidgets('an active member sees the date they joined and no upgrade offer', (tester) async {
    await _pump(
      tester,
      _api(_plan(active: true), membership: {'planId': 'p1', 'status': 'active', 'startedAt': '2026-10-01T10:00:00Z'}),
    );
    expect(find.text('Member since 01/10/2026'), findsOneWidget);
    expect(find.text('Join now'), findsNothing);
  });

  testWidgets('in Arabic the screen is right-to-left and shows the Arabic copy', (tester) async {
    await _pump(tester, _api(_plan()), language: 'ar');

    expect(find.text('توصيل مجاني'), findsOneWidget);
    expect(find.text('مزاياك'), findsOneWidget);
    final direction = Directionality.of(tester.element(find.text('مزاياك')));
    expect(direction, TextDirection.rtl);
  });
}
