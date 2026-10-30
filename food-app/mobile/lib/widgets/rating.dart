import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/models.dart';
import '../core/strings.dart';
import '../core/theme.dart';

/// A dish's score in a coloured box with the number of ratings under it. Green from 4 stars up, amber below.
/// Both colours keep white text at 4.5:1 or more.
class RatingChip extends StatelessWidget {
  const RatingChip({super.key, required this.rating, required this.s, this.inline = false});
  final DishRating rating;
  final Strings s;
  /// Box and count side by side, for list rows; stacked otherwise.
  final bool inline;

  @override
  Widget build(BuildContext context) {
    final good = rating.average >= 4;
    final box = Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(7),
        gradient: LinearGradient(colors: good ? const [Color(0xFF15803D), Color(0xFF166534)] : const [Color(0xFFB45309), Color(0xFF92400E)]),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(rating.average.toStringAsFixed(1), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
        const SizedBox(width: 3),
        const Icon(Icons.star_rounded, color: Colors.white, size: 13),
      ]),
    );
    final count = Text(s.ratingsCount(rating.count), style: TextStyle(color: Tokens.textMuted, fontSize: 11));
    return Semantics(
      label: s.ratedLabel(rating.average, rating.count),
      excludeSemantics: true,
      child: inline
          ? Row(mainAxisSize: MainAxisSize.min, children: [box, const SizedBox(width: 6), count])
          : Column(mainAxisSize: MainAxisSize.min, children: [box, const SizedBox(height: 2), count]),
    );
  }
}

/// Five stars to rate an order. Each star is its own 48 point button with a spoken value.
class RateStars extends StatelessWidget {
  const RateStars({super.key, required this.value, required this.onRate, required this.s});
  final int? value;
  final ValueChanged<int> onRate;
  final Strings s;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 1; i <= 5; i++)
        Semantics(
          button: true,
          selected: value == i,
          label: s.starsLabel(i),
          excludeSemantics: true,
          child: InkResponse(
            onTap: () => onRate(i),
            radius: 24,
            child: SizedBox(
              width: 44,
              height: 48,
              child: Icon(
                (value ?? 0) >= i ? Icons.star_rounded : LucideIcons.star,
                size: (value ?? 0) >= i ? 30 : 24,
                color: (value ?? 0) >= i ? const Color(0xFFF59E0B) : Tokens.textMuted,
              ),
            ),
          ),
        ),
    ]);
  }
}
