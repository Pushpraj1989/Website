// The demo shell's message banner sits outside the app's navigator. Its buttons must still work: Copy puts the code
// on the clipboard (with a tooltip that needs an overlay), and Dismiss hides the message.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/demo/demo_inbox_banner.dart';
import 'package:sample_kitchen/demo/demo_server.dart';

void main() {
  testWidgets('the code banner copies the code and can be dismissed, with no errors', (tester) async {
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
      return null;
    });
    final inbox = DemoInbox();
    await tester.pumpWidget(DemoFrame(inbox: inbox, child: const MaterialApp(home: Scaffold(body: Text('app')))));
    inbox.value = DemoMessage(to: '+971500000000', text: '123456 is your code. It expires in 5 minutes.', at: DateTime(2026));
    await tester.pumpAndSettle();
    await tester.longPress(find.byTooltip('Copy the code'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Copy the code'));
    await tester.pumpAndSettle();
    expect(copied, '123456');
    await tester.tap(find.byTooltip('Dismiss'));
    await tester.pumpAndSettle();
    expect(find.textContaining('123456'), findsNothing);
    expect(tester.takeException(), isNull);
    // Let the tooltip's display time run out.
    await tester.pump(const Duration(minutes: 2));
  });
}
