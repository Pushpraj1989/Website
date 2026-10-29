import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/dashboard.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/app_button.dart';
import 'cart_screen.dart';
import 'menu_screen.dart';
import 'order_screen.dart';

// The customisable home. The user chooses which widgets show, and in what order, from the Customise sheet.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  DashboardStore? _store;
  DashboardLayout _layout = const DashboardLayout(defaultDashboard);
  Menu? _menu;
  String? _message;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    _store = DashboardStore(prefs);
    try {
      _menu = await widget.api.menu();
    } catch (_) {
      // The popular widget shows its own error; the rest of the dashboard still works.
    }
    if (!mounted) return;
    setState(() => _layout = _store!.load());
  }

  Future<void> _saveLayout(DashboardLayout layout) async {
    setState(() => _layout = layout);
    await _store?.save(layout);
  }

  Future<void> _openCustomise(Strings s) async {
    var draft = _layout;
    final confirmed = await showModalBottomSheet<DashboardLayout>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheet) => _CustomiseSheet(
          s: s,
          layout: draft,
          onChanged: (next) => setSheet(() => draft = next),
          onConfirm: () => Navigator.of(context).pop(draft),
          onCancel: () => Navigator.of(context).pop(),
        ),
      ),
    );
    if (confirmed != null) await _saveLayout(confirmed);
  }

  void _openMenu() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => MenuScreen(api: widget.api, language: widget.language)));
  }

  void _openCart() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CartScreen(api: widget.api, language: widget.language)));
  }

  void _openTracking(String orderId) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(api: widget.api, language: widget.language, orderId: orderId)));
  }

  Future<void> _add(MenuItem item, Strings s) async {
    setState(() => _message = null);
    try {
      await widget.api.addOne(item.id);
      if (mounted) setState(() => _message = '✓ ${item.name.of(s.lang)}');
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = s.genericError);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        appBar: AppBar(
          title: Text(_menu?.restaurant.of(s.lang) ?? s.restaurantFallback),
          actions: [
            TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language)),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(Tokens.space4),
          children: [
            Row(children: [
              Expanded(child: Text(s.home, style: Theme.of(context).textTheme.headlineSmall)),
              AppButton(label: s.customise, icon: Icons.dashboard_customize_outlined, variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => _openCustomise(s)),
            ]),
            const SizedBox(height: Tokens.space3),
            for (final id in _layout.ids) ...[
              _widgetFor(id, s),
              const SizedBox(height: Tokens.space3),
            ],
            if (_message != null)
              Semantics(liveRegion: true, child: Text(_message!, style: const TextStyle(color: Tokens.textMuted))),
          ],
        ),
      ),
    );
  }

  Widget _widgetFor(String id, Strings s) {
    final def = defFor(id);
    if (def == null) return const SizedBox.shrink();
    final body = switch (id) {
      'quick_actions' => _QuickActions(s: s, canTrack: widget.api.lastOrderId != null, onMenu: _openMenu, onCart: _openCart, onTrack: () => _openTracking(widget.api.lastOrderId!)),
      'cart_summary' => _CartSummary(api: widget.api, s: s, onView: _openCart),
      'active_order' => _ActiveOrder(api: widget.api, s: s, orderId: widget.api.lastOrderId, onTrack: _openTracking),
      'popular' => _Popular(menu: _menu, s: s, onAdd: (item) => _add(item, s)),
      _ => const SizedBox.shrink(),
    };
    return _WidgetCard(title: def.title(s.lang), child: body);
  }
}

class _WidgetCard extends StatelessWidget {
  const _WidgetCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: title,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(Tokens.space4),
        decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: Tokens.space3),
            child,
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.s, required this.canTrack, required this.onMenu, required this.onCart, required this.onTrack});
  final Strings s;
  final bool canTrack;
  final VoidCallback onMenu;
  final VoidCallback onCart;
  final VoidCallback onTrack;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: AppButton(label: s.menu, icon: Icons.restaurant_menu, variant: ButtonVariant.secondary, expand: true, onPressed: onMenu)),
      const SizedBox(width: Tokens.space2),
      Expanded(child: AppButton(label: s.cart, icon: Icons.shopping_bag_outlined, variant: ButtonVariant.secondary, expand: true, onPressed: onCart)),
      const SizedBox(width: Tokens.space2),
      Expanded(child: AppButton(label: s.trackOrder, icon: Icons.local_shipping_outlined, variant: ButtonVariant.secondary, expand: true, onPressed: canTrack ? onTrack : null)),
    ]);
  }
}

class _CartSummary extends StatelessWidget {
  const _CartSummary({required this.api, required this.s, required this.onView});
  final ApiClient api;
  final Strings s;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: api.cart(),
      builder: (context, snapshot) {
        if (snapshot.hasError) return Text(s.genericError, style: const TextStyle(color: Tokens.danger));
        if (!snapshot.hasData) return const SizedBox(height: 24, child: LinearProgressIndicator());
        final lines = snapshot.data!['lines'] as List<dynamic>;
        final quote = snapshot.data!['quote'] == null ? null : Quote.fromJson(snapshot.data!['quote'] as Map<String, dynamic>);
        final count = lines.fold<int>(0, (sum, l) => sum + ((l as Map<String, dynamic>)['qty'] as int));
        if (count == 0) return Text(s.cartEmptyShort, style: const TextStyle(color: Tokens.textMuted));
        return Row(children: [
          Expanded(
            child: Text('${s.itemCount(count)}${quote == null ? '' : ' · ${formatMoney(quote.totalMinor, quote.currency)}'}'),
          ),
          AppButton(label: s.viewCart, variant: ButtonVariant.primary, size: ButtonSize.sm, onPressed: onView),
        ]);
      },
    );
  }
}

