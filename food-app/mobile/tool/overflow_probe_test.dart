// Prints where a layout overflow happens, with the widget that overflowed. Used while fixing the sweep's findings.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/screens/main_shell.dart';
import 'package:sample_kitchen/screens/membership_screen.dart';

import 'audit_sweep_test.dart' as sweep;
import '../test/auth_fakes.dart';
import 'capture_support.dart';

void main() {
  setUpAll(loadCaptureFonts);
  for (final name in ['home', 'membership']) {
    testWidgets('probe $name', (tester) async {
      late dynamic w;
      await tester.runAsync(() async => w = await sweep.buildWorld());
      tester.view.physicalSize = const Size(390, 844) * 2;
      tester.view.devicePixelRatio = 2;
      tester.platformDispatcher.textScaleFactorTestValue = 1.4;
      addTearDown(tester.view.reset);
      final original = FlutterError.onError;
      FlutterError.onError = (d) {
        final text = d.toString();
        final at = text.split('\n').where((l) => l.contains('creator:') || l.contains('lib/') || l.contains('overflowed')).take(6).join('\n');
        // ignore: avoid_print
        print('--- $name\n$at');
      };
      final lang = ValueNotifier('en');
      await tester.pumpWidget(captureApp(name == 'home'
          ? MainShell(api: w.api, language: lang, auth: w.auth, sessions: signedInStore())
          : MembershipScreen(api: w.api, language: lang)));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 300));
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
      }
      FlutterError.onError = original;
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 20));
    });
  }
}
