import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/brand.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/ask_button.dart';
import '../widgets/ui.dart';
import '../widgets/dish_sheet.dart';
import '../widgets/dish_thumb.dart';
import '../widgets/top_icons.dart';
import '../widgets/rating.dart';
import '../widgets/cart_sheet.dart';
import 'cart_screen.dart';

// S02: the menu. The restaurant's header, a category bar that stays at the top and jumps to a section, and the dishes
// with their photos. Tapping a dish opens it; the + adds one straight away.
class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  late Future<Menu> _menu = widget.api.menu();
  final Map<String, GlobalKey> _sectionKeys = {};
  String? _selected;

  void _openCart() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CartScreen(api: widget.api, language: widget.language)));
  }

  void _added(Strings s, String name) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(SnackBar(
      behavior: SnackBarBehavior.floating,
      content: Text(s.addedToCart(name)),
      action: SnackBarAction(label: s.viewCart, onPressed: _openCart),
    ));
  }

  void _failed(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(behavior: SnackBarBehavior.floating, content: Text(message), backgroundColor: Tokens.dangerFill));
  }

  Future<void> _quickAdd(Strings s, MenuItem item) async {
    try {
      await widget.api.addOne(item.id);
      if (mounted) _added(s, item.name.of(s.lang));
    } on ApiException catch (e) {
      if (mounted) _failed(e.message);
    } catch (_) {
      if (mounted) _failed(s.genericError);
    }
  }

  Future<void> _open(Strings s, Menu menu, MenuItem item, String illustration) async {
    final added = await showDishSheet(context, api: widget.api, item: item, illustration: illustration, currency: menu.currency, s: s);
    if (added == true && mounted) _added(s, item.name.of(s.lang));
  }

  void _jumpTo(String categoryId) {
    setState(() => _selected = categoryId);
    final target = _sectionKeys[categoryId]?.currentContext;
    if (target != null) {
      Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic, alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtStart);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        return FutureBuilder<Menu>(
          future: _menu,
          builder: (context, snapshot) {
            final brand = BrandScope.of(context);
            return Scaffold(
              backgroundColor: Tokens.surface,
              appBar: AppBar(
                backgroundColor: Tokens.bg,
                // The restaurant's name is in the header below; the bar keeps only the icons.
                actions: [
                  AskButton(api: widget.api, language: widget.language, s: s),
                  LanguageIcon(language: widget.language, s: s),
                  CartIcon(api: widget.api, s: s, onTap: () => showCartSheet(context, api: widget.api, language: widget.language, s: s)),
                  const SizedBox(width: Tokens.space2),
                ],
              ),
              body: _body(context, s, snapshot, brand),
            );
          },
        );
      },
    );
  }

  Widget _body(BuildContext context, Strings s, AsyncSnapshot<Menu> snapshot, Brand? brand) {
    if (snapshot.hasError) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(s.genericError, style: TextStyle(color: Tokens.danger)),
          const SizedBox(height: Tokens.space3),
          FilledButton(onPressed: () => setState(() => _menu = widget.api.menu()), child: Text(s.retry)),
        ]),
      );
    }
    if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
    final menu = snapshot.data!;
    final selected = _selected ?? (menu.categories.isEmpty ? null : menu.categories.first.id);
    return CustomScrollView(slivers: [
      SliverToBoxAdapter(child: _RestaurantHeader(menu: menu, brand: brand, s: s)),
      SliverPersistentHeader(
        pinned: true,
        delegate: _CategoryBar(
          categories: menu.categories,
          selected: selected,
          s: s,
          onSelect: _jumpTo,
          accent: context.accent,
          accentSoft: context.accentSoft,
        ),
      ),
      for (final category in menu.categories) ...[
        SliverToBoxAdapter(
          key: _sectionKeys.putIfAbsent(category.id, GlobalKey.new),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space5, Tokens.space4, Tokens.space2),
            child: Row(children: [
              Expanded(child: Text(category.name.of(s.lang), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
              Text(s.dishesInCategory(category.items.length), style: TextStyle(color: Tokens.textMuted)),
            ]),
          ),
        ),
        SliverList.separated(
          itemCount: category.items.length,
          separatorBuilder: (_, _) => const SizedBox(height: Tokens.space3),
          itemBuilder: (context, i) {
            final item = category.items[i];
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
              child: _DishCard(
                item: item,
                illustration: category.illustration,
                s: s,
                currency: menu.currency,
                onOpen: () => _open(s, menu, item, category.illustration),
                onAdd: () => _quickAdd(s, item),
              ),
            );
          },
        ),
      ],
      const SliverToBoxAdapter(child: SizedBox(height: Tokens.space5 * 2)),
    ]);
  }
}

/// The restaurant's own header: logo, name, tagline, and how it takes orders. Everything here comes from its settings.
class _RestaurantHeader extends StatelessWidget {
  const _RestaurantHeader({required this.menu, required this.brand, required this.s});
  final Menu menu;
  final Brand? brand;
  final Strings s;

