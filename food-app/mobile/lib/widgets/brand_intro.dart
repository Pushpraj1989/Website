import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/brand.dart';
import '../core/theme.dart';

/// The opening of the app, in the restaurant's own name and colour: the name arrives in two halves that zoom in from
/// either side, a knife slices between them, the halves close up, and a splash bursts out behind. Everything comes
/// from the restaurant's settings, so another restaurant gets its own name and colour. With [play] off (tests, or a
/// visitor who asks for less motion) the finished picture shows at once. [child] sits on top, for the unlock screen.
class BrandIntro extends StatefulWidget {
  const BrandIntro({super.key, required this.brand, required this.lang, this.play = true, this.child, this.onDone, this.duration = const Duration(milliseconds: 2400)});
  final Brand? brand;
  /// Called once the animation has played through (at once when it does not play).
  final VoidCallback? onDone;
  final String lang;
  final bool play;
  final Widget? child;
  final Duration duration;

  @override
  State<BrandIntro> createState() => _BrandIntroState();
}

class _BrandIntroState extends State<BrandIntro> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.duration)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed) widget.onDone?.call();
    });

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final calm = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (!widget.play || calm) {
      _c.value = 1;
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.onDone?.call());
    } else if (!_c.isAnimating && _c.value == 0) {
      _c.forward();
    }
  }

  // On a first visit the name arrives from the server after the animation has begun: it starts again with the name.
  @override
  void didUpdateWidget(BrandIntro old) {
    super.didUpdateWidget(old);
    final had = old.brand?.name.of(old.lang) ?? '';
    final has = widget.brand?.name.of(widget.lang) ?? '';
    final calm = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (widget.play && !calm && had.isEmpty && has.isNotEmpty) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// The name in two halves: at the space nearest the middle, or, for one word, at its middle letter.
  /// The third value is whether the halves are separate words, which keep a space between them once joined.
  static (String, String, bool) _halves(String name) {
    final text = name.trim();
    final spaces = [for (var i = 0; i < text.length; i++) if (text[i] == ' ') i];
    if (spaces.isNotEmpty) {
      final mid = text.length / 2;
      final at = spaces.reduce((a, b) => (a - mid).abs() <= (b - mid).abs() ? a : b);
      return (text.substring(0, at), text.substring(at + 1), true);
    }
    final chars = text.characters.toList();
    final cut = (chars.length / 2).ceil();
    return (chars.take(cut).join(), chars.skip(cut).join(), false);
  }

  @override
  Widget build(BuildContext context) {
    final colour = widget.brand?.color ?? Tokens.accent;
    final name = widget.brand?.name.of(widget.lang) ?? '';
    final (first, second, words) = _halves(name);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final logo = widget.brand?.logoUrl;
    return Semantics(
      label: name,
      container: true,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          double phase(double a, double b, [Curve curve = Curves.easeOutCubic]) => curve.transform(((t - a) / (b - a)).clamp(0.0, 1.0));
          final arrive = phase(0.0, 0.42);
          final slice = phase(0.40, 0.66, Curves.easeInOut);
          final close = phase(0.62, 0.74, Curves.easeOutBack);
          final splash = phase(0.62, 1.0);
          final size = MediaQuery.sizeOf(context);
          final gap = 22.0 * (1 - close);
          final fromSide = size.width * 0.75 * (1 - arrive);
          final scale = 2.6 - 1.6 * arrive;
          const style = TextStyle(color: Colors.white, fontFamily: Tokens.headingFont, fontSize: 52, fontWeight: FontWeight.w800, height: 1.05, letterSpacing: -0.5, decoration: TextDecoration.none, shadows: [Shadow(color: Color(0x55000000), blurRadius: 18, offset: Offset(0, 6))]);
          // Which half moves in from the left of the screen: the first in English, the second in Arabic.
          Widget half(String text, {required bool fromLeft}) => Opacity(
                opacity: arrive,
                child: Transform.translate(
                  offset: Offset(fromLeft ? -fromSide : fromSide, 0),
                  child: Transform.scale(scale: scale, child: Text(text, style: style, textDirection: rtl ? TextDirection.rtl : TextDirection.ltr)),
                ),
              );
          return Stack(fit: StackFit.expand, children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(colors: [Color.lerp(colour, Colors.white, 0.18)!, colour, Color.lerp(colour, Colors.black, 0.35)!], stops: const [0, 0.55, 1], radius: 1.1),
              ),
            ),
            CustomPaint(painter: _SplashPainter(progress: splash, colour: colour)),
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  if (logo != null)
                    Opacity(
                      opacity: splash,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: Tokens.space4),
                        child: ClipRRect(borderRadius: BorderRadius.circular(24), child: Image.network(logo, width: 96, height: 96, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())),
                      ),
                    ),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Row(mainAxisSize: MainAxisSize.min, textDirection: TextDirection.ltr, children: [
                      half(rtl ? second : first, fromLeft: true),
                      SizedBox(width: second.isEmpty ? 0 : math.max(0.0, (words ? 14 : 0) + gap)),
                      if (second.isNotEmpty) half(rtl ? first : second, fromLeft: false),
                    ]),
                  ),
                ]),
              ),
            ),
            if (slice > 0 && slice < 1) CustomPaint(painter: _KnifePainter(progress: slice)),
            if (widget.child != null) widget.child!,
          ]);
        },
      ),
    );
  }
}

