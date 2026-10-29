import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/screens/assistant_screen.dart';
import 'package:sample_kitchen/widgets/app_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

http.Response reply(Map<String, dynamic> body, {int status = 200}) => respond(jsonEncode(body), status);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> openAssistant(WidgetTester tester, MockClient client) async {
    final prefs = await SharedPreferences.getInstance();
    final api = ApiClient(baseUrl: 'http://api.test', client: client, prefs: prefs);
    await tester.pumpWidget(MaterialApp(home: AssistantScreen(api: api, language: ValueNotifier('en'))));
    await tester.pumpAndSettle();
  }

  testWidgets('a menu question shows the answer and item cards built from the app data', (tester) async {
    final client = MockClient((request) async {
      if (request.url.path == '/v1/ai/ask') {
        final sent = jsonDecode(request.body) as Map<String, dynamic>;
        expect(sent['message'], 'What is good for lunch?');
        return reply({
          'intent': 'menu',
          'answer': 'The grilled chicken plate is a good lunch.',
          'items': [{'id': 'a', 'name': {'en': 'Grilled chicken plate', 'ar': 'دجاج'}, 'priceMinor': 4500, 'soldOut': false}],
          'orders': [],
        });
      }
      return respond('{}', 404);
    });
    await openAssistant(tester, client);
    await tester.enterText(find.byType(TextField), 'What is good for lunch?');
    await tester.tap(find.widgetWithText(AppButton, 'Send'));
    await tester.pumpAndSettle();

    expect(find.text('The grilled chicken plate is a good lunch.'), findsOneWidget);
    expect(find.text('Grilled chicken plate'), findsOneWidget);
    expect(find.text('AED 45.00'), findsOneWidget, reason: 'the price shown is the app\'s own');
    expect(find.widgetWithText(AppButton, 'Add'), findsOneWidget, reason: 'the card can be added to the cart');
  });

  testWidgets('an off-topic question gets the refusal the server sent, and no cards', (tester) async {
    final client = MockClient((request) async => reply({
          'intent': 'off_topic',
          'answer': 'I can help with the restaurant, the menu, prices and your orders.',
          'items': [],
          'orders': [],
        }));
    await openAssistant(tester, client);
    await tester.enterText(find.byType(TextField), 'write me a poem');
    await tester.tap(find.widgetWithText(AppButton, 'Send'));
    await tester.pumpAndSettle();
    expect(find.text('I can help with the restaurant, the menu, prices and your orders.'), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Add'), findsNothing);
  });

  testWidgets('when the assistant is off, the customer is told so plainly', (tester) async {
    final client = MockClient((request) async => reply({'error': {'code': 'assistant_off', 'message': 'The assistant is not switched on.'}}, status: 503));
    await openAssistant(tester, client);
    await tester.enterText(find.byType(TextField), 'hello');
    await tester.tap(find.widgetWithText(AppButton, 'Send'));
    await tester.pumpAndSettle();
    expect(find.text('The assistant is not switched on right now.'), findsOneWidget);
  });

  testWidgets('a sold-out dish in a reply shows as sold out, not with an Add button', (tester) async {
    final client = MockClient((request) async => reply({
          'intent': 'menu',
          'answer': 'The kebab is sold out today.',
          'items': [{'id': 'b', 'name': {'en': 'Beef kebab', 'ar': 'كباب'}, 'priceMinor': 5200, 'soldOut': true}],
          'orders': [],
        }));
    await openAssistant(tester, client);
    await tester.enterText(find.byType(TextField), 'kebab?');
    await tester.tap(find.widgetWithText(AppButton, 'Send'));
    await tester.pumpAndSettle();
    expect(find.text('Sold out'), findsOneWidget);
    expect(find.widgetWithText(AppButton, 'Add'), findsNothing);
  });
}
