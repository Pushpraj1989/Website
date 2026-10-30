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
  moreTests();

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
          'currency': 'AED',
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
          'currency': 'AED',
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
          'currency': 'AED',
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


// The assistant's newer abilities: asking "an order or the menu?", and adding dishes only after the customer confirms.
void moreTests() {
  testWidgets('an unclear question gets two buttons; tapping one sends it, with the conversation so far', (tester) async {
    final sent = <Map<String, dynamic>>[];
    final client = MockClient((request) async {
      if (request.url.path == '/v1/ai/ask') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        sent.add(body);
        if (sent.length == 1) return reply({'intent': 'clarify', 'currency': 'AED', 'answer': 'Is this about an order or the menu?', 'items': [], 'orders': [], 'proposals': [], 'choices': ['About an order', 'About the menu']});
        return reply({'intent': 'order', 'currency': 'AED', 'answer': 'You have no orders yet.', 'items': [], 'orders': [], 'proposals': [], 'choices': []});
      }
      return reply({'error': {'code': 'not_found', 'message': 'x'}}, status: 404);
    });
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final api = ApiClient(baseUrl: 'http://api.test', client: client, prefs: prefs);
    await tester.pumpWidget(MaterialApp(home: AssistantScreen(api: api, language: ValueNotifier('en'))));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'I have a question');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();
    expect(find.text('Is this about an order or the menu?'), findsOneWidget);
    await tester.tap(find.widgetWithText(OutlinedButton, 'About an order'));
    await tester.pumpAndSettle();
    expect(find.text('You have no orders yet.'), findsOneWidget);
    expect(sent[1]['message'], 'About an order');
    final history = (sent[1]['history'] as List).cast<Map<String, dynamic>>();
    expect(history.map((h) => h['role']), ['customer', 'assistant']);
    expect(history.last['text'], 'Is this about an order or the menu?');
  });

  testWidgets('a dish the customer asks for is added only when they tap Add to cart; Not now adds nothing', (tester) async {
    var cartWrites = <List<dynamic>>[];
    final proposal = {'itemId': 'salad', 'name': {'en': 'Garden salad', 'ar': 'سلطة'}, 'qty': 2, 'priceMinor': 1800, 'imageUrl': null};
    final client = MockClient((request) async {
      if (request.url.path == '/v1/ai/ask') {
        return reply({'intent': 'menu', 'currency': 'AED', 'answer': 'Shall I add two?', 'items': [], 'orders': [], 'proposals': [proposal], 'choices': []});
      }
      if (request.url.path == '/v1/cart' && request.method == 'GET') return reply({'lines': [], 'quote': null});
      if (request.url.path == '/v1/cart' && request.method == 'PUT') {
        cartWrites.add((jsonDecode(request.body) as Map<String, dynamic>)['items'] as List<dynamic>);
        return reply({'lines': [], 'quote': null});
      }
      return reply({'error': {'code': 'not_found', 'message': 'x'}}, status: 404);
    });
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final api = ApiClient(baseUrl: 'http://api.test', client: client, prefs: prefs);
    await tester.pumpWidget(MaterialApp(home: AssistantScreen(api: api, language: ValueNotifier('en'))));
    await tester.pumpAndSettle();
    for (var round = 0; round < 2; round++) {
      await tester.enterText(find.byType(TextField), 'add two garden salads');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await tester.pumpAndSettle();
    }
    expect(find.text('Add 2 × Garden salad to your cart? That is AED 36.00.'), findsNWidgets(2));
    expect(cartWrites, isEmpty, reason: 'nothing is added before the customer confirms');
    await tester.ensureVisible(find.text('Not now').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Not now').first);
    await tester.pumpAndSettle();
    expect(find.text('Nothing was added.'), findsOneWidget);
    expect(cartWrites, isEmpty);
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Add to cart'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Add to cart'));
    await tester.pumpAndSettle();
    expect(find.text('Added to your cart'), findsOneWidget);
    expect(cartWrites.single.single, containsPair('qty', 2));
    expect(cartWrites.single.single, containsPair('itemId', 'salad'));
  });
}
