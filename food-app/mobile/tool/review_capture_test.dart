// Renders each customer screen with realistic data, the app's real theme and fonts, at a phone size.
// Run: flutter test tool/review_capture_test.dart --update-goldens   (writes tool/goldens/*.png for the UX review)
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/auth/auth_api.dart';
import 'package:sample_kitchen/auth/biometrics.dart';
import 'package:sample_kitchen/auth/session_store.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/screens/assistant_screen.dart';
import 'package:sample_kitchen/screens/cart_screen.dart';
import 'package:sample_kitchen/screens/checkout_screen.dart';
import 'package:sample_kitchen/screens/home_screen.dart';
import 'package:sample_kitchen/screens/membership_screen.dart';
import 'package:sample_kitchen/screens/main_shell.dart';

import 'package:sample_kitchen/screens/menu_screen.dart';
import 'package:sample_kitchen/screens/order_screen.dart';
import 'package:sample_kitchen/screens/orders_screen.dart';
import 'package:sample_kitchen/screens/sign_in_screen.dart';

import '../test/auth_fakes.dart';
import 'capture_support.dart';
import '../test/helpers.dart';

Map<String, dynamic> _item(String id, String en, String ar, int price, {bool soldOut = false, String desc = ''}) => {
      'id': id,
      'name': {'en': en, 'ar': ar},
      'description': {'en': desc, 'ar': ''},
      'priceMinor': price,
      'soldOut': soldOut,
      'imageUrl': null,
    };

Map<String, dynamic> _menu() => {
      'restaurant': {'en': 'Sample Kitchen', 'ar': 'مطبخ تجريبي'},
      'brand': {
        'name': {'en': 'Sample Kitchen', 'ar': 'مطبخ تجريبي'},
        'tagline': {'en': 'Home-style grills and fresh salads', 'ar': 'مشويات منزلية وسلطات طازجة'},
        'logoUrl': null,
        'color': '#B45309',
        'phone': '+971000000000',
        'address': {'en': '', 'ar': ''},
      },
      'currency': 'AED',
      'payments': {'cod': true, 'payOnArrival': true, 'card': false},
      'offers': [],
      'categories': [
        {
          'id': 'c1',
          'illustration': 'starters',
          'name': {'en': 'Starters', 'ar': 'المقبلات'},
          'items': [
            _item('i1', 'Garden salad', 'سلطة الحديقة', 1800, desc: 'Crisp greens, lemon dressing'),
            _item('i2', 'Lentil soup', 'شوربة العدس', 1500, desc: 'Warm, with bread'),
          ],
        },
        {
          'id': 'c2',
          'illustration': 'mains',
          'name': {'en': 'Mains', 'ar': 'الأطباق الرئيسية'},
          'items': [
            _item('i3', 'Grilled chicken plate', 'طبق دجاج مشوي', 4500, desc: 'Rice, salad and garlic sauce'),
            _item('i4', 'Beef kebab', 'كباب لحم', 5200, soldOut: true, desc: 'Charcoal grilled'),
          ],
        },
        {
          'id': 'c3',
          'illustration': 'drinks',
          'name': {'en': 'Drinks', 'ar': 'المشروبات'},
          'items': [_item('i5', 'Mint lemonade', 'ليمونادة بالنعناع', 1200)],
        },
      ],
    };

Map<String, dynamic> _quote({int fee = 1000}) => {
      'quote': {
        'currency': 'AED',
        'subtotalMinor': 7500,
        'deliveryFeeMinor': fee,
        'serviceFeeMinor': 0,
        'totalMinor': 7500 + fee,
        'taxLabel': 'VAT',
        'taxIncludedMinor': 0,
      },
      'delivery': {'zoneId': 'z1', 'zoneName': {'en': 'Central', 'ar': 'الوسط'}, 'minOrderMinor': 2000, 'deliverable': true},
    };

Map<String, dynamic> _address(String id, String label, {bool isDefault = false}) => {
      'id': id,
      'label': label,
      'line1': 'Lavender Building, wing B, Yashwant Nagar',
      'line2': 'Floor 1, flat 106',
      'notes': '',
      'isDefault': isDefault,
      'zone': {'id': 'z1', 'name': {'en': 'Central', 'ar': 'الوسط'}, 'feeMinor': 1000, 'minOrderMinor': 2000, 'active': true},
    };

Map<String, dynamic> _order(String id, String number, String status) => {
      'id': id,
      'number': number,
      'status': status,
      'channel': 'delivery',
      'placedAt': '2026-10-28T19:10:00Z',
      'totalMinor': 11800,
      'currency': 'AED',
      'items': [
        {'name': {'en': 'Grilled chicken plate', 'ar': 'طبق دجاج مشوي'}, 'qty': 2},
        {'name': {'en': 'Mint lemonade', 'ar': 'ليمونادة بالنعناع'}, 'qty': 1},
      ],
    };

