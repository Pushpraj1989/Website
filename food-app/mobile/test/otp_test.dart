import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/strings.dart';
import 'package:sample_kitchen/widgets/otp_input.dart';
import 'package:sample_kitchen/widgets/otp_sheet.dart';
import 'package:sample_kitchen/widgets/app_button.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/auth/auth_api.dart';

void main() {
  testWidgets('typing six digits reports each digit and completes once', (tester) async {
    final seen = <String>[];
    final completed = <String>[];
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: OtpInput(onChanged: seen.add, onCompleted: completed.add),
      ),
    ));
    await tester.enterText(find.byType(TextField), '12345');
    expect(completed, isEmpty);
    await tester.enterText(find.byType(TextField), '123456');
    expect(completed, ['123456']);
    expect(seen.last, '123456');
  });

  testWidgets('pasting a code fills the boxes, and letters are dropped', (tester) async {
    final seen = <String>[];
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: OtpInput(onChanged: seen.add))));
    await tester.enterText(find.byType(TextField), 'code 98 7-65 4');
    expect(seen.last, '987654');
  });

  testWidgets('the code boxes read as one labelled field for a screen reader', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: OtpInput(onChanged: (_) {}))));
    expect(find.bySemanticsLabel('Verification code, 6 digits'), findsOneWidget);
  });

  testWidgets('the sheet opens over the bottom half of the screen and accepts a correct code', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    const s = Strings('en');
    var verified = '';
    late bool result;
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () async {
              result = await showOtpSheet(
                context,
                s: s,
                sentTo: '+971 •••4567',
                purposeLabel: 'Mobile code',
                resendSeconds: 30,
                resend: () async => const Challenge(challengeId: 'x', sentTo: '+971 •••4567', resendInSeconds: 30),
                verify: (code) async => verified = code,
              );
            },
            child: const Text('open'),
          ),
        ),
      )),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // The sheet's title sits in the lower half of the 844 pt screen: it came up from the bottom.
    final top = tester.getTopLeft(find.text('Mobile code')).dy;
    expect(top, greaterThan(844 * 0.45));
    expect(find.text('Send a new code in 0:30'), findsOneWidget, reason: 'the resend countdown starts');

    expect(tester.widget<AppButton>(find.widgetWithText(AppButton, 'Verify')).onPressed, isNull, reason: 'disabled until six digits');
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    expect(verified, '123456', reason: 'six digits submit by themselves');
    expect(result, isTrue);
  });

  testWidgets('a wrong code shows the reason, clears the boxes, and keeps the sheet open', (tester) async {
    const s = Strings('en');
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () => showOtpSheet(
              context,
              s: s,
              sentTo: '+971 •••4567',
              purposeLabel: 'Mobile code',
              resendSeconds: 0,
              resend: () async => const Challenge(challengeId: 'x', sentTo: '+971 •••4567', resendInSeconds: 30),
              verify: (code) async => throw const ApiException('wrong_code', 'That code is wrong. 4 tries left.'),
            ),
            child: const Text('open'),
          ),
        ),
      )),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '000000');
    await tester.pumpAndSettle();
    expect(find.text('That code is wrong. 4 tries left.'), findsOneWidget);
    expect(find.text('Mobile code'), findsOneWidget, reason: 'the sheet stays open to try again');
    expect(find.text('Send a new code'), findsOneWidget, reason: 'with no countdown, a new code can be asked for');
  });
}
