import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/brand.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../core/version.dart';
import 'dish_thumb.dart';
import 'home_hero.dart';
import 'promo_motion.dart';

// The sections of the home screen below the hero. Each one shows only real data: published promotions, the
// customer's own vouchers, membership and order history. A section with nothing to show is left out.

class HomeSectionTitle extends StatelessWidget {
  const HomeSectionTitle({super.key, required this.title, this.eyebrow, this.action, this.onAction});
  final String title;
  final String? eyebrow;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Tokens.space3),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (eyebrow != null) Text(eyebrow!.toUpperCase(), style: TextStyle(color: Tokens.textMuted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3)),
            Semantics(header: true, child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
          ]),
        ),
        if (action != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(foregroundColor: context.accentFg, minimumSize: const Size(48, 48)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [Text(action!), const Icon(LucideIcons.chevronRight, size: 16)]),
          ),
      ]),
    );
  }
}

/// The colour behind a promotion's white words: the colour staff chose, or the brand colour, deepening across.
List<Color> promoGradient(BuildContext context, Promotion p) {
  final base = p.look.colour ?? context.accent;
  return [base, Color.lerp(base, Colors.black, 0.42)!];
}

/// Offers that slide on their own, each for the time staff set. How the cards move as they change (slide, zoom,
/// fade) follows the first slide's chosen arrival.
class OffersCarousel extends StatefulWidget {
  const OffersCarousel({super.key, required this.promos, required this.s, required this.onOpen});
  final List<Promotion> promos;
  final Strings s;
  final ValueChanged<Promotion> onOpen;

  @override
  State<OffersCarousel> createState() => _OffersCarouselState();
}

class _OffersCarouselState extends State<OffersCarousel> {
  final _controller = PageController(viewportFraction: 0.88);
  int _index = 0;
  Timer? _timer;
  DateTime _touched = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  void _schedule() {
    _timer?.cancel();
    if (widget.promos.length < 2) return;
    _timer = Timer(Duration(seconds: widget.promos[_index].look.durationSeconds), () {
      if (!mounted || !_controller.hasClients) return;
      if (DateTime.now().difference(_touched) > const Duration(seconds: 8) && !reducedMotion(context)) {
        _controller.animateToPage((_index + 1) % widget.promos.length, duration: const Duration(milliseconds: 550), curve: Curves.easeOutCubic);
      }
      _schedule();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final animation = widget.promos.first.look.animation;
    return Column(children: [
      SizedBox(
        height: scaledHeight(context, 160, 64),
        child: Listener(
          onPointerDown: (_) => _touched = DateTime.now(),
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.promos.length,
            padEnds: false,
            onPageChanged: (i) {
              setState(() => _index = i);
              _schedule();
            },
            itemBuilder: (context, i) => AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                // How far this card is from the middle: 0 in place, 1 one card away.
                final page = _controller.hasClients && _controller.position.haveDimensions ? _controller.page ?? 0 : 0.0;
                final d = (page - i).abs().clamp(0.0, 1.0);
                return switch (animation) {
                  'zoom' => Transform.scale(scale: 1 - d * 0.1, child: child),
                  'fade' => Opacity(opacity: 1 - d * 0.55, child: child),
                  'slide_up' => Transform.translate(offset: Offset(0, d * 18), child: child),
                  'slide_down' => Transform.translate(offset: Offset(0, -d * 18), child: child),
                  _ => child!,
                };
              },
              child: Padding(
                padding: const EdgeInsetsDirectional.only(start: Tokens.space4),
                child: _OfferCard(promo: widget.promos[i], s: widget.s, onTap: () => widget.onOpen(widget.promos[i])),
              ),
            ),
          ),
        ),
      ),
      if (widget.promos.length > 1) ...[
        const SizedBox(height: Tokens.space2),
        ExcludeSemantics(
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < widget.promos.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _index ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(color: i == _index ? context.accentFg : Tokens.border, borderRadius: BorderRadius.circular(3)),
              ),
          ]),
        ),
      ],
    ]);
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.promo, required this.s, required this.onTap});
  final Promotion promo;
  final Strings s;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lang = s.lang;
    final title = promo.title.of(lang).isNotEmpty ? promo.title.of(lang) : promo.offer?.headline.of(lang) ?? '';
    final kicker = promo.kicker.of(lang).isNotEmpty ? promo.kicker.of(lang) : (promo.offer != null && promo.title.of(lang).isNotEmpty ? promo.offer!.headline.of(lang) : '');
    final radius = BorderRadius.circular(promo.look.frame == 'square' ? 4 : 20);
    final fullPicture = promo.hasMedia && promo.look.frame != 'circle';
    return Semantics(
      button: true,
      label: [kicker, title, promo.body.of(lang)].where((t) => t.isNotEmpty).join('. '),
      excludeSemantics: true,
      child: Material(
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(gradient: LinearGradient(begin: AlignmentDirectional.centerStart, end: AlignmentDirectional.centerEnd, colors: promoGradient(context, promo))),
            child: Stack(fit: StackFit.expand, children: [
              if (fullPicture) ...[
                HeroSlide.mediaFor(promo, context.accent),
                DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: AlignmentDirectional.centerStart, end: AlignmentDirectional.centerEnd, colors: [promoGradient(context, promo).last.withValues(alpha: 0.92), Colors.transparent]))),
              ],
              if (promo.hasMedia && !fullPicture)
                PositionedDirectional(
                  end: -14,
                  top: 0,
                  bottom: 0,
                  child: Center(child: ClipOval(child: SizedBox(width: 132, height: 132, child: HeroSlide.mediaFor(promo, context.accent)))),
                ),
              Padding(
                padding: EdgeInsetsDirectional.fromSTEB(Tokens.space4, Tokens.space4, promo.hasMedia ? 128 : Tokens.space4, Tokens.space4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  if (kicker.isNotEmpty) Text(kicker.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2)),
                  Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 21, height: 1.1, fontWeight: FontWeight.w800)),
                  if (promo.body.of(lang).isNotEmpty) Text(promo.body.of(lang), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 12.5)),
                  if (promo.offer?.code != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1.5)),
                      child: Text(promo.offer!.code!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
                    ),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// The customer's saved vouchers and membership, side by side.