MockClient _server() => MockClient((request) async {
      final path = request.url.path;
      if (path == '/v1/menu') return respond(jsonEncode(_menu()), 200);
      if (path == '/v1/cart') {
        return respond(jsonEncode({
          'currency': 'AED',
          'lines': [
            {'itemId': 'i3', 'name': {'en': 'Grilled chicken plate', 'ar': 'طبق دجاج مشوي'}, 'qty': 2, 'note': '', 'unitMinor': 4500, 'soldOut': false},
            {'itemId': 'i5', 'name': {'en': 'Mint lemonade', 'ar': 'ليمونادة بالنعناع'}, 'qty': 1, 'note': '', 'unitMinor': 1200, 'soldOut': false},
          ],
          'quote': _quote()['quote'],
          'problem': null,
        }), 200);
      }
      if (path == '/v1/checkout/quote') return respond(jsonEncode(_quote()), 200);
      if (path == '/v1/addresses') return respond(jsonEncode({'addresses': [_address('a1', 'Home', isDefault: true), _address('a2', 'Work')]}), 200);
      if (path == '/v1/delivery-zones') {
        return respond(jsonEncode({'zones': [{'id': 'z1', 'name': {'en': 'Central', 'ar': 'الوسط'}, 'feeMinor': 1000, 'minOrderMinor': 2000, 'centre': {'lat': 25.1, 'lng': 55.3}}]}), 200);
      }
      if (path == '/v1/customer/home') {
        return respond(jsonEncode({
          'lastOrder': _order('o1', 'R-0028', 'delivered'),
          'frequent': [
            {'id': 'i3', 'name': {'en': 'Grilled chicken plate', 'ar': 'طبق دجاج مشوي'}, 'priceMinor': 4500, 'soldOut': false, 'timesOrdered': 5},
            {'id': 'i5', 'name': {'en': 'Mint lemonade', 'ar': 'ليمونادة بالنعناع'}, 'priceMinor': 1200, 'soldOut': false, 'timesOrdered': 3},
          ],
          'favourites': [
            {'id': 'i1', 'name': {'en': 'Garden salad', 'ar': 'سلطة الحديقة'}, 'priceMinor': 1800, 'soldOut': false, 'timesOrdered': 0},
          ],
        }), 200);
      }
      if (path == '/v1/orders') {
        return respond(jsonEncode({'orders': [_order('o1', 'R-0028', 'delivered'), _order('o2', 'R-0031', 'preparing')]}), 200);
      }
      if (path == '/v1/orders/o2') {
        return respond(jsonEncode({'order': {
          'id': 'o2', 'number': 'R-0031', 'status': 'preparing', 'method': 'cod', 'channel': 'delivery', 'etaMinutes': 25,
          'quote': _quote()['quote'],
          'lines': [
            {'name': {'en': 'Grilled chicken plate', 'ar': 'طبق دجاج مشوي'}, 'qty': 2, 'note': 'Extra garlic sauce', 'unitMinor': 4500},
            {'name': {'en': 'Mint lemonade', 'ar': 'ليمونادة بالنعناع'}, 'qty': 1, 'note': '', 'unitMinor': 1200},
          ],
          'address': 'Lavender Building, wing B, Floor 1, flat 106',
          'history': [
            {'status': 'placed', 'at': '2026-10-28T19:10:00Z'},
            {'status': 'accepted', 'at': '2026-10-28T19:11:00Z'},
            {'status': 'preparing', 'at': '2026-10-28T19:13:00Z'},
          ],
        }}), 200);
      }
      if (path == '/v1/membership') {
        return respond(jsonEncode({
          'plans': [
            {
              'id': 'p1', 'code': 'solo', 'name': {'en': 'Solo', 'ar': 'الفردية'},
              'price': {'amountMinor': 0, 'currency': 'AED', 'period': 'year'}, 'active': false,
              'benefits': [
                {'id': 'b1', 'title': {'en': 'Free delivery', 'ar': 'توصيل مجاني'}, 'summary': {'en': 'No delivery fee on your member orders.', 'ar': 'لا رسوم توصيل'}, 'icon': 'delivery', 'accent': 'lilac', 'points': [{'en': 'No delivery fee from any served area', 'ar': 'بدون رسوم'}, {'en': 'Applies to every order while active', 'ar': 'ينطبق'}]},
                {'id': 'b2', 'title': {'en': 'Member deals', 'ar': 'عروض الأعضاء'}, 'summary': {'en': 'Offers only members can use.', 'ar': 'عروض'}, 'icon': 'tag', 'accent': 'peach', 'points': [{'en': 'Limited-time offers for members', 'ar': 'عروض'}]},
                {'id': 'b3', 'title': {'en': 'Member days', 'ar': 'أيام الأعضاء'}, 'summary': {'en': 'Bigger savings on selected days.', 'ar': 'وفورات'}, 'icon': 'calendar', 'accent': 'mint', 'points': [{'en': 'Bigger discounts on announced days', 'ar': 'خصومات'}]},
              ],
            },
          ],
          'membership': null,
        }), 200);
      }
      if (path == '/v1/ai/ask') {
        return respond(jsonEncode({'answer': 'Our grilled chicken plate is served with rice and salad.', 'items': [], 'orders': []}), 200);
      }
      return respond(jsonEncode(_menu()), 200);
    });

