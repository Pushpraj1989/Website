import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// A UTF-8 JSON response, the way the server sends it. Arabic text needs UTF-8 bytes, not the Latin-1 default.
http.Response respond(String body, int status, {Map<String, String>? headers}) => http.Response.bytes(
      utf8.encode(body),
      status,
      headers: {'content-type': 'application/json; charset=utf-8', ...?headers},
    );

/// The menu payload the widget tests use: one available dish, one sold out.
Map<String, dynamic> menuPayload() => {
      'restaurant': {'en': 'Sample Kitchen', 'ar': 'مطبخ تجريبي'},
      'currency': 'AED',
      'payments': {'cod': true, 'payOnArrival': true, 'card': false},
      'offers': <dynamic>[],
      'categories': [
        {
          'id': 'cat1',
          'name': {'en': 'Mains', 'ar': 'الأطباق الرئيسية'},
          'items': [
            {'id': 'a', 'name': {'en': 'Grilled chicken plate', 'ar': 'طبق دجاج'}, 'description': {'en': 'Chicken and rice', 'ar': 'دجاج'}, 'priceMinor': 4500, 'soldOut': false, 'imageUrl': null},
            {'id': 'b', 'name': {'en': 'Beef kebab', 'ar': 'كباب'}, 'description': {'en': 'Grilled', 'ar': 'مشوي'}, 'priceMinor': 5200, 'soldOut': true, 'imageUrl': null},
          ],
        },
      ],
    };

/// Scrolls the home screen (its first scroll view) until [text] is built, then checks it. The popular section sits
/// below the fold once the bottom bar and the Ask button are on screen.
Future<void> expectOnHome(WidgetTester tester, String text) async {
  await tester.scrollUntilVisible(find.text(text), 200, scrollable: find.byType(Scrollable).first);
  expect(find.text(text), findsOneWidget);
}
