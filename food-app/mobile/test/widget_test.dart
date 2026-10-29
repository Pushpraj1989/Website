import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/app.dart';
import 'helpers.dart';
import 'package:sample_kitchen/core/api.dart';
import 'helpers.dart';

Map<String, dynamic> _menu() => {
      'restaurant': {'en': 'Sample Kitchen', 'ar': 'مطبخ تجريبي'},
      'currency': 'AED',
      'payments': {'cod': true, 'payOnArrival': true, 'card': false},
      'categories': [
        {
          'id': 'cat1',
          'name': {'en': 'Mains', 'ar': 'الأطباق الرئيسية'},
          'items': [
            {'id': 'a', 'name': {'en': 'Grilled chicken plate', 'ar': 'طبق دجاج'}, 'description': {'en': 'Chicken and rice', 'ar': 'دجاج'}, 'priceMinor': 4500, 'soldOut': false},
            {'id': 'b', 'name': {'en': 'Beef kebab', 'ar': 'كباب'}, 'description': {'en': 'Grilled', 'ar': 'مشوي'}, 'priceMinor': 5200, 'soldOut': true},
          ],
        },
      ],
    };

ApiClient _api(MockClient client, SharedPreferences prefs) => ApiClient(baseUrl: 'http://api.test', client: client, prefs: prefs);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('the menu shows items with prices, a sold-out item has no Add button', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    final api = _api(MockClient((request) async => respond(jsonEncode(_menu()), 200)), prefs);
    await tester.pumpWidget(SampleKitchenApp(apiBase: 'http://api.test', api: api));
    await tester.pumpAndSettle();

    expect(find.text('Grilled chicken plate'), findsOneWidget);
    expect(find.text('AED 45.00'), findsOneWidget);
    expect(find.text('Sold out'), findsOneWidget);
    expect(find.text('Add: Grilled chicken plate'), findsOneWidget);
    expect(find.text('Add: Beef kebab'), findsNothing);
  });

  testWidgets('switching to Arabic flips the layout to right-to-left and shows Arabic labels', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    final api = _api(MockClient((request) async => respond(jsonEncode(_menu()), 200)), prefs);
    await tester.pumpWidget(SampleKitchenApp(apiBase: 'http://api.test', api: api));
    await tester.pumpAndSettle();

    await tester.tap(find.text('العربية'));
    await tester.pumpAndSettle();

    expect(find.text('الأطباق الرئيسية'), findsOneWidget);
    expect(find.text('نفدت الكمية'), findsOneWidget);
    final direction = Directionality.of(tester.element(find.text('الأطباق الرئيسية')));
    expect(direction, TextDirection.rtl);
  });

  testWidgets('a failed menu load shows a message and a retry button', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    final api = _api(MockClient((request) async => respond('{}', 500)), prefs);
    await tester.pumpWidget(SampleKitchenApp(apiBase: 'http://api.test', api: api));
    await tester.pumpAndSettle();

    expect(find.text('Something went wrong. Please try again.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
