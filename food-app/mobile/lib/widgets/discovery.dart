import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/money.dart';
import '../core/models.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'dish_thumb.dart';
import '../core/brand.dart';
import 'app_button.dart';

// Reusable discovery components for the home screen. Each one takes its content as data, so categories, banners,
// filters and sections come from the menu and the server, never from code.

/// Fades and rises a section into place on first build. Skipped when the device asks for reduced motion.
class RevealOnLoad extends StatelessWidget {
  const RevealOnLoad({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (context, t, child) => Opacity(opacity: t, child: Transform.translate(offset: Offset(0, (1 - t) * 16), child: child)),
    );
  }
}

/// The top bar: the restaurant name, a search field that filters the dishes, and the actions passed in.
class DiscoveryHeader extends StatelessWidget {
  const DiscoveryHeader({super.key, required this.title, required this.searchHint, required this.onSearch, required this.actions, this.logoUrl});
  final String title;
  /// The restaurant's logo from its settings; the name stands alone when there is none.
  final String? logoUrl;
  final String searchHint;
  final ValueChanged<String> onSearch;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        if (logoUrl != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(Tokens.radiusMd),
            child: Image.network(logoUrl!, width: 36, height: 36, fit: BoxFit.contain, cacheWidth: 108, semanticLabel: '',
                errorBuilder: (_, _, _) => const SizedBox(width: 36, height: 36)),
          ),
          const SizedBox(width: Tokens.space2),
        ],
        Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleLarge)),
        ...actions,
      ]),
      const SizedBox(height: Tokens.space3),
      TextField(
        onChanged: onSearch,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: searchHint,
          prefixIcon: const Icon(LucideIcons.search),
          filled: true,
          fillColor: Tokens.surface,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(vertical: Tokens.space3),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(Tokens.radiusLg), borderSide: BorderSide.none),
        ),
      ),
    ]);
  }
}

class PromoBanner {
  const PromoBanner({required this.title, required this.body, required this.action, required this.onAction, required this.background, this.picture, this.dark = true});
  final String title;
  final String body;
  final String action;
  final VoidCallback onAction;
  final Widget background;
  final Widget? picture;
  /// A photo or video banner is dark and takes white text. A light banner keeps the text colour of the design.
  final bool dark;
}

/// A carousel of promotional banners. It moves on by itself, stops when the customer swipes, and waits when reduced
/// motion is on.
class PromoCarousel extends StatefulWidget {
  const PromoCarousel({super.key, required this.banners, this.interval = const Duration(seconds: 6)});
  final List<PromoBanner> banners;
  final Duration interval;

  @override
  State<PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends State<PromoCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _timer?.cancel();
      _timer = null;
    } else {
      _timer ??= Timer.periodic(widget.interval, (_) => _advance());
    }
  }

  void _advance() {
    if (!_controller.hasClients || widget.banners.length < 2) return;
    _controller.animateToPage((_page + 1) % widget.banners.length, duration: const Duration(milliseconds: 600), curve: Curves.easeOutCubic);
  }

  void _restartTimer() {
    _timer?.cancel();
    _timer = null;
    if (mounted && !MediaQuery.of(context).disableAnimations) _timer = Timer.periodic(widget.interval, (_) => _advance());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox.shrink();
    return Column(children: [
      SizedBox(
        height: 200,
        child: NotificationListener<ScrollStartNotification>(
          onNotification: (_) {
            _restartTimer();
            return false;
          },
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              final position = _controller.hasClients && _controller.position.hasPixels ? (_controller.page ?? _page.toDouble()) : _page.toDouble();
              return PageView.builder(
                controller: _controller,
                itemCount: widget.banners.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (context, i) {
                  // The banner moves a little slower than the page, so the carousel feels layered.
                  final distance = (position - i).clamp(-1.0, 1.0);
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Tokens.space1),
                    child: Transform.translate(offset: Offset(distance * -24, 0), child: _BannerCard(banner: widget.banners[i])),
                  );
                },
              );
            },
          ),
        ),
      ),
      const SizedBox(height: Tokens.space2),
      ExcludeSemantics(
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 0; i < widget.banners.length; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == _page ? 20 : 8,
              height: 8,
              decoration: BoxDecoration(color: i == _page ? context.accent : Tokens.border, borderRadius: BorderRadius.circular(4)),
            ),
        ]),
      ),
    ]);
  }
}

