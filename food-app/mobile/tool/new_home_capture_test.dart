// Captures of the redesigned home, built on the demo server and the promotions published in the test database
// (assets/demo/snapshot.json): the hero, the sections below it, the welcome pop-up, the slide-up cart and the menu.
// Run: flutter test tool/new_home_capture_test.dart --update-goldens   (writes tool/goldens/new-*.png)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/app.dart' show BrandSplash;
import 'package:sample_kitchen/auth/session_store.dart';
import 'package:sample_kitchen/core/brand.dart';
import 'package:sample_kitchen/core/strings.dart';
import 'package:sample_kitchen/screens/account_screen.dart';
import 'package:sample_kitchen/core/theme.dart';
import 'package:sample_kitchen/screens/main_shell.dart';
import 'package:sample_kitchen/screens/menu_screen.dart';
import 'package:sample_kitchen/widgets/cart_sheet.dart';
import 'package:sample_kitchen/widgets/welcome_offer.dart';

import '../test/auth_fakes.dart';
import 'audit_sweep_test.dart' show buildWorld, SweepWorld;
import 'capture_support.dart';

void main() {
  setUpAll(loadCaptureFonts);

  Future<void> shoot(WidgetTester tester, String name, Widget Function(SweepWorld w, ValueNotifier<String> lang) build,
      {AppTheme theme = AppTheme.classic, bool welcomeSeen = true, Future<void> Function()? after}) async {
    late SweepWorld w;
    await tester.runAsync(() async => w = await buildWorld());
    tester.view.physicalSize = const Size(390, 844) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    resetWelcomeForTests();
    if (welcomeSeen) {
      final prefs = await SharedPreferences.getInstance();
      final welcome = (w.snap['home'] as Map<String, dynamic>)['welcome'] as Map<String, dynamic>;
      await prefs.setString('welcome_${welcome['id']}', DateTime.now().toIso8601String().substring(0, 10));
    }
    final lang = ValueNotifier('en');
    await tester.pumpWidget(captureApp(build(w, lang), theme: theme));
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 300));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
    }
    if (after != null) await after();
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 20));
  }

  Widget shell(SweepWorld w, ValueNotifier<String> lang) => MainShell(api: w.api, language: lang, auth: w.auth, sessions: signedInStore());

  for (final theme in [AppTheme.classic, AppTheme.glassNight]) {
    final t = theme == AppTheme.classic ? '' : '-${theme.id}';
    testWidgets('home$t', (tester) => shoot(tester, 'new-home$t', shell, theme: theme));
    testWidgets('home scrolled$t', (tester) => shoot(tester, 'new-home-scrolled$t', shell, theme: theme, after: () async {
          await tester.drag(find.byType(ListView).first, const Offset(0, -620));
          for (var i = 0; i < 4; i++) {
            await tester.pump(const Duration(milliseconds: 300));
          }
        }));
    testWidgets('welcome$t', (tester) => shoot(tester, 'new-welcome$t', shell, theme: theme, welcomeSeen: false));
    testWidgets('cart sheet$t', (tester) => shoot(tester, 'new-cart-sheet$t', (w, lang) => Builder(builder: (context) {
          return _Opener(open: (c) => showCartSheet(c, api: w.api, language: lang, s: Strings(lang.value)));
        }), theme: theme));
    testWidgets('menu$t', (tester) => shoot(tester, 'new-menu$t', (w, lang) => MenuScreen(api: w.api, language: lang), theme: theme));
    testWidgets('account$t', (tester) => shoot(tester, 'new-account$t', (w, lang) => AccountScreen(api: w.api, language: lang, auth: w.auth, sessions: MemorySessionStore()), theme: theme));
    testWidgets('settings$t', (tester) => shoot(tester, 'new-settings$t', (w, lang) => SettingsScreen(api: w.api, language: lang, auth: w.auth, sessions: MemorySessionStore()), theme: theme));
    testWidgets('splash$t', (tester) => shoot(tester, 'new-splash$t', (w, lang) => BrandSplash(brand: Brand.fromJson(w.snap['brand'] as Map<String, dynamic>), lang: 'en'), theme: theme));
  }
}

class _Opener extends StatefulWidget {
  const _Opener({required this.open});
  final void Function(BuildContext context) open;

  @override
  State<_Opener> createState() => _OpenerState();
}

class _OpenerState extends State<_Opener> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.open(context));
  }

  @override
  Widget build(BuildContext context) => const Scaffold(body: SizedBox.expand());
}
