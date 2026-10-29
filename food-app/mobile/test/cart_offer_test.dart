import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/screens/cart_screen.dart';
import 'package:sample_kitchen/widgets/app_button.dart';

import 'helpers.dart';

Map<String, dynamic> _cart({Map<String, dynamic>? offer, int discount = 0}) => {
      'currency': 'AED',
      'lines': [
        {'itemId': 'a', 'qty': 2, 'note': '', 'name': {'en': 'Garden salad', 'ar': 'سلطة'}, 'unitMinor': 1800, 'soldOut': false},
      ],
      'quote': {
        'currency': 'AED',
        'subtotalMinor': 3600,
        'deliveryFeeMinor': 0,
        'serviceFeeMinor': 0,
        'totalMinor': 3600 - discount,
        'taxLabel': 'VAT',
        'taxIncludedMinor': 0,
        'discountMinor': discount,
      },
      'problem': null,
      'offer': offer,
    };

/// The offers code field, found by its label (a cart line has a note field too).
final _codeField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == 'Voucher code');

Future<void> _pump(WidgetTester tester, ApiClient api) async {
  await tester.pumpWidget(MaterialApp(
    locale: const Locale('en'),
    supportedLocales: const [Locale('en'), Locale('ar')],
    localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
    home: CartScreen(api: api, language: ValueNotifier('en')),
  ));
  await tester.pumpAndSettle();
}

void main() {
  test('the quote carries the discount and the cart offer is read', () {
    final quote = Quote.fromJson(_cart(discount: 360)['quote'] as Map<String, dynamic>);
    expect(quote.discountMinor, 360);
    final offer = CartOffer.fromJson({'applied': true, 'label': '10% off', 'reason': null, 'discountMinor': 360});
    expect(offer.applied, isTrue);
    expect(offer.discountMinor, 360);
  });

  testWidgets('applying a code sends it, then shows the offer and the discount line in the totals', (tester) async {
    final sent = <String>[];
    var applied = false;
    final client = MockClient((request) async {
      if (request.method == 'PUT' && request.url.path == '/v1/cart/offer') {
        sent.add(jsonDecode(request.body)['code'] as String);
        applied = true;
        return respond(jsonEncode({'offer': {'applied': true, 'label': '10% off', 'reason': null, 'discountMinor': 360}, 'quote': {}, 'currency': 'AED'}), 200);
      }
      if (applied) {
        return respond(jsonEncode(_cart(offer: {'applied': true, 'label': '10% off', 'reason': null, 'discountMinor': 360}, discount: 360)), 200);
      }
      return respond(jsonEncode(_cart()), 200);
    });
    await _pump(tester, ApiClient(baseUrl: 'http://api.test', client: client));
    await tester.enterText(_codeField, 'save10');
    await tester.tap(find.widgetWithText(AppButton, 'Apply'));
    await tester.pumpAndSettle();
    expect(sent, ['save10']);
    expect(find.text('Applied: 10% off'), findsOneWidget);
    expect(find.text('Discount'), findsOneWidget);
    expect(find.text('− AED 3.60'), findsOneWidget);
  });

  testWidgets('a refused code shows the server\'s reason, and nothing is applied', (tester) async {
    final client = MockClient((request) async {
      if (request.method == 'PUT') {
        return respond(jsonEncode({'error': {'code': 'offer_not_applicable', 'message': 'Add 2.00 AED more to use this offer.'}}), 422);
      }
      return respond(jsonEncode(_cart()), 200);
    });
    await _pump(tester, ApiClient(baseUrl: 'http://api.test', client: client));
    await tester.enterText(_codeField, 'SHRINK');
    await tester.tap(find.widgetWithText(AppButton, 'Apply'));
    await tester.pumpAndSettle();
    expect(find.text('Add 2.00 AED more to use this offer.'), findsOneWidget);
    expect(find.text('Discount'), findsNothing);
  });

  testWidgets('an offer that no longer applies says why, and can be removed', (tester) async {
    final deleted = <String>[];
    var removed = false;
    final client = MockClient((request) async {
      if (request.method == 'DELETE') {
        deleted.add(request.url.path);
        removed = true;
        return respond(jsonEncode({'offer': null}), 200);
      }
      if (removed) return respond(jsonEncode(_cart()), 200);
      return respond(
        jsonEncode(_cart(offer: {'applied': false, 'label': null, 'reason': 'This offer has ended.', 'discountMinor': 0})),
        200,
      );
    });
    await _pump(tester, ApiClient(baseUrl: 'http://api.test', client: client));
    expect(find.text('This offer has ended.'), findsOneWidget);
    // A cart line has its own Remove button; the offer's is the last one on the screen.
    await tester.tap(find.widgetWithText(TextButton, 'Remove').last);
    await tester.pumpAndSettle();
    expect(deleted, ['/v1/cart/offer']);
    expect(find.text('This offer has ended.'), findsNothing);
  });
}
