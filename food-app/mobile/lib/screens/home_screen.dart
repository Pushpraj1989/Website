import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/dashboard.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../auth/biometrics.dart';
import '../widgets/app_button.dart';
import '../widgets/dish_thumb.dart';
import '../widgets/home_sections.dart';
import 'cart_screen.dart';
import 'menu_screen.dart';
import 'order_screen.dart';
import '../widgets/ask_button.dart';
import 'assistant_screen.dart';
import 'sign_in_screen.dart';

// The customisable home. The user chooses which widgets show, and in what order, from the Customise sheet.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api, required this.language, this.auth, this.sessions, this.onSelectTab});
  final ApiClient api;
  final ValueNotifier<String> language;
  final AuthApi? auth;
  final SessionStore? sessions;
  /// Set inside the signed-in shell: switches tabs instead of opening a new screen. Null when shown on its own.
  final void Function(int index)? onSelectTab;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  DashboardStore? _store;
  DashboardLayout _layout = const DashboardLayout(defaultDashboard);
  Menu? _menu;
  HomeShortcuts? _shortcuts;
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
    await _refreshShortcuts();
    if (!mounted) return;
    setState(() => _layout = _store!.load());
  }

  /// The personal shortcuts. A failure only hides them; the rest of the home screen still works.
  Future<void> _refreshShortcuts() async {
    try {
      final shortcuts = await widget.api.homeShortcuts();
      if (mounted) setState(() => _shortcuts = shortcuts);
    } catch (_) {
      if (mounted) setState(() => _shortcuts = null);
    }
  }

  Future<void> _toggleFavourite(DishCard dish, bool on, Strings s) async {
    try {
      await widget.api.setFavourite(dish.id, on);
      await _refreshShortcuts();
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = s.genericError);
    }
  }

  Future<void> _reorder(String orderId, Strings s) async {
    setState(() => _message = null);
    try {
      final result = await widget.api.reorder(orderId);
      if (!mounted) return;
      setState(() => _message = [
            if (result.added.isNotEmpty) s.reorderAdded(result.added.length),
            if (result.skipped.isNotEmpty) s.reorderSkipped(result.skipped.join(', ')),
          ].join(' '));
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = s.genericError);
    }
  }

  Future<void> _signOut(Strings s) async {
    try {
      await widget.auth?.logout();
    } catch (_) {
      // Signing out must work even when the network does not; the local session is removed either way.
    }
    await widget.sessions?.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => SignInScreen(auth: widget.auth ?? AuthApi(baseUrl: ''), sessions: widget.sessions ?? defaultSessionStore(), biometrics: LocalAuthGate(), api: widget.api, language: widget.language)),
      (_) => false,
    );
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
    if (widget.onSelectTab != null) return widget.onSelectTab!(1);
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => MenuScreen(api: widget.api, language: widget.language)));
  }

  void _openAsk() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => AssistantScreen(api: widget.api, language: widget.language)));
  }

  void _openCart() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CartScreen(api: widget.api, language: widget.language)));
  }

  void _openTracking(String orderId) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(api: widget.api, language: widget.language, orderId: orderId)));
  }

  Future<void> _addDish(DishCard dish, Strings s) async {
    setState(() => _message = null);
    try {
      await widget.api.addOne(dish.id);
      if (mounted) setState(() => _message = '✓ ${dish.name.of(s.lang)}');
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = s.genericError);
    }
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
            AskButton(api: widget.api, language: widget.language, s: s),
            TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language)),
            PopupMenuButton<String>(
              tooltip: s.more,
              icon: const Icon(LucideIcons.ellipsisVertical),
              onSelected: (choice) => switch (choice) {
                'signout' => _signOut(s),
                _ => null,
              },
              itemBuilder: (_) => [
                if (widget.auth != null) PopupMenuItem(value: 'signout', child: ListTile(leading: const Icon(LucideIcons.logOut), title: Text(s.signOut))),
              ],
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(Tokens.space4),
          children: [
            Row(children: [
              Expanded(child: Text(s.home, style: Theme.of(context).textTheme.headlineSmall)),
              AppButton(label: s.customise, icon: LucideIcons.layoutDashboard, variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => _openCustomise(s)),
            ]),
            const SizedBox(height: Tokens.space3),
            RevealOnLoad(child: HomeHeroCarousel(s: s, onOrder: _openMenu, onAsk: _openAsk)),
            if (_menu != null) ...[
              const SizedBox(height: Tokens.space5),
              RevealOnLoad(child: HomeCategoryStrip(menu: _menu!, s: s, onOpen: _openMenu)),
              const SizedBox(height: Tokens.space5),
              RevealOnLoad(child: HomeRecommendedRow(menu: _menu!, s: s, mostOrderedIds: [for (final d in _shortcuts?.frequent ?? const <DishCard>[]) d.id], onAdd: (item) => _add(item, s))),
            ],
            const SizedBox(height: Tokens.space5),
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
      'last_order' => _LastOrder(s: s, order: _shortcuts?.lastOrder, onReorder: (id) => _reorder(id, s), onOpen: _openTracking),
      'frequent' => _DishList(s: s, currency: _menu?.currency ?? '', dishes: _shortcuts?.frequent ?? [], showTimes: true, favourites: _shortcuts?.favourites.map((d) => d.id).toSet() ?? {}, onAdd: (d) => _addDish(d, s), onFavourite: (d, on) => _toggleFavourite(d, on, s)),
      'favourites' => _DishList(s: s, currency: _menu?.currency ?? '', dishes: _shortcuts?.favourites ?? [], showTimes: false, favourites: _shortcuts?.favourites.map((d) => d.id).toSet() ?? {}, onAdd: (d) => _addDish(d, s), onFavourite: (d, on) => _toggleFavourite(d, on, s), emptyText: s.noFavourites),
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
      Expanded(child: _QuickTile(icon: LucideIcons.utensils, label: s.menu, onPressed: onMenu)),
      const SizedBox(width: Tokens.space2),
      Expanded(child: _QuickTile(icon: LucideIcons.shoppingBag, label: s.cart, onPressed: onCart)),
      const SizedBox(width: Tokens.space2),
      Expanded(child: _QuickTile(icon: LucideIcons.truck, label: s.trackOrder, onPressed: canTrack ? onTrack : null)),
    ]);
  }
}

