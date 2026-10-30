import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';
import 'demo_server.dart';

/// Shows the demo's one-time codes the way a phone shows an incoming text: a card at the top that stays for a minute
/// or until it is dismissed. In the live app the code arrives by SMS or email instead.
class DemoInboxBanner extends StatefulWidget {
  const DemoInboxBanner({super.key, required this.inbox, required this.child});
  final DemoInbox inbox;
  final Widget child;

  @override
  State<DemoInboxBanner> createState() => _DemoInboxBannerState();
}

class _DemoInboxBannerState extends State<DemoInboxBanner> {
  DemoMessage? _shown;

  @override
  void initState() {
    super.initState();
    widget.inbox.addListener(_onMessage);
  }

  @override
  void dispose() {
    widget.inbox.removeListener(_onMessage);
    super.dispose();
  }

  void _onMessage() {
    final message = widget.inbox.value;
    setState(() => _shown = message);
    Future<void>.delayed(const Duration(minutes: 1), () {
      if (mounted && identical(_shown, message)) setState(() => _shown = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final message = _shown;
    return Stack(
      textDirection: TextDirection.ltr,
      children: [
        widget.child,
        if (message != null)
          Positioned(
            left: 12,
            right: 12,
            top: (MediaQuery.maybeOf(context)?.padding.top ?? 0) + 8,
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Semantics(
                liveRegion: true,
                label: 'Message to ${message.to}: ${message.text}',
                child: Material(
                  color: Tokens.text,
                  borderRadius: BorderRadius.circular(Tokens.radiusLg),
                  elevation: 6,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 4, 12),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                          Text('Messages · to ${message.to}', style: const TextStyle(color: Color(0xFFD6D3D1), fontSize: 12)),
                          const SizedBox(height: 4),
                          SelectableText(message.text, style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.3)),
                        ]),
                      ),
                      IconButton(
                        tooltip: 'Copy the code',
                        onPressed: () => Clipboard.setData(ClipboardData(text: RegExp(r'\d{6}').firstMatch(message.text)?.group(0) ?? message.text)),
                        icon: const Icon(Icons.copy, color: Colors.white),
                      ),
                      IconButton(tooltip: 'Dismiss', onPressed: () => setState(() => _shown = null), icon: const Icon(Icons.close, color: Colors.white)),
                    ]),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Wraps the demo app: a strip at the top says it is a demo, so a demo build is never mistaken for the live app, and
/// the app below it gets the rest of the screen. The strip covers no control of the app.
class DemoFrame extends StatelessWidget {
  const DemoFrame({super.key, required this.inbox, required this.child});
  final DemoInbox inbox;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MediaQuery.fromView(
      view: View.of(context),
      child: Builder(builder: (context) {
        final top = MediaQuery.paddingOf(context).top;
        return Directionality(
          textDirection: TextDirection.ltr,
          child: ColoredBox(
            color: Tokens.text,
            child: Column(children: [
              Padding(
                padding: EdgeInsets.only(top: top),
                child: const SizedBox(
                  height: 22,
                  child: Center(
                    child: Text('DEMO · runs on exported data · nothing is sent',
                        style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.4, decoration: TextDecoration.none)),
                  ),
                ),
              ),
              Expanded(
                child: MediaQuery.removePadding(context: context, removeTop: true, child: DemoInboxBanner(inbox: inbox, child: child)),
              ),
            ]),
          ),
        );
      }),
    );
  }
}
