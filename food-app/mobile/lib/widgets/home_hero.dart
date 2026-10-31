import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/art.dart';
import '../core/brand.dart';
import '../core/models.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'hero_video.dart';
import 'promo_motion.dart';

/// One slide of the hero: a published hero promotion, or the restaurant's built-in welcome when none is published.
class HeroSlide {
  const HeroSlide({required this.background, required this.title, this.kicker = '', this.body = '', required this.action, required this.onAction, this.seconds = 6, this.animation = 'fade'});
  final Widget background;
  final String kicker;
  final String title;
  final String body;
  final String action;
  final VoidCallback onAction;
  final int seconds;
  final String animation;

  /// A picture, GIF or video from the admin. GIFs play as they are; videos loop silently, their still showing at once.
  /// [lead] is for the clip at the top of the screen, which loads first; the others wait a moment.
  static Widget mediaFor(Promotion p, Color fallback, {bool lead = false}) => p.kind == 'video'
      ? HeroVideo(video: p.url, poster: p.posterUrl, startAfter: lead ? Duration.zero : const Duration(milliseconds: 2500))
      : Image.network(p.url, fit: BoxFit.cover, gaplessPlayback: true, semanticLabel: '', errorBuilder: (_, _, _) => ColoredBox(color: fallback));
}

/// The top of the home screen: the photo runs edge to edge under the status bar. Only the delivery address, the
/// top icons and the search sit on it (the restaurant's name and logo are on the opening screen and in Account); the slide's words and button sit at its foot.
/// Slides change on their own after each slide's time; a swipe changes them by hand and pauses the timer.
class HomeHero extends StatefulWidget {
  const HomeHero({super.key, required this.slides, required this.height, required this.deliverTo, required this.onAddress, required this.icons, required this.search, required this.s});
  final List<HeroSlide> slides;
  final double height;
  /// "Deliver to Home", or null when the customer has no saved address yet.
  final String? deliverTo;
  final VoidCallback onAddress;
  final List<Widget> icons;
  final Widget search;
  final Strings s;

  /// The hero height for the size staff chose for the first slide.
  static double heightFor(String size, Size screen) => switch (size) {
        'compact' => 340,
        'tall' => 520,
        'full' => screen.height * 0.82,
        _ => 430,
      };

  @override
  State<HomeHero> createState() => _HomeHeroState();
}

class _HomeHeroState extends State<HomeHero> {
  int _index = 0;
  Timer? _timer;
  DateTime _pausedAt = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didUpdateWidget(HomeHero old) {
    super.didUpdateWidget(old);
    if (_index >= widget.slides.length) _index = 0;
    if (old.slides.length != widget.slides.length) _schedule();
  }

  void _schedule() {
    _timer?.cancel();
    if (widget.slides.length < 2) return;
    _timer = Timer(Duration(seconds: widget.slides[_index].seconds), () {
      if (!mounted) return;
      // A swipe pauses the slides for a little while, so the customer can read.
      if (DateTime.now().difference(_pausedAt) > const Duration(seconds: 8) && !reducedMotion(context)) {
        setState(() => _index = (_index + 1) % widget.slides.length);
      }
      _schedule();
    });
  }

  void _go(int delta) {
    if (widget.slides.length < 2) return;
    _pausedAt = DateTime.now();
    setState(() => _index = (_index + delta) % widget.slides.length);
    _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final slide = widget.slides[_index];
    final top = MediaQuery.paddingOf(context).top;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return SizedBox(
      height: widget.height,
      child: Stack(fit: StackFit.expand, children: [
        GestureDetector(
          onHorizontalDragEnd: (d) {
            final v = d.primaryVelocity ?? 0;
            if (v.abs() > 200) _go((v < 0) != rtl ? 1 : -1);
          },
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 650),
            transitionBuilder: (child, animation) => promoTransition(slide.animation, animation, child),
            child: KeyedSubtree(key: ValueKey(_index), child: SizedBox.expand(child: ExcludeSemantics(child: slide.background))),
          ),
        ),
        // Shade at the top for the status bar and the bar on the photo; shade at the foot for the slide's words.
        const IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xA6000000), Color(0x14000000), Color(0x0D000000), Color(0xCC000000)],
                stops: [0, 0.32, 0.5, 1],
              ),
            ),
          ),
        ),
        PositionedDirectional(
          top: top + Tokens.space2,
          start: Tokens.space4,
          end: Tokens.space2,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: widget.deliverTo == null
                      ? const SizedBox.shrink()
                      : Semantics(
                          button: true,
                          label: widget.deliverTo,
                          excludeSemantics: true,
                          child: InkWell(
                            onTap: widget.onAddress,
                            borderRadius: BorderRadius.circular(Tokens.radiusMd),
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(minHeight: 48),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                Flexible(child: Text(widget.deliverTo!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15))),
                                const Icon(LucideIcons.chevronDown, color: Colors.white, size: 20),
                              ]),
                            ),
                          ),
                        ),
                ),
              ),
              ...widget.icons,
            ]),
            const SizedBox(height: Tokens.space2),
            Padding(padding: const EdgeInsetsDirectional.only(end: Tokens.space2), child: widget.search),
          ]),
        ),
        PositionedDirectional(
          start: Tokens.space4,
          end: Tokens.space4,
          bottom: Tokens.space5 + 22,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 450),
            child: Column(
              key: ValueKey(_index),
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (slide.kicker.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(6)),
                    child: Text(slide.kicker.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2)),
                  ),
                  const SizedBox(height: Tokens.space2),
                ],
                Semantics(
                  header: true,
                  child: Text(slide.title, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontFamily: Tokens.headingFont, fontSize: 32, height: 1.05, fontWeight: FontWeight.w700, shadows: [Shadow(color: Color(0x66000000), blurRadius: 16)])),
                ),
                if (slide.body.isNotEmpty) ...[
                  const SizedBox(height: Tokens.space1),
                  Text(slide.body, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 14)),
                ],
                const SizedBox(height: Tokens.space3),
                _PillButton(label: slide.action, onTap: slide.onAction),
              ],
            ),
          ),
        ),
        if (widget.slides.length > 1)
          PositionedDirectional(
            start: Tokens.space4,
            bottom: Tokens.space5,
            child: ExcludeSemantics(
              child: Row(children: [
                for (var i = 0; i < widget.slides.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsetsDirectional.only(end: 6),
                    width: i == _index ? 20 : 6,
                    height: 6,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: i == _index ? 1 : 0.5), borderRadius: BorderRadius.circular(3)),
                  ),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// The slide's button, in the restaurant's button style.
class _PillButton extends StatelessWidget {
  const _PillButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.buttonBg,
      shape: StadiumBorder(side: BorderSide(color: context.buttonLine)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(label, style: TextStyle(color: context.buttonFg, fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(width: 4),
              Icon(LucideIcons.chevronRight, size: 18, color: context.buttonFg),
            ]),
          ),
        ),
      ),
    );
  }
}

/// The built-in first slide, used until staff publish a hero of their own.
HeroSlide builtInHeroSlide(Strings s, VoidCallback onMenu) => HeroSlide(
      background: const HeroVideo(video: Art.heroVideo, poster: Art.heroVideoPoster),
      title: s.heroTitle,
      body: s.heroBody,
      action: s.menu,
      onAction: onMenu,
    );
