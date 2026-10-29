import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/app.dart';
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
    apiBase: 'http://api.test',
    api: ApiClient(baseUrl: 'http://api.test', client: server.client()),
    auth: authWith(server),
    sessions: signedIn ? signedInStore(faceId: faceId) : MemorySessionStore(),
    biometrics: gate ?? FakeBiometricGate(available: false),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sign-up: name and mobile, the code sheet, email, verify email, the email code, then home', (tester) async {
    final server = AuthServer();
    await pumpApp(tester, server);

    // Start: the first screen is sign-in. Go to sign-up.
    expect(find.text('Sign in'), findsWidgets);
    await tester.tap(find.text('Create an account').first);
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Full name'), 'Sara Tester');
    await tester.enterText(find.widgetWithText(TextField, 'Mobile number'), '+971 50 123 4567');
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();

    // The phone code sheet comes up from the bottom.
    expect(find.text('Mobile code'), findsOneWidget);
    await tester.enterText(otpField(), '123456');
    await tester.pumpAndSettle();

    // Step two: the email. Nothing is sent until "Verify email" is pressed.
    expect(find.text('Add your email'), findsOneWidget);
    expect(server.calls.where((c) => c.contains('email/start')), isEmpty);
    await tester.enterText(find.widgetWithText(TextField, 'Email address'), 'sara@example.com');
    await tester.tap(find.text('Verify email'));
    await tester.pumpAndSettle();

    expect(server.calls.where((c) => c.contains('email/start')), hasLength(1), reason: 'the email code is sent on Verify email');
    expect(find.text('Email code'), findsOneWidget);
    await tester.enterText(otpField(), '123456');
    await tester.pumpAndSettle();

    expect(find.text('Sample Kitchen'), findsWidgets, reason: 'arrives at the home screen');
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('sign-in: an unknown number is told so and offered an account', (tester) async {
    final server = AuthServer(phoneRegistered: false);
    await pumpApp(tester, server);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('No account uses this number. Create one first.'), findsOneWidget);
    expect(find.text('Create an account'), findsWidgets);
  });

  testWidgets('sign-in with a registered number opens the code sheet and then home', (tester) async {
    final server = AuthServer();
    await pumpApp(tester, server);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Mobile code'), findsOneWidget);
    await tester.enterText(otpField(), '123456');
    await tester.pumpAndSettle();
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('a returning user with Face ID on is asked to unlock, and a failed unlock goes to sign-in', (tester) async {
    final server = AuthServer(emailVerified: true);
    final gate = FakeBiometricGate(available: true, passes: false);
    await pumpApp(tester, server, signedIn: true, faceId: true, gate: gate);
    expect(gate.prompts, 1, reason: 'Face ID is asked once at launch');
    expect(find.text('Popular on the menu'), findsNothing);
    expect(find.text('Sign in'), findsWidgets);
  });

  testWidgets('a returning user with Face ID that passes goes straight in', (tester) async {
    final server = AuthServer(emailVerified: true);
    final gate = FakeBiometricGate(available: true, passes: true);
    await pumpApp(tester, server, signedIn: true, faceId: true, gate: gate);
    await expectOnHome(tester, 'Popular on the menu');
  });

  testWidgets('a user who stopped before verifying email is taken back to the email step', (tester) async {
    final server = AuthServer(emailVerified: false);
    await pumpApp(tester, server, signedIn: true);
    expect(find.text('Add your email'), findsOneWidget);
  });
}