/// The splash behind the name: a soft burst of overlapping rounds with droplets thrown outward, growing as [progress]
/// goes from 0 to 1. White and a light tint of the brand colour, so it reads on any colour.
class _SplashPainter extends CustomPainter {
  _SplashPainter({required this.progress, required this.colour});
  final double progress;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final centre = size.center(Offset.zero);
    final base = math.min(size.width, size.height) * 0.36 * progress;
    final soft = Paint()..color = Colors.white.withValues(alpha: 0.10 * (1.2 - progress * 0.4));
    final tint = Paint()..color = Color.lerp(colour, Colors.white, 0.45)!.withValues(alpha: 0.30);
    // The burst: a ring of rounds around the middle, each a little different, so the edge looks splashed.
    const lobes = 11;
    for (var i = 0; i < lobes; i++) {
      final a = i / lobes * math.pi * 2 + 0.3;
      final r = base * (0.62 + 0.18 * math.sin(i * 2.7));
      canvas.drawCircle(centre + Offset(math.cos(a), math.sin(a)) * r, base * (0.36 + 0.1 * math.cos(i * 1.9)), tint);
    }
    canvas.drawCircle(centre, base * 0.85, soft);
    // Droplets thrown out along the rays, further and smaller as the splash grows.
    const drops = 16;
    for (var i = 0; i < drops; i++) {
      final a = i / drops * math.pi * 2 + 0.12 * i;
      final reach = base * (1.15 + 0.45 * ((i * 37) % 10) / 10) * (0.6 + 0.4 * progress);
      final r = (6 + (i % 4) * 3.0) * (1.2 - progress * 0.5);
      canvas.drawCircle(centre + Offset(math.cos(a), math.sin(a)) * reach, r, i.isEven ? tint : soft);
    }
  }

  @override
  bool shouldRepaint(_SplashPainter old) => old.progress != progress || old.colour != colour;
}

/// The knife: a steel blade with a dark handle, sweeping down across the middle of the screen and leaving a bright
/// slash behind it as [progress] goes from 0 to 1.
class _KnifePainter extends CustomPainter {
  _KnifePainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final travel = size.height * 0.5;
    // The path runs from above-right to below-left of the middle.
    const angle = -math.pi / 2.8;
    final dir = Offset(math.cos(angle + math.pi), -math.sin(angle + math.pi));
    final start = centre - dir * travel;
    final tip = start + dir * (travel * 2 * progress);

    // The slash it leaves: bright at the knife, fading towards where it started.
    final slash = Paint()
      ..shader = LinearGradient(colors: [Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: 0.95)]).createShader(Rect.fromPoints(start, tip))
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(start, tip, slash);

    canvas.save();
    canvas.translate(tip.dx, tip.dy);
    canvas.rotate(math.atan2(dir.dy, dir.dx));
    canvas.scale(1.35);
    // A chef's knife: a broad blade curving to the tip, the bolster, then the handle with its rivets.
    final blade = Path()
      ..moveTo(0, 0)
      ..cubicTo(-30, -6, -90, -40, -170, -42)
      ..lineTo(-170, 6)
      ..lineTo(-24, 6)
      ..close();
    canvas.drawPath(blade, Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFFAFAF9), Color(0xFFA8A29E), Color(0xFFE7E5E4)]).createShader(const Rect.fromLTWH(-170, -42, 170, 48)));
    canvas.drawLine(const Offset(-160, -30), const Offset(-40, -8), Paint()..color = Colors.white.withValues(alpha: 0.85)..strokeWidth = 2);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(-182, -44, 14, 52), const Radius.circular(4)), Paint()..color = const Color(0xFF78716C));
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(-290, -34, 112, 34), const Radius.circular(14)), Paint()..color = const Color(0xFF292524));
    for (final x in [-268.0, -236.0, -204.0]) {
      canvas.drawCircle(Offset(x, -17), 3.5, Paint()..color = const Color(0xFFD6D3D1));
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_KnifePainter old) => old.progress != progress;
}