class _BannerCard extends StatelessWidget {
  const _BannerCard({required this.banner});
  final PromoBanner banner;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(Tokens.radiusLg),
      child: Stack(fit: StackFit.expand, children: [
        banner.background,
        if (banner.dark)
          const DecoratedBox(
            decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0xF21C1917), Color(0xB31C1917), Color(0x001C1917)], stops: [0, 0.55, 1])),
          ),
        if (banner.picture != null) Positioned(right: Tokens.space2, top: Tokens.space2, bottom: Tokens.space2, width: 140, child: banner.picture!),
        Padding(
          padding: const EdgeInsets.all(Tokens.space4),
          child: Column(mainAxisAlignment: MainAxisAlignment.end, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(banner.title, style: TextStyle(color: banner.dark ? Colors.white : Tokens.text, fontFamily: Tokens.headingFont, fontSize: 26, fontWeight: FontWeight.w600)),
            const SizedBox(height: Tokens.space1),
            SizedBox(width: banner.picture == null ? double.infinity : 200, child: Text(banner.body, style: TextStyle(color: banner.dark ? const Color(0xFFF5F5F4) : Tokens.textMuted, fontSize: 15))),
            const SizedBox(height: Tokens.space3),
            AppButton(label: banner.action, size: ButtonSize.sm, variant: banner.dark ? ButtonVariant.primary : ButtonVariant.secondary, onPressed: banner.onAction),
          ]),
        ),
      ]),
    );
  }
}

class CategoryTab {
  const CategoryTab({required this.id, required this.label, required this.image});
  final String id;
  final String label;
  final String image;
}

/// Horizontal category tabs. The first tab, with a null id, means all categories. The selected tab is underlined.
class CategoryTabs extends StatelessWidget {
  const CategoryTabs({super.key, required this.tabs, required this.selectedId, required this.onSelect});
  final List<CategoryTab> tabs;
  final String? selectedId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: tabs.length,
        separatorBuilder: (_, _) => const SizedBox(width: Tokens.space3),
        itemBuilder: (context, i) {
          final tab = tabs[i];
          final selected = tab.id == selectedId;
          return Semantics(
            button: true,
            selected: selected,
            label: tab.label,
            child: InkWell(
              borderRadius: BorderRadius.circular(Tokens.radiusMd),
              onTap: () => onSelect(tab.id),
              child: SizedBox(
                width: 76,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? context.accent : Colors.transparent, width: 2)),
                    child: ClipOval(child: SizedBox(width: 60, height: 60, child: tab.image.isEmpty ? ColoredBox(color: context.accentSoft) : Image.asset(tab.image, fit: BoxFit.cover, cacheWidth: 180, semanticLabel: ''))),
                  ),
                  const SizedBox(height: Tokens.space2),
                  ExcludeSemantics(
                    child: Text(tab.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? context.accent : Tokens.text)),
                  ),
                  const SizedBox(height: 2),
                  ExcludeSemantics(child: Container(height: 2, width: 28, color: selected ? context.accent : Colors.transparent)),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

class FilterOption {
  const FilterOption({required this.id, required this.label, required this.keep});
  final String id;
  final String label;
  /// Whether a dish stays in the results when this filter is on.
  final bool Function(MenuItem item) keep;
}

/// Horizontal filter chips. Several can be on at once; a dish must pass every chosen filter.
class FilterChips extends StatelessWidget {
  const FilterChips({super.key, required this.options, required this.selected, required this.onToggle});
  final List<FilterOption> options;
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: options.length,
        separatorBuilder: (_, _) => const SizedBox(width: Tokens.space2),
        itemBuilder: (context, i) {
          final option = options[i];
          return FilterChip(
            label: Text(option.label),
            selected: selected.contains(option.id),
            onSelected: (_) => onToggle(option.id),
            selectedColor: context.accentSoft,
            checkmarkColor: context.accent,
            side: BorderSide(color: selected.contains(option.id) ? context.accent : Tokens.border),
            materialTapTargetSize: MaterialTapTargetSize.padded,
          );
        },
      ),
    );
  }
}

/// One dish in a carousel: its picture, name, price and a one-tap add.
class DishPick {
  const DishPick({required this.item, required this.illustration});
  final MenuItem item;
  final String illustration;
}

/// A titled horizontal row of dish cards.
class DishCarousel extends StatelessWidget {
  const DishCarousel({super.key, required this.title, required this.caption, required this.items, required this.currency, required this.s, required this.onAdd});
  final String title;
  final String? caption;
  final List<DishPick> items;
  final String currency;
  final Strings s;
  final ValueChanged<MenuItem> onAdd;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: Theme.of(context).textTheme.titleMedium),
      if (caption != null) ...[
        const SizedBox(height: 2),
        Text(caption!, style: const TextStyle(color: Tokens.textMuted, fontSize: 13)),
      ],
      const SizedBox(height: Tokens.space3),
      SizedBox(
        height: 240,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: Tokens.space3),
          itemBuilder: (context, i) => DishTile(pick: items[i], currency: currency, s: s, onAdd: () => onAdd(items[i].item)),
        ),
      ),
    ]);
  }
}

class DishTile extends StatefulWidget {
  const DishTile({super.key, required this.pick, required this.currency, required this.s, required this.onAdd});
  final DishPick pick;
  final String currency;
  final Strings s;
  final VoidCallback onAdd;

  @override
  State<DishTile> createState() => _DishTileState();
}