class RedeemRow extends StatelessWidget {
  const RedeemRow({super.key, required this.vouchers, required this.memberPlan, required this.s, required this.onVouchers, required this.onMembership});
  final int vouchers;
  /// The name of the customer's plan, or null when they are not a member.
  final String? memberPlan;
  final Strings s;
  final VoidCallback onVouchers;
  final VoidCallback onMembership;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: _RedeemTile(icon: LucideIcons.ticket, colours: const [Color(0xFF8B5CF6), Color(0xFF6D28D9)], title: s.vouchersLine(vouchers), subtitle: s.myVouchers, onTap: onVouchers)),
      const SizedBox(width: Tokens.space3),
      Expanded(child: _RedeemTile(icon: LucideIcons.crown, colours: const [Color(0xFFD97706), Color(0xFF92400E)], title: memberPlan ?? s.membership, subtitle: memberPlan == null ? s.notAMember : s.membershipBenefits, onTap: onMembership)),
    ]);
  }
}

class _RedeemTile extends StatelessWidget {
  const _RedeemTile({required this.icon, required this.colours, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final List<Color> colours;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Tokens.bg,
      borderRadius: BorderRadius.circular(Tokens.radiusLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.all(Tokens.space3),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(Tokens.radiusLg), border: Border.all(color: Tokens.border)),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: colours)),
              child: Icon(icon, color: Colors.white, size: 20),
            ),
            const SizedBox(width: Tokens.space2),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Tokens.textMuted, fontSize: 12)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// A large mid-feed promotion: the picture or video beside the words, in the size and frame staff chose.
