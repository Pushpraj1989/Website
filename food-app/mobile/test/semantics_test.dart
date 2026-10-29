// Screen-reader and touch checks on the signed-in shell, read from the widget tree the way a screen reader reads it:
// every icon-only control has a name, every tab has a label, and every icon control is at least 48 px square.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/screens/main_shell.dart';

import 'helpers.dart';

void main() {
  Future<void> pumpShell(WidgetTester tester, {String lang = 'en'}) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final api = ApiClient(
      baseUrl: 'http://api.test',
      prefs: prefs,
      client: MockClient((request) async => respond(jsonEncode(menuPayload()), 200)),
    );
    await tester.pumpWidget(MaterialApp(
      locale: Locale(lang),
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      home: MainShell(api: api, language: ValueNotifier(lang)),
    ));
    await tester.pumpAndSettle();
  }

  testWidgets('every icon-only button on the home tab has a name a screen reader can read', (tester) async {
    await pumpShell(tester);
    final buttons = tester.widgetList<IconButton>(find.byType(IconButton));
    expect(buttons, isNotEmpty);
    for (final b in buttons) {
      expect(b.tooltip, isNotNull, reason: 'an icon button without a name is silent to a screen reader');
      expect(b.tooltip!.trim(), isNotEmpty);
    }
  });

  testWidgets('every icon control is at least 48 px square', (tester) async {
    await pumpShell(tester);
    for (final finder in [find.byType(IconButton), find.byType(PopupMenuButton<String>)]) {
      for (final element in finder.evaluate()) {
        final size = tester.getSize(find.byElementPredicate((e) => e == element));
        expect(size.width, greaterThanOrEqualTo(48));
        expect(size.height, greaterThanOrEqualTo(48));
      }
    }
  });

  testWidgets('the bottom bar has four tabs, each with a name', (tester) async {
    await pumpShell(tester);
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.destinations.length, 4);
    for (final d in bar.destinations.cast<NavigationDestination>()) {
      expect(d.label.trim(), isNotEmpty);
      expect(d.tooltip, d.label, reason: 'the tab name is also its tooltip');
    }
  });

  testWidgets('the Ask button names what it does, in Arabic too', (tester) async {
    await pumpShell(tester, lang: 'ar');
    // The icon button's tooltip is its name for screen readers.
    expect(find.byTooltip('اسأل المطعم'), findsWidgets);
  });
}
