import 'package:flutter/material.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import 'home_screen.dart';
import 'membership_screen.dart';
import 'menu_screen.dart';
import 'orders_screen.dart';

// The signed-in app: four destinations in a bottom bar. The assistant is a floating button on Home and Menu,
// so it is one tap away without taking a tab. Each tab keeps its place when the customer switches away.
class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.api, required this.language, this.auth, this.sessions});
  final ApiClient api;
  final ValueNotifier<String> language;
  final AuthApi? auth;
  final SessionStore? sessions;

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
        body: IndexedStack(
          index: _index,
          children: [
            HomeScreen(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions, onSelectTab: _select),
            MenuScreen(api: widget.api, language: widget.language),
            OrdersScreen(api: widget.api, language: widget.language),
            MembershipScreen(api: widget.api, language: widget.language),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _select,
          destinations: [
            NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: s.home, tooltip: s.home),
            NavigationDestination(icon: const Icon(Icons.restaurant_menu_outlined), selectedIcon: const Icon(Icons.restaurant_menu), label: s.menu, tooltip: s.menu),
            NavigationDestination(icon: const Icon(Icons.receipt_long_outlined), selectedIcon: const Icon(Icons.receipt_long), label: s.orderHistory, tooltip: s.orderHistory),
            NavigationDestination(icon: const Icon(Icons.workspace_premium_outlined), selectedIcon: const Icon(Icons.workspace_premium), label: s.membership, tooltip: s.membership),
          ],
        ),
      ),
    );
  }
}