/// One quick action: an icon above a label that may wrap to two lines, never cut off.
class _QuickTile extends StatelessWidget {
  const _QuickTile({required this.icon, required this.label, required this.onPressed});
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Material(
      color: enabled ? Tokens.bg : Tokens.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd), side: const BorderSide(color: Tokens.border)),
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.radiusMd),
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: Tokens.space3, horizontal: Tokens.space2),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, color: enabled ? Tokens.accent : Tokens.textMuted),
            const SizedBox(height: Tokens.space1),
            Text(label, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontWeight: FontWeight.w600, color: enabled ? Tokens.text : Tokens.textMuted)),
          ]),
        ),
      ),
    );
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
        final lines = (snapshot.data!['lines'] as List<dynamic>?) ?? const [];
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
    // Each dish shows its own category's picture, the same as on the menu.
    final pictureByDish = {for (final c in menu!.categories) for (final i in c.items) i.id: c.illustration};
    String illustrationFor(String dishId) => pictureByDish[dishId] ?? 'dish';
    return Column(children: [
      for (final item in items)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: Tokens.space1),
          child: Row(children: [
            DishThumb(illustration: illustrationFor(item.id), size: 48),
            const SizedBox(width: Tokens.space3),
            Expanded(child: Text(item.name.of(s.lang), maxLines: 2, overflow: TextOverflow.ellipsis)),
            Text(formatMoney(item.priceMinor, menu!.currency), style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(width: Tokens.space2),
            Tooltip(
              message: s.addDish(item.name.of(s.lang)),
              child: IconButton.filledTonal(
                onPressed: () => onAdd(item),
                style: IconButton.styleFrom(minimumSize: const Size(48, 48), backgroundColor: Tokens.accentSoft, foregroundColor: Tokens.accent),
                icon: const Icon(LucideIcons.plus),
                tooltip: s.addDish(item.name.of(s.lang)),
              ),
            ),
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

/// The last order with a single button to put it back in the cart. Dishes that are gone are named in the message.
class _LastOrder extends StatelessWidget {
  const _LastOrder({required this.s, required this.order, required this.onReorder, required this.onOpen});
  final Strings s;
  final OrderHistory? order;
  final void Function(String orderId) onReorder;
  final void Function(String orderId) onOpen;

  @override
  Widget build(BuildContext context) {
    final last = order;
    if (last == null) return Text(s.noOrdersYet);
    final lang = s.lang;
    final summary = last.items.map((i) => '${i.qty} × ${i.name.of(lang)}').join(', ');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(summary, maxLines: 2, overflow: TextOverflow.ellipsis),
      const SizedBox(height: Tokens.space2),
      Row(children: [
        TextButton(onPressed: () => onOpen(last.id), child: Text(s.viewOrder)),
        const Spacer(),
        FilledButton(onPressed: () => onReorder(last.id), child: Text(s.orderAgain)),
      ]),
    ]);
  }
}

/// A list of dishes with add and save-to-favourites buttons. Used for both the frequent and favourite widgets.
class _DishList extends StatelessWidget {
  const _DishList({
    required this.s,
    required this.currency,
    required this.dishes,
    required this.showTimes,
    required this.favourites,
    required this.onAdd,
    required this.onFavourite,
    this.emptyText,
  });
  final Strings s;
  final String currency;
  final List<DishCard> dishes;
  final bool showTimes;
  final Set<String> favourites;
  final void Function(DishCard dish) onAdd;
  final void Function(DishCard dish, bool on) onFavourite;
  final String? emptyText;

  @override
  Widget build(BuildContext context) {
    if (dishes.isEmpty) return Text(emptyText ?? s.noOrdersYet);
    final lang = s.lang;
    return Column(children: [
      for (final dish in dishes)
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(dish.name.of(lang)),
          subtitle: Text(
            [
              formatMoney(dish.priceMinor, currency),
              if (showTimes && dish.timesOrdered > 0) s.timesOrdered(dish.timesOrdered),
              if (dish.soldOut) s.soldOut,
            ].join(' · '),
          ),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(
              tooltip: favourites.contains(dish.id) ? s.removeFavourite : s.saveFavourite,
              icon: Icon(favourites.contains(dish.id) ? Icons.favorite : Icons.favorite_border),
              onPressed: () => onFavourite(dish, !favourites.contains(dish.id)),
            ),
            if (!dish.soldOut) AppButton(label: s.add, size: ButtonSize.sm, onPressed: () => onAdd(dish)),
          ]),
        ),
    ]);
  }
}
