// Captures of the sign-in and sign-up screens, in English and Arabic, in the classic and Glass night themes, with an
// error showing, so their alignment can be checked by eye. Fails if any screen overflows.
// Run: flutter test tool/auth_capture_test.dart --update-goldens   (writes tool/goldens/auth-*.png)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/strings.dart';
import 'package:sample_kitchen/auth/biometrics.dart';
import 'package:sample_kitchen/auth/session_store.dart';
import 'package:sample_kitchen/core/theme.dart';
import 'package:sample_kitchen/screens/sign_in_screen.dart';
import 'package:sample_kitchen/screens/sign_up_screen.dart';

import '../test/auth_fakes.dart';
import 'capture_support.dart';

void main() {
  setUpAll(loadCaptureFonts);

  Future<void> shoot(WidgetTester tester, String name, Widget Function(ValueNotifier<String> lang) build,
      {String lang = 'en', AppTheme theme = AppTheme.classic, Future<void> Function()? after}) async {
    tester.view.physicalSize = const Size(390, 844) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final language = ValueNotifier(lang);
    await tester.pumpWidget(captureApp(build(language), lang: lang, theme: theme));
    await tester.pumpAndSettle();
    if (after != null) await after();
    expect(tester.takeException(), isNull, reason: 'nothing overflows');
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
  }

  final server = AuthServer(phoneRegistered: false);
  Widget signIn(ValueNotifier<String> lang) => SignInScreen(auth: authWith(server), sessions: MemorySessionStore(), biometrics: FakeBiometricGate(available: false), api: ApiClient(baseUrl: 'http://api.test', client: server.client()), language: lang);
  Widget signUp(ValueNotifier<String> lang) => SignUpScreen(auth: authWith(server), sessions: MemorySessionStore(), biometrics: FakeBiometricGate(available: false), api: ApiClient(baseUrl: 'http://api.test', client: server.client()), language: lang);

  for (final lang in ['en', 'ar']) {
    for (final theme in [AppTheme.classic, AppTheme.glassNight]) {
      final t = '$lang${theme == AppTheme.classic ? '' : '-${theme.id}'}';
      testWidgets('sign-in $t', (tester) => shoot(tester, 'auth-sign-in-$t', signIn, lang: lang, theme: theme));
      testWidgets('sign-up $t', (tester) => shoot(tester, 'auth-sign-up-$t', signUp, lang: lang, theme: theme));
    }
    testWidgets('sign-in error $lang', (tester) => shoot(tester, 'auth-sign-in-error-$lang', signIn, lang: lang, after: () async {
          await tester.enterText(find.byType(TextField).first, 'nobody@example.com');
          await tester.tap(find.text(Strings(lang).continueLabel));
          await tester.pumpAndSettle();
        }));
  }
}
