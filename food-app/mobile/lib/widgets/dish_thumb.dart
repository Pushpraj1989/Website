import 'package:flutter/material.dart';

import '../core/art.dart';
import '../core/theme.dart';

/// A square dish picture. Shows the category's illustration until the dish has a photo of its own.
class DishThumb extends StatelessWidget {
  const DishThumb({super.key, required this.illustration, this.size = 64});
  final String illustration;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Tokens.radiusMd),
        child: Image.asset(Art.forCategory(illustration), width: size, height: size, fit: BoxFit.cover),
      ),
    );
  }
}