  @override
  Widget build(BuildContext context) {
    final name = brand?.name.of(s.lang) ?? menu.restaurant.of(s.lang);
    final tagline = brand?.tagline.of(s.lang) ?? '';
    final chips = <(IconData, String)>[
      if (menu.payments.cod) (LucideIcons.bike, s.delivery),
      if (menu.payments.payOnArrival) (LucideIcons.store, s.pickup),
      if (menu.payments.cod) (LucideIcons.banknote, s.payCod),
      if (menu.payments.payOnArrival) (LucideIcons.handCoins, s.payArrival),
    ];
    return Container(
      color: Tokens.bg,
      padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space2, Tokens.space4, Tokens.space4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          _Logo(brand: brand, name: name),
          const SizedBox(width: Tokens.space3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              if (tagline.isNotEmpty) Text(tagline, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Tokens.textMuted)),
            ]),
          ),
        ]),
        if (chips.isNotEmpty) ...[
          const SizedBox(height: Tokens.space3),
          Wrap(spacing: Tokens.space2, runSpacing: Tokens.space2, children: [
            for (final (icon, label) in chips)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Tokens.fill, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(icon, size: 16, color: context.accentFg),
                  const SizedBox(width: 6),
                  Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              ),
          ]),
        ],
      ]),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.brand, required this.name});
  final Brand? brand;
  final String name;

  @override
  Widget build(BuildContext context) {
    final initial = Container(
      color: context.accent,
      alignment: Alignment.center,
      child: Text(name.isEmpty ? '' : name.characters.first, style: TextStyle(color: context.onAccent, fontSize: 26, fontWeight: FontWeight.w700)),
    );
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
        child: SizedBox(
          width: 60,
          height: 60,
          child: brand?.logoUrl == null
              ? initial
              : Image.network(brand!.logoUrl!, fit: BoxFit.contain, cacheWidth: 180, errorBuilder: (_, _, _) => initial),
        ),
      ),
    );
  }
}

/// The category chips, pinned under the app bar. The chip for the section in view is filled.
class _CategoryBar extends SliverPersistentHeaderDelegate {
  _CategoryBar({required this.categories, required this.selected, required this.s, required this.onSelect, required this.accent, required this.accentSoft});
  final List<MenuCategory> categories;
  final String? selected;
  final Strings s;
  final ValueChanged<String> onSelect;
  final Color accent;
  final Color accentSoft;

  static const _height = 64.0;

  @override
  double get minExtent => _height;
  @override
  double get maxExtent => _height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Frosted(
      child: Container(
      decoration: BoxDecoration(
        color: Tokens.bg,
        boxShadow: overlapsContent || shrinkOffset > 0 ? const [BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2))] : null,
      ),
      alignment: AlignmentDirectional.centerStart,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Tokens.space4, vertical: Tokens.space2),
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: Tokens.space2),
        itemBuilder: (context, i) {
          final c = categories[i];
          final on = c.id == selected;
          return ChoiceChip(
            label: Text(c.name.of(s.lang)),
            selected: on,
            onSelected: (_) => onSelect(c.id),
            showCheckmark: false,
            materialTapTargetSize: MaterialTapTargetSize.padded,
            selectedColor: accent,
            backgroundColor: Tokens.fill,
            side: BorderSide.none,
            shape: const StadiumBorder(),
            labelStyle: TextStyle(color: on ? Colors.white : Tokens.text, fontWeight: FontWeight.w600),
          );
        },
      ),
    ),
    );
  }

  @override
  bool shouldRebuild(_CategoryBar oldDelegate) =>
      oldDelegate.selected != selected || oldDelegate.categories != categories || oldDelegate.s.lang != s.lang || oldDelegate.accent != accent;
}

/// One dish: the text on the start side, the photo on the end side with the add button on it.
class _DishCard extends StatelessWidget {
  const _DishCard({required this.item, required this.illustration, required this.s, required this.currency, required this.onOpen, required this.onAdd});
  final MenuItem item;
  final String illustration;
  final Strings s;
  final String currency;
  final VoidCallback onOpen;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final name = item.name.of(s.lang);
    final description = item.description.of(s.lang);
    return Material(
      color: Tokens.bg,
      borderRadius: BorderRadius.circular(Tokens.radiusLg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          // Room under the photo for the ADD button that sits on its edge.
          padding: const EdgeInsets.fromLTRB(Tokens.space3, Tokens.space3, Tokens.space3, Tokens.space3 + 18),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (item.rating != null) ...[
                  RatingChip(rating: item.rating!, s: s, inline: true),
                  const SizedBox(height: Tokens.space1),
                ],
                Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: Tokens.space1),
                  Text(description, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Tokens.textMuted, fontSize: 14, height: 1.35)),
                ],
                const SizedBox(height: Tokens.space2),
                Text(formatMoney(item.priceMinor, currency), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, fontFeatures: [FontFeature.tabularFigures()])),
              ]),
            ),
            const SizedBox(width: Tokens.space3),
            SizedBox(
              width: 112,
              height: 112,
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned.fill(
                  child: ColorFiltered(
                    colorFilter: item.soldOut ? const ColorFilter.mode(Colors.grey, BlendMode.saturation) : const ColorFilter.mode(Colors.transparent, BlendMode.dst),
                    child: DishThumb(illustration: illustration, imageUrl: item.imageUrl, size: 112),
                  ),
                ),
                if (item.soldOut)
                  PositionedDirectional(
                    bottom: 6,
                    start: 6,
                    end: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      // A fixed dark backing: white words stay readable in light and dark themes alike.
                      decoration: BoxDecoration(color: const Color(0xE61C1917), borderRadius: BorderRadius.circular(999)),
                      child: Text(s.soldOut, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  )
                else
                  PositionedDirectional(
                    bottom: -20,
                    start: 0,
                    end: 0,
                    child: Center(child: AddPill(label: s.add, semanticLabel: s.addDish(name), onPressed: onAdd)),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
