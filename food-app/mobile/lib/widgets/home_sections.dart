import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/art.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'app_button.dart';
import 'hero_video.dart';

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
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, (1 - t) * 16), child: child),
      ),
    );
  }
}

/// Two slides that move on by themselves: order now, and ask the restaurant. Each slide is a real action.
/// Swiping by hand stops the automatic move until the next pause.
class HomeHeroCarousel extends StatefulWidget {
  const HomeHeroCarousel({super.key, required this.s, required this.onOrder, required this.onAsk});
  final Strings s;
  final VoidCallback onOrder;
  final VoidCallback onAsk;

  @override
  State<HomeHeroCarousel> createState() => _HomeHeroCarouselState();
}

class _HomeHeroCarouselState extends State<HomeHeroCarousel> {
  static const _slideCount = 2;
  static const _interval = Duration(seconds: 6);

  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion: the slides stay still, and the customer moves them by swiping or the dots.
    if (MediaQuery.of(context).disableAnimations) {
      _timer?.cancel();
      _timer = null;
    } else {
      _timer ??= Timer.periodic(_interval, (_) => _advance());
    }
  }

  void _advance() {
    if (!_controller.hasClients) return;
    _controller.animateToPage((_page + 1) % _slideCount, duration: const Duration(milliseconds: 600), curve: Curves.easeOutCubic);
  }

  void _restartTimer() {
    _timer?.cancel();
    _timer = null;
    if (mounted && !MediaQuery.of(context).disableAnimations) _timer = Timer.periodic(_interval, (_) => _advance());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final slides = [
      _HeroSlide(
        background: const HeroVideo(video: Art.heroVideo, poster: Art.heroVideoPoster),
        title: s.heroTitle,
        body: s.heroBody,
        action: s.menu,
        onAction: widget.onOrder,
      ),
      _HeroSlide(
        background: const ColoredBox(color: Tokens.accentSoft),
        picture: Image.asset(Art.assistant, fit: BoxFit.contain, semanticLabel: ''),
        title: s.askTitle,
        body: s.askHint,
        action: s.askTitle,
        onAction: widget.onAsk,
        dark: false,
      ),
    ];
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
              final position = _controller.hasClients && _controller.position.hasPixels ? _controller.page ?? _page.toDouble() : _page.toDouble();
              return PageView.builder(
                controller: _controller,
                itemCount: _slideCount,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (context, i) {
                  // The slide moves slightly slower than the page, so it feels layered.
                  final distance = (position - i).clamp(-1.0, 1.0);
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Tokens.space1),
                    child: Transform.translate(offset: Offset(distance * -24, 0), child: slides[i]),
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
          for (var i = 0; i < _slideCount; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == _page ? 20 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: i == _page ? Tokens.accent : Tokens.border,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
        ]),
      ),
    ]);
  }
}

class _HeroSlide extends StatelessWidget {
  const _HeroSlide({required this.background, required this.title, required this.body, required this.action, required this.onAction, this.picture, this.dark = true});
  final Widget background;
  final Widget? picture;
  final String title;
  final String body;
  final String action;
  final VoidCallback onAction;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final ink = dark ? Colors.white : Tokens.text;
    return ClipRRect(
      borderRadius: BorderRadius.circular(Tokens.radiusLg),
      child: Stack(fit: StackFit.expand, children: [
        background,
        if (dark)
          const DecoratedBox(
            decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0xF21C1917), Color(0xB31C1917), Color(0x001C1917)], stops: [0, 0.55, 1])),
          ),
        if (picture != null) Positioned(right: Tokens.space2, top: Tokens.space2, bottom: Tokens.space2, width: 150, child: picture!),
        Padding(
          padding: const EdgeInsets.all(Tokens.space4),
          child: Column(mainAxisAlignment: MainAxisAlignment.end, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(color: ink, fontFamily: Tokens.headingFont, fontSize: 26, fontWeight: FontWeight.w600)),
            const SizedBox(height: Tokens.space1),
            SizedBox(width: picture == null ? double.infinity : 200, child: Text(body, style: TextStyle(color: dark ? const Color(0xFFF5F5F4) : Tokens.textMuted, fontSize: 15))),
            const SizedBox(height: Tokens.space3),
            AppButton(label: action, variant: dark ? ButtonVariant.primary : ButtonVariant.secondary, size: ButtonSize.sm, onPressed: onAction),
          ]),
        ),
      ]),
    );
  }
}

