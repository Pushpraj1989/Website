import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/art.dart';
import '../core/dashboard.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../core/brand.dart';
import '../auth/biometrics.dart';
import '../widgets/app_button.dart';
import '../widgets/dish_thumb.dart';
import '../widgets/discovery.dart';
import '../widgets/cart_sheet.dart';
import '../widgets/dish_sheet.dart';
import '../widgets/home_hero.dart';
import '../widgets/home_sections.dart';
import '../widgets/top_icons.dart';
import '../widgets/welcome_offer.dart';
import 'about_screen.dart';
import 'cart_screen.dart';
import 'menu_screen.dart';
import 'order_screen.dart';
import '../widgets/ask_button.dart';
import 'assistant_screen.dart';
import 'membership_screen.dart';
import 'vouchers_screen.dart';
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
  HomePromotions? _promotions;
  String? _message;
  // The customer's own vouchers and membership, for "Redeem and save". Null until loaded or when signed out.
  int? _voucherCount;
  String? _memberPlan;
  String? _addressLabel;

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
    await _loadPromotions();
    await _loadAccount();
    if (!mounted) return;
    setState(() => _layout = _store!.load());
    await _maybeWelcome();
  }

  /// Vouchers, membership and the default address. Each is optional: a signed-out customer simply has none.
  Future<void> _loadAccount() async {
    try {
      final wallet = await widget.api.wallet();
      _voucherCount = wallet.available.length;
    } catch (_) {}
    try {
      final m = await widget.api.membership();
      _memberPlan = m.plans.where((p) => p.id == m.membershipPlanId).firstOrNull?.name.of(widget.language.value);
    } catch (_) {}
    try {
      final addresses = await widget.api.addresses();
      _addressLabel = (addresses.where((a) => a.isDefault).firstOrNull ?? addresses.firstOrNull)?.label;
    } catch (_) {}
    if (mounted) setState(() {});
  }

  /// The pop-up staff published, at most as often as they chose.
  Future<void> _maybeWelcome() async {
    final promo = _promotions?.welcome;
    if (promo == null || !mounted) return;
    if (!await shouldShowWelcome(promo, prefs: await SharedPreferences.getInstance())) return;
    if (!mounted) return;
    final s = Strings(widget.language.value);
    await showWelcomeOffer(context, promo: promo, s: s, onAction: () => _openPromo(promo, s, details: false));
  }

  /// A promotion's button: its dish when staff linked one, otherwise the menu. A linked offer can open its details first.
  void _openPromo(Promotion promo, Strings s, {bool details = true}) {
    if (details && promo.offer != null) {
      showWelcomeOffer(context, promo: promo, s: s, onAction: () => _openPromo(promo, s, details: false));
      return;
    }
    final id = promo.menuItemId;
    final menu = _menu;
    if (id != null && menu != null) {
      for (final c in menu.categories) {
        for (final item in c.items) {
          if (item.id == id) {
            showDishSheet(context, api: widget.api, item: item, illustration: c.illustration, currency: menu.currency, s: s);
            return;
          }
        }
      }
    }
    _openMenu();
  }

  /// The promotions staff published in the admin. Without any, the home shows the built-in welcome banner.
  Future<void> _loadPromotions() async {
    try {
      final promos = await widget.api.homePromotions();
      if (mounted) setState(() => _promotions = promos);
    } catch (_) {
      // The built-in banners still show.
    }
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
    widget.api.accessToken = null;
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

  void _openVouchers() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => VouchersScreen(api: widget.api, language: widget.language)));
  }

  void _openCart() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CartScreen(api: widget.api, language: widget.language)));
  }

  void _openCartSheet(Strings s) => showCartSheet(context, api: widget.api, language: widget.language, s: s);

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

  String _query = '';
  String? _category;
  final Set<String> _filters = {};

  void _openMembership() {
    if (widget.onSelectTab != null) return widget.onSelectTab!(3);
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => MembershipScreen(api: widget.api, language: widget.language)));
  }

  /// Picks the dishes for the recommended row: the dishes the customer orders most when there is history.
  ({List<DishPick> picks, bool personal}) _recommended(Menu menu) {
    final picks = [
      for (final c in menu.categories)
        for (final item in c.items)
          if (!item.soldOut) DishPick(item: item, illustration: c.illustration),
    ];
    final rank = {for (var i = 0; i < (_shortcuts?.frequent.length ?? 0); i++) _shortcuts!.frequent[i].id: i};
    final personal = picks.any((p) => rank.containsKey(p.item.id));
    if (personal) picks.sort((a, b) => (rank[a.item.id] ?? 1 << 20).compareTo(rank[b.item.id] ?? 1 << 20));
    return (picks: picks.take(8).toList(), personal: personal);
  }

  /// The filter chips. Each one keeps only the dishes that pass its test.
  List<FilterOption> _filterOptions(Strings s) {
    final favourites = {for (final d in _shortcuts?.favourites ?? const <DishCard>[]) d.id};
    final ordered = {for (final d in _shortcuts?.frequent ?? const <DishCard>[]) d.id};
    return [
      FilterOption(id: 'available', label: s.filterAvailable, keep: (i) => !i.soldOut),
      FilterOption(id: 'under', label: s.filterUnder, keep: (i) => i.priceMinor < 2000),
      FilterOption(id: 'favourites', label: s.filterFavourites, keep: (i) => favourites.contains(i.id)),
      FilterOption(id: 'ordered', label: s.filterOrdered, keep: (i) => ordered.contains(i.id)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final menu = _menu;
        final brand = BrandScope.of(context);
        final name = brand?.name.of(s.lang) ?? menu?.restaurant.of(s.lang) ?? '';
        final dockSpace = widget.onSelectTab != null ? Tokens.dockHeight + Tokens.dockGap : 0.0;
        final bottomSpace = MediaQuery.paddingOf(context).bottom + dockSpace;
        final screen = MediaQuery.sizeOf(context);
        final heroPromos = _promotions?.hero ?? const <Promotion>[];
        final slides = [
          for (final p in heroPromos)
            HeroSlide(
              background: HeroSlide.mediaFor(p, context.accent),
              kicker: p.kicker.of(s.lang),
              title: p.title.of(s.lang),
              body: p.body.of(s.lang),
              action: p.cta.of(s.lang).isEmpty ? s.orderNow : p.cta.of(s.lang),
              onAction: () => _openPromo(p, s),
              seconds: p.look.durationSeconds,
              animation: p.look.animation,
            ),
          if (heroPromos.isEmpty) builtInHeroSlide(s, _openMenu),
        ];
        final filtering = _query.isNotEmpty || _filters.isNotEmpty || _category != null;
        const pad = EdgeInsets.symmetric(horizontal: Tokens.space4);
        return AnnotatedRegion<SystemUiOverlayStyle>(
          // The hero runs under the status bar, so its icons are light.
          value: SystemUiOverlayStyle.light,
          child: Scaffold(
            body: Stack(children: [
              ListView(
                padding: EdgeInsets.only(bottom: bottomSpace + Tokens.cartBarHeight + Tokens.space5),
                children: [
                  HomeHero(
                    slides: slides,
                    height: HomeHero.heightFor(heroPromos.isEmpty ? 'standard' : heroPromos.first.look.size, screen),
                    title: name,
                    subtitle: _addressLabel == null ? null : s.deliverToLabel(_addressLabel!),
                    logoUrl: brand?.logoUrl,
                    s: s,
                    icons: [
                      AskButton(api: widget.api, language: widget.language, s: s),
                      if (screen.width >= 420) LanguageIcon(language: widget.language, s: s, onPhoto: true),
                      CartIcon(api: widget.api, s: s, onPhoto: true, onTap: () => _openCartSheet(s)),
                      _MoreMenu(
                        s: s,
                        signedIn: widget.auth != null,
                        showLanguage: screen.width < 420,
                        onChoice: (choice) => switch (choice) {
                          'language' => toggleLanguage(widget.language),
                          'vouchers' => _openVouchers(),
                          'about' => openAbout(context, widget.language),
                          'signout' => _signOut(s),
                          _ => null,
                        },
                      ),
                    ],
                    search: _HeroSearch(hint: s.searchDishes, onChanged: (q) => setState(() => _query = q.trim())),
                  ),
                  // The categories sit on a panel that rises over the foot of the hero.
                  Transform.translate(
                    offset: const Offset(0, -18),
                    child: Container(
                      decoration: BoxDecoration(color: Tokens.palette.isGlass ? Tokens.palette.sheet.withValues(alpha: 0.0) : Tokens.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(22))),
                      padding: const EdgeInsets.only(top: Tokens.space4),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        if (menu != null) ...[
                          Padding(
                            padding: pad,
                            child: CategoryTabs(
                              tabs: [
                                CategoryTab(id: '', label: s.allCategories, image: Art.hero),
                                for (final c in menu.categories) CategoryTab(id: c.id, label: c.name.of(s.lang), image: Art.forCategory(c.illustration)),
                              ],
                              selectedId: _category ?? '',
                              onSelect: (id) => setState(() => _category = id.isEmpty ? null : id),
                            ),
                          ),
                          const SizedBox(height: Tokens.space3),
                          Padding(
                            padding: pad,
                            child: FilterChips(
                              options: _filterOptions(s),
                              selected: _filters,
                              onToggle: (id) => setState(() => _filters.contains(id) ? _filters.remove(id) : _filters.add(id)),
                            ),
                          ),
                        ],
                        if (menu != null && filtering) Padding(padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space4, Tokens.space4, 0), child: _discovery(menu, s)),
                        if (!filtering) ..._sections(context, s, menu, name, pad),
                        if (_message != null)
                          Padding(padding: pad, child: Semantics(liveRegion: true, child: Text(_message!, style: TextStyle(color: Tokens.textMuted)))),
                      ]),
                    ),
                  ),
                ],
              ),
              Positioned(
                left: Tokens.space4,
                right: Tokens.space4,
                bottom: bottomSpace + Tokens.space2,
                child: _FloatingCart(api: widget.api, s: s, menu: menu, strip: _promotions?.strip, onView: () => _openCartSheet(s), onStrip: (p) => _openPromo(p, s)),
              ),
            ]),
          ),
        );
      },
    );
  }

  /// Everything below the categories when the customer is not searching: offers, their vouchers and membership,
  /// recommendations, the spotlight, order again, shortcuts to the rest of the app, the menu, their own widgets and
  /// the footer. Sections with nothing to show are left out.
  List<Widget> _sections(BuildContext context, Strings s, Menu? menu, String name, EdgeInsets pad) {
    const gap = SizedBox(height: Tokens.space5);
    final carousel = _promotions?.carousel ?? const <Promotion>[];
    final frequent = _shortcuts?.frequent ?? const <DishCard>[];
    return [
      if (carousel.isNotEmpty) ...[
        gap,
        Padding(padding: pad, child: HomeSectionTitle(title: s.offersForYou)),
        OffersCarousel(promos: carousel, s: s, onOpen: (p) => _openPromo(p, s)),
      ],
      if (_voucherCount != null) ...[
        gap,
        Padding(padding: pad, child: HomeSectionTitle(title: s.redeemAndSave)),
        Padding(padding: pad, child: RedeemRow(vouchers: _voucherCount!, memberPlan: _memberPlan, s: s, onVouchers: _openVouchers, onMembership: _openMembership)),
      ],
      if (menu != null) ...[
        gap,
        Padding(padding: pad, child: _discovery(menu, s, feed: false)),
      ],
      for (final p in _promotions?.midFeed ?? const <Promotion>[]) ...[
        gap,
        Padding(padding: pad, child: HomeSectionTitle(title: s.inTheSpotlight)),
        Padding(padding: pad, child: SpotlightCard(promo: p, s: s, onOpen: () => _openPromo(p, s))),
      ],
      if (frequent.isNotEmpty) ...[
        gap,
        Padding(padding: pad, child: HomeSectionTitle(title: s.orderAgain)),
        Padding(padding: pad, child: OrderAgainRow(dishes: frequent, s: s, onAdd: (d) => _addDish(d, s))),
      ],
      gap,
      Padding(padding: pad, child: HomeSectionTitle(title: s.exploreMore)),
      Padding(
        padding: pad,
        child: ExploreRow(items: [
          (icon: LucideIcons.ticketPercent, label: s.myVouchers, colours: const [Color(0xFFDB2777), Color(0xFF9D174D)], onTap: _openVouchers),
          (icon: LucideIcons.crown, label: s.membership, colours: const [Color(0xFFD97706), Color(0xFF92400E)], onTap: _openMembership),
          (icon: LucideIcons.sparkles, label: s.askTitle, colours: const [Color(0xFF2563EB), Color(0xFF1E3A8A)], onTap: _openAsk),
          (icon: LucideIcons.utensils, label: s.menu, colours: const [Color(0xFF059669), Color(0xFF065F46)], onTap: _openMenu),
        ]),
      ),
      if (menu != null) ...[
        gap,
        Padding(padding: pad, child: HomeSectionTitle(title: s.browseMenu)),
        for (final c in menu.categories)
          Padding(
            padding: const EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space4, Tokens.space3),
            child: FeedCategoryCard(title: c.name.of(s.lang), count: c.items.length, image: Art.forCategory(c.illustration), s: s, onTap: () => setState(() => _category = c.id)),
          ),
      ],
      gap,
      Padding(
        padding: pad,
        child: Row(children: [
          Expanded(child: Text(s.yourShortcuts, style: Theme.of(context).textTheme.titleLarge)),
          AppButton(label: s.customise, icon: LucideIcons.layoutDashboard, variant: ButtonVariant.ghost, size: ButtonSize.sm, onPressed: () => _openCustomise(s)),
        ]),
      ),
      const SizedBox(height: Tokens.space3),
      for (final id in _layout.ids)
        Padding(padding: const EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space4, Tokens.space3), child: _widgetFor(id, s)),
      gap,
      Padding(padding: pad, child: HomeFooter(name: name, s: s, onAbout: () => openAbout(context, widget.language))),
    ];
  }

  /// The search and filter results when either is active; otherwise the recommended row and the category feed.
  Widget _discovery(Menu menu, Strings s, {bool feed = true}) {
    final filtering = _query.isNotEmpty || _filters.isNotEmpty || _category != null;
    final currency = menu.currency;
    if (filtering) {
      final options = _filterOptions(s);
      final active = [for (final o in options) if (_filters.contains(o.id)) o];
      final matches = <DishPick>[];
      for (final c in menu.categories) {
        if (_category != null && c.id != _category) continue;
        for (final item in c.items) {
          if (_query.isNotEmpty && !item.name.of(s.lang).toLowerCase().contains(_query.toLowerCase())) continue;
          if (!active.every((o) => o.keep(item))) continue;
          matches.add(DishPick(item: item, illustration: c.illustration));
        }
      }
      if (matches.isEmpty) return Text(s.noSearchResults, style: TextStyle(color: Tokens.textMuted));
      return Column(children: [
        for (final pick in matches)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: Tokens.space1),
            child: Row(children: [
              DishThumb(illustration: pick.illustration, imageUrl: pick.item.imageUrl, size: 64),
              const SizedBox(width: Tokens.space3),
              Expanded(child: Text(pick.item.name.of(s.lang), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
              Text(formatMoney(pick.item.priceMinor, currency), style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(width: Tokens.space2),
              Semantics(
                button: true,
                label: s.addDish(pick.item.name.of(s.lang)),
                onTap: () => _add(pick.item, s),
                child: ExcludeSemantics(
                  child: IconButton.filledTonal(
                    onPressed: pick.item.soldOut ? null : () => _add(pick.item, s),
                    style: IconButton.styleFrom(minimumSize: const Size(48, 48), backgroundColor: context.accentSoft, foregroundColor: context.accentInk),
                    icon: const Icon(LucideIcons.plus),
                    tooltip: s.addDish(pick.item.name.of(s.lang)),
                  ),
                ),
              ),
            ]),
          ),
      ]);
    }
    final rec = _recommended(menu);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      DishCarousel(
        title: s.recommendedForYou,
        caption: rec.personal ? s.recommendedFromHistory : s.recommendedStarter,
        items: rec.picks,
        currency: currency,
        s: s,
        onAdd: (item) => _add(item, s),
      ),
      if (feed) const SizedBox(height: Tokens.space5),
      if (feed)
      for (final c in menu.categories) ...[
        FeedCategoryCard(
          title: c.name.of(s.lang),
          count: c.items.length,
          image: Art.forCategory(c.illustration),
          s: s,
          onTap: () => setState(() => _category = c.id),
        ),
        const SizedBox(height: Tokens.space3),
      ],
    ]);
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
        decoration: BoxDecoration(color: Tokens.fill, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
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
      color: enabled ? Tokens.bg : Tokens.fill,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd), side: BorderSide(color: Tokens.border)),
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.radiusMd),
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: Tokens.space3, horizontal: Tokens.space2),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, color: enabled ? context.accentFg : Tokens.textMuted),
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
        if (snapshot.hasError) return Text(s.genericError, style: TextStyle(color: Tokens.danger));
        if (!snapshot.hasData) return const SizedBox(height: 24, child: LinearProgressIndicator());
        final lines = (snapshot.data!['lines'] as List<dynamic>?) ?? const [];
        final quote = snapshot.data!['quote'] == null ? null : Quote.fromJson(snapshot.data!['quote'] as Map<String, dynamic>);
        final count = lines.fold<int>(0, (sum, l) => sum + ((l as Map<String, dynamic>)['qty'] as int));
        if (count == 0) return Text(s.cartEmptyShort, style: TextStyle(color: Tokens.textMuted));
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
    if (orderId == null) return Text(s.noActiveOrder, style: TextStyle(color: Tokens.textMuted));
    return FutureBuilder<PlacedOrder>(
      future: api.order(orderId!),
      builder: (context, snapshot) {
        if (snapshot.hasError) return Text(s.genericError, style: TextStyle(color: Tokens.danger));
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
    if (menu == null) return Text(s.genericError, style: TextStyle(color: Tokens.danger));
    final items = [for (final c in menu!.categories) ...c.items].where((i) => !i.soldOut).take(3).toList();
    // Each dish shows its own category's picture, the same as on the menu.
    final pictureByDish = {for (final c in menu!.categories) for (final i in c.items) i.id: c.illustration};
    String illustrationFor(String dishId) => pictureByDish[dishId] ?? 'dish';
    return Column(children: [
      for (final item in items)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: Tokens.space1),
          child: Row(children: [
            DishThumb(illustration: illustrationFor(item.id), imageUrl: item.imageUrl, size: 48),
            const SizedBox(width: Tokens.space3),
            Expanded(child: Text(item.name.of(s.lang), maxLines: 2, overflow: TextOverflow.ellipsis)),
            Text(formatMoney(item.priceMinor, menu!.currency), style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(width: Tokens.space2),
            Tooltip(
              message: s.addDish(item.name.of(s.lang)),
              child: IconButton.filledTonal(
                onPressed: () => onAdd(item),
                style: IconButton.styleFrom(minimumSize: const Size(48, 48), backgroundColor: context.accentSoft, foregroundColor: context.accentInk),
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
          Text(s.customiseHint(dashboardMin, dashboardMax), style: TextStyle(color: Tokens.textMuted)),
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
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Tokens.border))),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label),
            if (sub != null) Text(sub!, style: TextStyle(color: Tokens.textMuted, fontSize: 12)),
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

/// Above the menu bar: the mini cart while something is in the cart, otherwise the offer strip staff published.
/// It reloads when the cart changes anywhere in the app.
class _FloatingCart extends StatefulWidget {
  const _FloatingCart({required this.api, required this.s, required this.menu, required this.strip, required this.onView, required this.onStrip});
  final ApiClient api;
  final Strings s;
  final Menu? menu;
  final Promotion? strip;
  final VoidCallback onView;
  final ValueChanged<Promotion> onStrip;

  @override
  State<_FloatingCart> createState() => _FloatingCartState();
}

class _FloatingCartState extends State<_FloatingCart> {
  int _count = 0;
  int? _total;
  String _currency = '';
  List<String> _itemIds = const [];

  @override
  void initState() {
    super.initState();
    widget.api.cartChanges.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    widget.api.cartChanges.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final body = await widget.api.cart();
      final lines = ((body['lines'] as List<dynamic>?) ?? const []).cast<Map<String, dynamic>>();
      final quote = body['quote'] == null ? null : Quote.fromJson(body['quote'] as Map<String, dynamic>);
      if (mounted) {
        setState(() {
          _count = lines.fold<int>(0, (sum, l) => sum + (l['qty'] as int));
          _total = quote?.totalMinor;
          _currency = quote?.currency ?? '';
          _itemIds = [for (final l in lines) l['itemId'] as String];
        });
      }
    } catch (_) {
      // The cart bar is an extra: if the cart cannot load, it stays hidden rather than showing a wrong total.
      if (mounted) setState(() => _count = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_count == 0) {
      final strip = widget.strip;
      return strip == null ? const SizedBox.shrink() : OfferStrip(promo: strip, s: widget.s, onOpen: () => widget.onStrip(strip));
    }
    final images = <String?>[
      for (final id in _itemIds)
        widget.menu?.categories.expand((c) => c.items).where((i) => i.id == id).firstOrNull?.imageUrl,
    ];
    return MiniCartBar(count: _count, totalMinor: _total, currency: _currency, images: images, s: widget.s, onOpen: widget.onView);
  }
}


/// The hero's search: a white field on the photo. Results show under the categories as the customer types.
class _HeroSearch extends StatelessWidget {
  const _HeroSearch({required this.hint, required this.onChanged});
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: const TextStyle(color: Color(0xFF1C1917)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF57534E)),
        prefixIcon: const Icon(LucideIcons.search, color: Color(0xFF57534E)),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.95),
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: context.accent, width: 2)),
      ),
    );
  }
}

/// The More icon on the hero: vouchers, About, sign out, and the language when there is no room for its own icon.
class _MoreMenu extends StatelessWidget {
  const _MoreMenu({required this.s, required this.signedIn, required this.showLanguage, required this.onChoice});
  final Strings s;
  final bool signedIn;
  final bool showLanguage;
  final ValueChanged<String> onChoice;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: s.more,
      onSelected: onChoice,
      padding: EdgeInsets.zero,
      itemBuilder: (_) => [
        if (showLanguage) PopupMenuItem(value: 'language', child: ListTile(leading: const Icon(LucideIcons.globe), title: Text(s.language))),
        if (signedIn) PopupMenuItem(value: 'vouchers', child: ListTile(leading: const Icon(LucideIcons.ticket), title: Text(s.myVouchers))),
        PopupMenuItem(value: 'about', child: ListTile(leading: const Icon(LucideIcons.info), title: Text(s.about))),
        if (signedIn) PopupMenuItem(value: 'signout', child: ListTile(leading: const Icon(LucideIcons.logOut), title: Text(s.signOut))),
      ],
      child: IgnorePointer(child: TopIcon(icon: LucideIcons.ellipsisVertical, label: s.more, onPhoto: true, onTap: () {})),
    );
  }
}
