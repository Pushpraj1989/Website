import 'package:flutter/material.dart';

// How a promotion arrives, as staff chose it in the admin: slide up from the bottom, down from the top, in from the
// left or the right, zoom in, or fade in. Directions are on screen, the same in English and Arabic, so what staff
// saw in the admin preview is what customers see. With reduced motion on, everything simply appears.

Offset _from(String animation) => switch (animation) {
      'slide_up' => const Offset(0, 1),
      'slide_down' => const Offset(0, -1),
      'slide_left' => const Offset(-1, 0),
      'slide_right' => const Offset(1, 0),
      _ => Offset.zero,
    };

/// Wraps [child] in the arrival for [animation], driven by [progress] from 0 (not yet shown) to 1 (in place).
Widget promoTransition(String animation, Animation<double> progress, Widget child) {
  final curved = CurvedAnimation(parent: progress, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
  return switch (animation) {
    'zoom' => FadeTransition(opacity: curved, child: ScaleTransition(scale: Tween(begin: 0.6, end: 1.0).animate(curved), child: child)),
    'fade' => FadeTransition(opacity: curved, child: child),
    _ => SlideTransition(position: Tween(begin: _from(animation), end: Offset.zero).animate(curved), child: child),
  };
}

bool reducedMotion(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// Plays the arrival once when it first appears (an offer strip, a section).
class PromoEntrance extends StatefulWidget {
  const PromoEntrance({super.key, required this.animation, required this.child, this.duration = const Duration(milliseconds: 480)});
  final String animation;
  final Widget child;
  final Duration duration;

  @override
  State<PromoEntrance> createState() => _PromoEntranceState();
}

class _PromoEntranceState extends State<PromoEntrance> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reducedMotion(context)) {
      _c.value = 1;
    } else if (_c.status == AnimationStatus.dismissed) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ClipRect(child: promoTransition(widget.animation, _c, widget.child));
}