/// The category strip. Each category has its own icon; tapping one opens the menu.
class HomeCategoryStrip extends StatelessWidget {
  const HomeCategoryStrip({super.key, required this.menu, required this.s, required this.onOpen});
  final Menu menu;
  final Strings s;
  final VoidCallback onOpen;

  static IconData iconFor(String illustration) => switch (illustration) {
        'starters' => LucideIcons.salad,
        'drinks' => LucideIcons.glassWater,
        'desserts' => LucideIcons.cakeSlice,
        _ => LucideIcons.utensils,
      };

  @override
  Widget build(BuildContext context) {
    final categories = menu.categories;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(s.browseCategories, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: Tokens.space3),
      SizedBox(
        height: 110,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: categories.length,
          separatorBuilder: (_, _) => const SizedBox(width: Tokens.space3),
          itemBuilder: (context, i) {
            final c = categories[i];
            return InkWell(
              borderRadius: BorderRadius.circular(Tokens.radiusMd),
              onTap: onOpen,
              child: SizedBox(
                width: 76,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: const BoxDecoration(color: Tokens.accentSoft, shape: BoxShape.circle),
                    child: Icon(iconFor(c.illustration), color: Tokens.accent, size: 26),
                  ),
                  const SizedBox(height: Tokens.space2),
                  Text(c.name.of(s.lang), maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              ),
            );
          },
        ),
      ),
    ]);
  }
}

/// A dish the customer may want, with its picture and a one-tap add.
class _Pick {
  const _Pick(this.item, this.illustration);
  final MenuItem item;
  final String illustration;
}

/// Recommended dishes. When the customer has an order history, dishes they order most come first; otherwise the
/// menu's own order is used. The caption says which of the two is shown.
class HomeRecommendedRow extends StatelessWidget {
  const HomeRecommendedRow({super.key, required this.menu, required this.s, required this.mostOrderedIds, required this.onAdd});
  final Menu menu;
  final Strings s;
  final List<String> mostOrderedIds;
  final ValueChanged<MenuItem> onAdd;

  @override
  Widget build(BuildContext context) {
    final picks = [
      for (final c in menu.categories)
        for (final item in c.items)
          if (!item.soldOut) _Pick(item, c.illustration),
    ];
    final rank = {for (var i = 0; i < mostOrderedIds.length; i++) mostOrderedIds[i]: i};
    final personal = picks.any((p) => rank.containsKey(p.item.id));
    if (personal) picks.sort((a, b) => (rank[a.item.id] ?? 1 << 20).compareTo(rank[b.item.id] ?? 1 << 20));
    final shown = picks.take(6).toList();
    if (shown.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(s.recommendedForYou, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 2),
      Text(personal ? s.recommendedFromHistory : s.recommendedStarter, style: const TextStyle(color: Tokens.textMuted, fontSize: 13)),
      const SizedBox(height: Tokens.space3),
      SizedBox(
        height: 240,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: shown.length,
          separatorBuilder: (_, _) => const SizedBox(width: Tokens.space3),
          itemBuilder: (context, i) {
            final pick = shown[i];
            return _DishCard(pick: pick, currency: menu.currency, s: s, onAdd: () => onAdd(pick.item));
          },
        ),
      ),
    ]);
  }
}

class _DishCard extends StatefulWidget {
  const _DishCard({required this.pick, required this.currency, required this.s, required this.onAdd});
  final _Pick pick;
  final String currency;
  final Strings s;
  final VoidCallback onAdd;

  @override
  State<_DishCard> createState() => _DishCardState();
}

class _DishCardState extends State<_DishCard> {
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
          width: 160,
          child: Container(
            decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
            padding: const EdgeInsets.all(Tokens.space2),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(Tokens.radiusMd),
                child: Image.asset(Art.forCategory(widget.pick.illustration), height: 96, width: double.infinity, fit: BoxFit.cover),
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
                child: ExcludeSemantics(child: AppButton(label: widget.s.add, icon: LucideIcons.plus, size: ButtonSize.sm, onPressed: widget.onAdd)),
              ),
            ),
            ]),
          ),
        ),
      ),
    );
  }
}
