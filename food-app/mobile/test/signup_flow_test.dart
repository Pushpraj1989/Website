import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/app.dart';
import 'package:sample_kitchen/auth/auth_api.dart';
import 'package:sample_kitchen/auth/biometrics.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sample_kitchen/auth/session_store.dart';
import 'package:sample_kitchen/widgets/otp_input.dart';
import 'auth_fakes.dart';
import 'helpers.dart';

/// The code field inside the open sheet (the form behind it has its own fields).
Finder otpField() => find.descendant(of: find.byType(OtpInput), matching: find.byType(TextField));

Future<void> pumpApp(WidgetTester tester, AuthServer server, {bool signedIn = false, bool faceId = false, FakeBiometricGate? gate}) async {
  SharedPreferences.setMockInitialValues({});
  await tester.pumpWidget(SampleKitchenApp(
    openingTime: Duration.zero,
    apiBase: 'http://api.test',
    api: ApiClient(baseUrl: 'http://api.test', client: server.client()),
    auth: authWith(server),
    sessions: signedIn ? signedInStore(faceId: faceId) : MemorySessionStore(),
    biometrics: gate ?? FakeBiometricGate(available: false),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sign-up: name, mobile and email, the email code sheet, then home', (tester) async {
    final server = AuthServer();
    await pumpApp(tester, server);

    // Start: the first screen is sign-in. Go to sign-up.
    expect(find.text('Sign in'), findsWidgets);
    await tester.dragUntilVisible(find.text('Create an account'), find.byType(ListView).first, const Offset(0, -200));
    await tester.tap(find.text('Create an account').first);
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Full name'), 'Sara Tester');
    await tester.enterText(find.widgetWithText(TextField, 'Mobile number'), '+971 50 123 4567');
    await tester.enterText(find.widgetWithText(TextField, 'Email address'), 'sara@example.com');
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();

    // One code, sent to the email; no text message and no second email step.
    expect(server.calls, contains('POST /v1/auth/signup/email'));
    expect(server.calls.where((c) => c.contains('/phone')), isEmpty);
    expect(server.email, 'sara@example.com');
    expect(find.text('Email code'), findsOneWidget);
    await tester.enterText(otpField(), '123456');
    await tester.pumpAndSettle();

    expect(find.text('Add your email'), findsNothing);
    expect(find.byTooltip('Cart'), findsWidgets, reason: 'arrives at the home screen');
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('sign-in: an unknown email is told so and offered an account', (tester) async {
    final server = AuthServer(phoneRegistered: false);
    await pumpApp(tester, server);
    await tester.enterText(find.widgetWithText(TextField, 'Email address'), 'nobody@example.com');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('No account uses this email. Create one first.'), findsOneWidget);
    expect(find.text('Create an account'), findsWidgets);
  });

  testWidgets('sign-in with a registered email opens the email code sheet and then home', (tester) async {
    final server = AuthServer(emailVerified: true);
    await pumpApp(tester, server);
    await tester.enterText(find.widgetWithText(TextField, 'Email address'), 'sara@example.com');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(server.calls, contains('POST /v1/auth/login/email'));
    expect(find.text('Email code'), findsOneWidget);
    await tester.enterText(otpField(), '123456');
    await tester.pumpAndSettle();
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('a returning user with Face ID on lands on the unlock screen; a failed unlock stays there with a way out', (tester) async {
    final server = AuthServer(emailVerified: true);
    final gate = FakeBiometricGate(available: true, passes: false);
    await pumpApp(tester, server, signedIn: true, faceId: true, gate: gate);
    expect(gate.prompts, 1, reason: 'Face ID is asked once at launch');
    expect(find.text('Popular on the menu'), findsNothing);
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text("Face ID didn't work. Try again, or use your email."), findsOneWidget);
    expect(find.text('Use an email code instead'), findsOneWidget);
    await tester.tap(find.text('Continue as guest'));
    await tester.pumpAndSettle();
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('a returning user with Face ID that passes goes straight in', (tester) async {
    final server = AuthServer(emailVerified: true);
    final gate = FakeBiometricGate(available: true, passes: true);
    await pumpApp(tester, server, signedIn: true, faceId: true, gate: gate);
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('an older account without a confirmed email is taken to the email step', (tester) async {
    final server = AuthServer(emailVerified: false);
    await pumpApp(tester, server, signedIn: true);
    expect(find.text('Add your email'), findsOneWidget);
  });

  testWidgets('a guest orders without an account, and the app opens on the menu next time', (tester) async {
    final server = AuthServer();
    await pumpApp(tester, server);
    await tester.dragUntilVisible(find.text('Continue as guest'), find.byType(ListView).first, const Offset(0, -200));
    await tester.tap(find.text('Continue as guest'));
    await tester.pumpAndSettle();
    await expectOnHome(tester, 'Popular on the menu');
    expect(server.calls.where((c) => c.contains('/auth/')), isEmpty, reason: 'no sign-in call for a guest');
    // Next launch: straight to the menu, no sign-in screen.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(SampleKitchenApp(
      openingTime: Duration.zero,
      apiBase: 'http://api.test',
      api: ApiClient(baseUrl: 'http://api.test', client: server.client()),
      auth: authWith(server),
      sessions: MemorySessionStore(),
      biometrics: FakeBiometricGate(available: false),
    ));
    await tester.pumpAndSettle();
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('Face ID before it was turned on says to sign in first', (tester) async {
    final server = AuthServer();
    final gate = FakeBiometricGate(available: true);
    await pumpApp(tester, server, gate: gate);
    await tester.dragUntilVisible(find.text('Sign in with Face ID'), find.byType(ListView).first, const Offset(0, -200));
    await tester.tap(find.text('Sign in with Face ID'));
    await tester.pumpAndSettle();
    expect(find.text('Please sign in with your email first, then you can turn on Face ID.'), findsOneWidget);
    expect(gate.prompts, 0, reason: 'Face ID is not asked for when it was never turned on');
  });

  testWidgets('after the first sign-in Face ID is offered, and saying yes turns it on', (tester) async {
    final server = AuthServer(emailVerified: true);
    final gate = FakeBiometricGate(available: true);
    final sessions = MemorySessionStore();
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(SampleKitchenApp(
      openingTime: Duration.zero, apiBase: 'http://api.test', api: ApiClient(baseUrl: 'http://api.test', client: server.client()),
      auth: authWith(server), sessions: sessions, biometrics: gate,
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Email address'), 'sara@example.com');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.enterText(otpField(), '123456');
    await tester.pumpAndSettle();
    expect(find.text('Use Face ID next time?'), findsOneWidget);
    await tester.tap(find.text('Turn on'));
    await tester.pumpAndSettle();
    expect(gate.enrolments, 1);
    expect(await sessions.faceIdEnabled(), isTrue);
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('in the browser, Face ID signs in with a passkey once it was turned on', (tester) async {
    final server = AuthServer(emailVerified: true);
    final gate = FakeBiometricGate(available: true, webSession: const Session(token: 'tok-passkey', account: Account(id: 'acc-1', name: 'Sara Tester', phone: '+971501234567', email: 'sara@example.com', emailVerified: true)));
    final sessions = MemorySessionStore()..face = true;
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(SampleKitchenApp(
      openingTime: Duration.zero, apiBase: 'http://api.test', api: ApiClient(baseUrl: 'http://api.test', client: server.client()),
      auth: authWith(server), sessions: sessions, biometrics: gate,
    ));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(find.text('Sign in with Face ID'), find.byType(ListView).first, const Offset(0, -200));
    await tester.tap(find.text('Sign in with Face ID'));
    await tester.pumpAndSettle();
    expect(await sessions.readToken(), 'tok-passkey');
    await expectOnHome(tester, 'Popular on the menu');
  });
}
