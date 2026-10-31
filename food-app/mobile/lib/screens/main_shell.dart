import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/biometrics.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/discovery.dart';
import 'home_screen.dart';
import 'account_screen.dart';
import 'menu_screen.dart';
import 'orders_screen.dart';
import '../core/strings.dart';

// The signed-in app: four destinations in a floating pill dock: Home, Menu, Orders and Account (membership,
// vouchers, settings and About live under Account). The assistant is a button in the Home and Menu
// headers, so it is one tap away without taking a tab. Each tab keeps its place when the customer switches away.
class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.api, required this.language, this.auth, this.sessions, this.biometrics});
  final ApiClient api;
  final ValueNotifier<String> language;
  final AuthApi? auth;
  final SessionStore? sessions;
  final BiometricGate? biometrics;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  void _select(int index) => setState(() => _index = index);

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        body: Stack(children: [
          IndexedStack(
            index: _index,
            children: [
              HomeScreen(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions, onSelectTab: _select),
              MenuScreen(api: widget.api, language: widget.language),
              OrdersScreen(api: widget.api, language: widget.language),
              AccountScreen(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics, onSelectTab: _select),
            ],
          ),
          Positioned(
            left: Tokens.space4,
            right: Tokens.space4,
            bottom: MediaQuery.paddingOf(context).bottom + Tokens.dockGap,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: KeyedSubtree(
                  key: const Key('nav-dock'),
                  child: FloatingDock(
                    index: _index,
                    onSelect: _select,
                    items: [
                      DockItem(icon: LucideIcons.house, label: s.home),
                      DockItem(icon: Strings.shop ? LucideIcons.store : LucideIcons.utensils, label: s.menu),
                      DockItem(icon: LucideIcons.receiptText, label: s.orderHistory),
                      DockItem(icon: LucideIcons.user, label: s.account),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