class _DishTileState extends State<DishTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final name = widget.pick.item.name.of(widget.s.lang);
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerUp: (_) => setState(() => _pressed = false),
      onPointerCancel: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1,
        duration: const Duration(milliseconds: 120),
        child: SizedBox(
          width: 170,
          child: Container(
            decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
            padding: const EdgeInsets.all(Tokens.space2),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(Tokens.radiusMd),
                child: DishImage(illustration: widget.pick.illustration, imageUrl: widget.pick.item.imageUrl, height: 100, width: double.infinity, cacheWidth: 340),
              ),
              const SizedBox(height: Tokens.space2),
              Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(formatMoney(widget.pick.item.priceMinor, widget.currency), style: const TextStyle(color: Tokens.textMuted)),
              const Spacer(),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Semantics(
                  button: true,
                  label: widget.s.addDish(name),
                  onTap: widget.onAdd,
                  child: ExcludeSemantics(
                    child: IconButton.filled(
                      onPressed: widget.onAdd,
                      style: IconButton.styleFrom(minimumSize: const Size(48, 48), backgroundColor: context.accent, foregroundColor: context.onAccent),
                      icon: const Icon(LucideIcons.plus),
                      tooltip: widget.s.addDish(name),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// One category as a card in the feed: its name, how many dishes it has, and its picture.
class FeedCategoryCard extends StatelessWidget {
  const FeedCategoryCard({super.key, required this.title, required this.count, required this.image, required this.s, required this.onTap});
  final String title;
  final int count;
  final String image;
  final Strings s;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Tokens.surface,
      borderRadius: BorderRadius.circular(Tokens.radiusLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(Tokens.space3),
          child: Row(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(Tokens.radiusMd),
              child: ExcludeSemantics(child: Image.asset(image, width: 88, height: 88, fit: BoxFit.cover, cacheWidth: 240, semanticLabel: '')),
            ),
            const SizedBox(width: Tokens.space4),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(s.dishesInCategory(count), style: const TextStyle(color: Tokens.textMuted)),
                const SizedBox(height: Tokens.space2),
                Text(s.seeCategory, style: TextStyle(color: context.accent, fontWeight: FontWeight.w600)),
              ]),
            ),
            const Icon(LucideIcons.chevronRight, color: Tokens.textMuted),
          ]),
        ),
      ),
    );
  }
}

/// The cart, floating above the content and the dock. Shown only when it has items.
class FloatingCartBar extends StatelessWidget {
  const FloatingCartBar({super.key, required this.count, required this.total, required this.s, required this.onView});
  final int count;
  final String? total;
  final Strings s;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.accent,
      elevation: 0,
      borderRadius: BorderRadius.circular(Tokens.radiusLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
        onTap: onView,
        child: SizedBox(
          height: Tokens.cartBarHeight,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
            child: Row(children: [
              Icon(LucideIcons.shoppingBag, color: context.onAccent),
              const SizedBox(width: Tokens.space3),
              Expanded(
                child: Text(
                  total == null ? s.itemCount(count) : '${s.itemCount(count)} · $total',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.onAccent, fontWeight: FontWeight.w600),
                ),
              ),
              Text(s.viewCart, style: TextStyle(color: context.onAccent, fontWeight: FontWeight.w700)),
              const SizedBox(width: Tokens.space1),
              Icon(LucideIcons.chevronRight, color: context.onAccent, size: 20),
            ]),
          ),
        ),
      ),
    );
  }
}

class DockItem {
  const DockItem({required this.icon, required this.label});
  final IconData icon;
  final String label;
}

/// The floating pill dock at the bottom. The selected item shows its label on a filled pill.
class FloatingDock extends StatelessWidget {
  const FloatingDock({super.key, required this.items, required this.index, required this.onSelect});
  final List<DockItem> items;
  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: Tokens.dockHeight,
      padding: const EdgeInsets.symmetric(horizontal: Tokens.space1),
      decoration: BoxDecoration(
        color: Tokens.bg,
        borderRadius: BorderRadius.circular(Tokens.dockHeight),
        border: Border.all(color: Tokens.border),
      ),
      child: Row(children: [
        for (var i = 0; i < items.length; i++)
          Expanded(
            flex: i == index ? 2 : 1,
            child: _DockButton(item: items[i], selected: i == index, onTap: () => onSelect(i)),
          ),
      ]),
    );
  }
}

class _DockButton extends StatelessWidget {
  const _DockButton({required this.item, required this.selected, required this.onTap});
  final DockItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: ExcludeSemantics(
        child: InkWell(
          borderRadius: BorderRadius.circular(Tokens.dockHeight),
          onTap: onTap,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              padding: EdgeInsets.symmetric(horizontal: selected ? Tokens.space3 : Tokens.space2, vertical: Tokens.space2),
              decoration: BoxDecoration(color: selected ? context.accentSoft : Colors.transparent, borderRadius: BorderRadius.circular(Tokens.dockHeight)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(item.icon, color: selected ? context.accent : Tokens.textMuted, size: 22),
                if (selected) ...[
                  const SizedBox(width: Tokens.space2),
                  Flexible(child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: context.accent, fontWeight: FontWeight.w700, fontSize: 13))),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