/// The floating dock's tab with this name, found by its semantics label.
Finder navTab(String label) => find.descendant(
      of: find.byKey(const Key('nav-dock')),
      matching: find.byWidgetPredicate((w) => w is Semantics && w.properties.button == true && w.properties.label == label),
    );

void main() {
  setUpAll(loadCaptureFonts);

  Future<void> shoot(WidgetTester tester, String name, Widget Function(ApiClient api, ValueNotifier<String> language, SharedPreferences prefs) build, {String lang = 'en', Future<void> Function(WidgetTester tester)? after}) async {
    tester.view.physicalSize = const Size(390, 844) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    // ignore: invalid_use_of_visible_for_testing_member
    // No saved layout: the captures show the default home a new customer gets.
    // ignore: invalid_use_of_visible_for_testing_member
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final api = ApiClient(baseUrl: 'http://api.test', client: _server(), prefs: prefs);
    final language = ValueNotifier(lang);
    await tester.pumpWidget(captureApp(build(api, language, prefs), lang: lang));
    await tester.pumpAndSettle(const Duration(milliseconds: 300));
    if (after != null) await after(tester);
    // Pictures decode outside the fake clock, so give them real time to load before the frame is captured.
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
    await tester.pump(const Duration(milliseconds: 100));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
  }

  testWidgets('home', (tester) async {
    await shoot(tester, 'customer-home', (api, lang, prefs) => HomeScreen(api: api, language: lang, sessions: signedInStore(), auth: AuthApi(baseUrl: 'http://api.test', client: _server())));
  });
  testWidgets('menu', (tester) async {
    await shoot(tester, 'customer-menu', (api, lang, prefs) => MenuScreen(api: api, language: lang));
  });
  testWidgets('cart', (tester) async {
    await shoot(tester, 'customer-cart', (api, lang, prefs) => CartScreen(api: api, language: lang));
  });
  testWidgets('dish-sheet', (tester) async {
    await shoot(tester, 'customer-dish', (api, lang, prefs) => MenuScreen(api: api, language: lang), after: (tester) async {
      await tester.tap(find.text('Grilled chicken plate').first);
      await tester.pumpAndSettle(const Duration(milliseconds: 300));
    });
  });
  testWidgets('checkout', (tester) async {
    await shoot(tester, 'customer-checkout', (api, lang, prefs) => CheckoutScreen(api: api, language: lang));
  });
  testWidgets('orders', (tester) async {
    await shoot(tester, 'customer-orders', (api, lang, prefs) => OrdersScreen(api: api, language: lang));
  });
  testWidgets('order-tracking', (tester) async {
    await shoot(tester, 'customer-tracking', (api, lang, prefs) => OrderScreen(api: api, language: lang, orderId: 'o2'));
  });
  testWidgets('membership', (tester) async {
    await shoot(tester, 'customer-membership', (api, lang, prefs) => MembershipScreen(api: api, language: lang));
  });
  testWidgets('assistant', (tester) async {
    await shoot(tester, 'customer-assistant', (api, lang, prefs) => AssistantScreen(api: api, language: lang));
  });
  testWidgets('sign-in', (tester) async {
    await shoot(tester, 'customer-signin', (api, lang, prefs) => SignInScreen(auth: AuthApi(baseUrl: 'http://api.test', client: AuthServer().client()), sessions: MemorySessionStore(), biometrics: FakeBiometricGate(available: false), api: api, language: lang));
  });
  testWidgets('shell-home', (tester) async {
    await shoot(tester, 'customer-shell-home', (api, lang, prefs) => MainShell(api: api, language: lang, auth: AuthApi(baseUrl: 'http://api.test', client: _server()), sessions: signedInStore()));
  });
  testWidgets('shell-home-scrolled', (tester) async {
    await shoot(tester, 'customer-shell-home-scrolled', (api, lang, prefs) => MainShell(api: api, language: lang, auth: AuthApi(baseUrl: 'http://api.test', client: _server()), sessions: signedInStore()), after: (tester) async {
      await tester.drag(find.byType(ListView).first, const Offset(0, -700));
      await tester.pumpAndSettle(const Duration(milliseconds: 300));
    });
  });

  for (final (name, label) in [('shell-menu', 'Menu'), ('shell-orders', 'My orders'), ('shell-membership', 'Membership')]) {
    testWidgets(name, (tester) async {
      await shoot(tester, 'customer-$name', (api, lang, prefs) => MainShell(api: api, language: lang, auth: AuthApi(baseUrl: 'http://api.test', client: _server()), sessions: signedInStore()), after: (tester) async {
        await tester.tap(navTab(label));
        await tester.pumpAndSettle(const Duration(milliseconds: 300));
      });
    });
  }

  testWidgets('home-arabic', (tester) async {
    await shoot(tester, 'customer-home-ar', (api, lang, prefs) => HomeScreen(api: api, language: lang, sessions: signedInStore(), auth: AuthApi(baseUrl: 'http://api.test', client: _server())), lang: 'ar');
  });
}