class SpotlightCard extends StatelessWidget {
  const SpotlightCard({super.key, required this.promo, required this.s, required this.onOpen});
  final Promotion promo;
  final Strings s;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final lang = s.lang;
    final height = switch (promo.look.size) { 'compact' => 180.0, 'tall' => 320.0, 'full' => 380.0, _ => 240.0 };
    final radius = BorderRadius.circular(promo.look.frame == 'square' ? 4 : 22);
    final colours = promo.look.colour == null ? [const Color(0xFF1C1917), Color.lerp(const Color(0xFF1C1917), context.accent, 0.55)!] : promoGradient(context, promo);
    return Semantics(
      container: true,
      label: promo.title.of(lang),
      child: ClipRRect(
        borderRadius: radius,
        child: Container(
          constraints: BoxConstraints(minHeight: scaledHeight(context, height, 60)),
          decoration: BoxDecoration(gradient: LinearGradient(colors: colours)),
          child: Stack(children: [
            if (promo.hasMedia)
              PositionedDirectional(
                top: 0,
                bottom: 0,
                end: 0,
                width: MediaQuery.sizeOf(context).width * 0.55,
                child: ShaderMask(
                  shaderCallback: (r) => const LinearGradient(begin: AlignmentDirectional.centerStart, end: AlignmentDirectional.centerEnd, colors: [Colors.transparent, Colors.black], stops: [0, 0.4]).createShader(r),
                  blendMode: BlendMode.dstIn,
                  child: ExcludeSemantics(child: HeroSlide.mediaFor(promo, context.accent)),
                ),
              ),
            Padding(
              padding: EdgeInsetsDirectional.fromSTEB(Tokens.space4, Tokens.space4, promo.hasMedia ? MediaQuery.sizeOf(context).width * 0.4 : Tokens.space4, Tokens.space4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                if (promo.kicker.of(lang).isNotEmpty) Text(promo.kicker.of(lang).toUpperCase(), style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2)),
                const SizedBox(height: 4),
                Text(promo.title.of(lang), maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontFamily: Tokens.headingFont, fontSize: 22, height: 1.1, fontWeight: FontWeight.w700)),
                if (promo.body.of(lang).isNotEmpty) ...[
                  const SizedBox(height: Tokens.space2),
                  Text(promo.body.of(lang), maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 13)),
                ],
                const SizedBox(height: Tokens.space3),
                Material(
                  color: context.buttonBg,
                  shape: StadiumBorder(side: BorderSide(color: context.buttonLine)),
                  child: InkWell(
                    customBorder: const StadiumBorder(),
                    onTap: onOpen,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 44, minWidth: 48),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: Tokens.space4, vertical: Tokens.space2),
                        child: Text(promo.cta.of(lang).isEmpty ? s.orderNow : promo.cta.of(lang), style: TextStyle(color: context.buttonFg, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Dishes the customer ordered before, as photo tiles; a tap adds one more.
class OrderAgainRow extends StatelessWidget {
  const OrderAgainRow({super.key, required this.dishes, required this.s, required this.onAdd});
  final List<DishCard> dishes;
  final Strings s;
  final ValueChanged<DishCard> onAdd;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: scaledHeight(context, 132, 34),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: dishes.length,
        separatorBuilder: (_, _) => const SizedBox(width: Tokens.space3),
        itemBuilder: (context, i) {
          final d = dishes[i];
          return Semantics(
            button: true,
            label: s.addDish(d.name.of(s.lang)),
            excludeSemantics: true,
            child: InkWell(
              borderRadius: BorderRadius.circular(Tokens.radiusLg),
              onTap: d.soldOut ? null : () => onAdd(d),
              child: SizedBox(
                width: 92,
                child: Column(children: [
                  Stack(clipBehavior: Clip.none, alignment: Alignment.bottomCenter, children: [
                    ClipRRect(borderRadius: BorderRadius.circular(22), child: DishImage(illustration: 'dish', imageUrl: d.imageUrl, width: 84, height: 84, cacheWidth: 168)),
                    if (d.timesOrdered > 1)
                      Positioned(
                        bottom: -6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFFD9F99D), borderRadius: BorderRadius.circular(6)),
                          child: Text('×${d.timesOrdered}', style: const TextStyle(color: Color(0xFF1A2E05), fontWeight: FontWeight.w800, fontSize: 11)),
                        ),
                      ),
                  ]),
                  const SizedBox(height: Tokens.space2),
                  Text(d.name.of(s.lang), maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Shortcuts to other parts of the app, each with its own colour.
class ExploreRow extends StatelessWidget {
  const ExploreRow({super.key, required this.items});
  final List<({IconData icon, String label, List<Color> colours, VoidCallback onTap})> items;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      for (var i = 0; i < items.length; i++) ...[
        if (i > 0) const SizedBox(width: Tokens.space2),
        Expanded(
          child: Material(
            color: Tokens.bg,
            borderRadius: BorderRadius.circular(Tokens.radiusLg),
            child: InkWell(
              borderRadius: BorderRadius.circular(Tokens.radiusLg),
              onTap: items[i].onTap,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: Tokens.space3, horizontal: 4),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(Tokens.radiusLg), border: Border.all(color: Tokens.border)),
                child: Column(children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: items[i].colours)),
                    child: Icon(items[i].icon, color: Colors.white, size: 20),
                  ),
                  const SizedBox(height: Tokens.space2),
                  Text(items[i].label, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                ]),
              ),
            ),
          ),
        ),
      ],
    ]);
  }
}

/// The foot of the home screen: the restaurant's copyright, the app version and a link to About.
class HomeFooter extends StatelessWidget {
  const HomeFooter({super.key, required this.name, required this.s, required this.onAbout});
  final String name;
  final Strings s;
  final VoidCallback onAbout;

  @override
  Widget build(BuildContext context) {
    final muted = TextStyle(color: Tokens.textMuted, fontSize: 12);
    return Column(children: [
      Text(name, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 4),
      Text(s.copyright(DateTime.now().year, name), textAlign: TextAlign.center, style: muted),
      Text(s.appVersionLine(appVersion, appBuild), style: muted),
      TextButton(onPressed: onAbout, style: TextButton.styleFrom(foregroundColor: context.accentFg), child: Text(s.about)),
    ]);
  }
}

/// The slim offer line above the menu bar. It arrives the way staff chose and opens the offer's details.
class OfferStrip extends StatelessWidget {
  const OfferStrip({super.key, required this.promo, required this.s, required this.onOpen});
  final Promotion promo;
  final Strings s;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final lang = s.lang;
    final badge = promo.offer?.headline.of(lang) ?? promo.kicker.of(lang);
    final text = [promo.title.of(lang), if (promo.offer != null && promo.offer!.daysLeft <= 7) s.daysLeft(promo.offer!.daysLeft)].where((t) => t.isNotEmpty).join(' · ');
    return PromoEntrance(
      animation: promo.look.animation,
      child: Semantics(
        button: true,
        label: [badge, text].where((t) => t.isNotEmpty).join('. '),
        excludeSemantics: true,
        child: Material(
          borderRadius: BorderRadius.circular(14),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onOpen,
            child: Ink(
              decoration: BoxDecoration(gradient: LinearGradient(colors: promoGradient(context, promo))),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Tokens.space2, vertical: Tokens.space2),
                  child: Row(children: [
                    if (badge.isNotEmpty)
                      Transform.rotate(
                        angle: -0.05,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
                          child: Text(badge, style: const TextStyle(color: Color(0xFF1C1917), fontWeight: FontWeight.w900, fontSize: 13)),
                        ),
                      ),
                    const SizedBox(width: Tokens.space2),
                    Expanded(child: Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13))),
                    const Icon(LucideIcons.chevronUp, color: Colors.white),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The mini cart above the menu bar: photos of what is in it, the count and total, and a button that slides the cart up.
class MiniCartBar extends StatelessWidget {
  const MiniCartBar({super.key, required this.count, required this.totalMinor, required this.currency, required this.images, required this.s, required this.onOpen});
  final int count;
  final int? totalMinor;
  final String currency;
  final List<String?> images;
  final Strings s;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final summary = totalMinor == null ? s.itemCount(count) : '${s.itemCount(count)} · ${formatMoney(totalMinor!, currency)}';
    return PromoEntrance(
      animation: 'slide_up',
      child: Semantics(
        button: true,
        label: '$summary. ${s.viewCart}',
        excludeSemantics: true,
        child: Material(
          color: Tokens.palette.isGlass ? Tokens.palette.sheet : Tokens.bg,
          elevation: 6,
          shadowColor: const Color(0x55000000),
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: onOpen,
            child: Padding(
              padding: const EdgeInsets.all(Tokens.space2),
              child: Row(children: [
                SizedBox(
                  width: 34.0 + (images.take(3).length - 1).clamp(0, 2) * 22,
                  height: 34,
                  child: Stack(children: [
                    for (var i = 0; i < images.take(3).length; i++)
                      PositionedDirectional(
                        start: i * 22.0,
                        child: Container(
                          decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: Tokens.bg, width: 2)),
                          child: ClipRRect(borderRadius: BorderRadius.circular(8), child: DishImage(illustration: 'dish', imageUrl: images[i], width: 30, height: 30, cacheWidth: 60)),
                        ),
                      ),
                  ]),
                ),
                const SizedBox(width: Tokens.space2),
                Expanded(child: Text(summary, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
                Container(
                  constraints: const BoxConstraints(minHeight: 44),
                  padding: const EdgeInsets.symmetric(horizontal: Tokens.space3),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: context.accent, borderRadius: BorderRadius.circular(12)),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(s.viewCart, style: TextStyle(color: context.onAccent, fontWeight: FontWeight.w700)),
                    Text(s.payFromHere, style: TextStyle(color: context.onAccent, fontSize: 11)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