class _ActiveOrder extends StatelessWidget {
  const _ActiveOrder({required this.api, required this.s, required this.orderId, required this.onTrack});
  final ApiClient api;
  final Strings s;
  final String? orderId;
  final void Function(String orderId) onTrack;

  @override
  Widget build(BuildContext context) {
    if (orderId == null) return Text(s.noActiveOrder, style: const TextStyle(color: Tokens.textMuted));
    return FutureBuilder<PlacedOrder>(
      future: api.order(orderId!),
      builder: (context, snapshot) {
        if (snapshot.hasError) return Text(s.genericError, style: const TextStyle(color: Tokens.danger));
        if (!snapshot.hasData) return const SizedBox(height: 24, child: LinearProgressIndicator());
        final order = snapshot.data!;
        return Row(children: [
          Expanded(child: Text(s.statusLabel(order.status), style: const TextStyle(fontWeight: FontWeight.w600))),
          AppButton(label: s.trackOrder, variant: ButtonVariant.secondary, size: ButtonSize.sm, onPressed: () => onTrack(order.id)),
        ]);
      },
    );
  }
}

class _Popular extends StatelessWidget {
  const _Popular({required this.menu, required this.s, required this.onAdd});
  final Menu? menu;
  final Strings s;
  final ValueChanged<MenuItem> onAdd;

  @override
  Widget build(BuildContext context) {
    if (menu == null) return Text(s.genericError, style: const TextStyle(color: Tokens.danger));
    final items = [for (final c in menu!.categories) ...c.items].where((i) => !i.soldOut).take(3).toList();
    return Column(children: [
      for (final item in items)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: Tokens.space1),
          child: Row(children: [
            Expanded(child: Text(item.name.of(s.lang))),
            Text(formatMoney(item.priceMinor, menu!.currency), style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(width: Tokens.space2),
            AppButton(label: '${s.addWidget}: ${item.name.of(s.lang)}', variant: ButtonVariant.primary, size: ButtonSize.sm, onPressed: () => onAdd(item)),
          ]),
        ),
    ]);
  }
}

class _CustomiseSheet extends StatelessWidget {
  const _CustomiseSheet({required this.s, required this.layout, required this.onChanged, required this.onConfirm, required this.onCancel});
  final Strings s;
  final DashboardLayout layout;
  final ValueChanged<DashboardLayout> onChanged;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.of(context).viewInsets.bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space4, Tokens.space4 + padding),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.customiseTitle, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: Tokens.space1),
          Text(s.customiseHint(dashboardMin, dashboardMax), style: const TextStyle(color: Tokens.textMuted)),
          const SizedBox(height: Tokens.space4),
          Flexible(
            child: ListView(shrinkWrap: true, children: [
              Text(s.active, style: const TextStyle(fontWeight: FontWeight.w600)),
              for (var i = 0; i < layout.ids.length; i++)
                _Row(
                  label: defFor(layout.ids[i])!.title(s.lang),
                  trailing: [
                    IconButton(tooltip: '${s.moveUp}: ${defFor(layout.ids[i])!.title(s.lang)}', onPressed: i == 0 ? null : () => onChanged(layout.moveUp(i)), icon: const Icon(Icons.arrow_upward)),
                    IconButton(tooltip: '${s.moveDown}: ${defFor(layout.ids[i])!.title(s.lang)}', onPressed: i == layout.ids.length - 1 ? null : () => onChanged(layout.moveDown(i)), icon: const Icon(Icons.arrow_downward)),
                    AppButton(label: s.remove, variant: ButtonVariant.danger, size: ButtonSize.sm, onPressed: layout.canRemove() ? () => onChanged(layout.remove(layout.ids[i])) : null),
                  ],
                ),
              const SizedBox(height: Tokens.space3),
              Text(s.available, style: const TextStyle(fontWeight: FontWeight.w600)),
              for (final id in layout.available)
                _Row(
                  label: defFor(id)!.title(s.lang),
                  sub: defFor(id)!.desc(s.lang),
                  trailing: [AppButton(label: s.addWidget, variant: ButtonVariant.primary, size: ButtonSize.sm, onPressed: layout.canAdd() ? () => onChanged(layout.add(id)) : null)],
                ),
            ]),
          ),
          const SizedBox(height: Tokens.space3),
          AppButton(label: s.confirm, expand: true, size: ButtonSize.lg, onPressed: onConfirm),
          const SizedBox(height: Tokens.space2),
          AppButton(label: s.cancel, expand: true, size: ButtonSize.lg, variant: ButtonVariant.secondary, onPressed: onCancel),
        ]),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.trailing, this.sub});
  final String label;
  final String? sub;
  final List<Widget> trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: Tokens.space2),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Tokens.border))),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label),
            if (sub != null) Text(sub!, style: const TextStyle(color: Tokens.textMuted, fontSize: 12)),
          ]),
        ),
        ...trailing,
      ]),
    );
  }
}
