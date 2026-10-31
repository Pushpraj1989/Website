import 'package:flutter/material.dart';

import '../core/art.dart';
import '../core/brand.dart';
import '../core/strings.dart';
import '../core/theme.dart';

/// A dish's picture: the photo staff uploaded in the admin when there is one, otherwise the category's picture.
/// A photo that fails to load falls back to the category picture too, so a dish never shows a broken image.
class DishImage extends StatelessWidget {
  const DishImage({super.key, required this.illustration, this.imageUrl, this.width, this.height, this.fit = BoxFit.cover, this.cacheWidth});
  final String illustration;
  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final int? cacheWidth;

  @override
  Widget build(BuildContext context) {
    // A shop's product without a photo shows a soft panel in the brand colour, never a food picture.
    final Widget fallback = Strings.shop
        ? SizedBox(width: width, height: height, child: ColoredBox(color: context.accentSoft, child: Icon(Icons.shopping_bag_outlined, color: context.accentFg)))
        : Image.asset(Art.forCategory(illustration), width: width, height: height, fit: fit, cacheWidth: cacheWidth, semanticLabel: '');
    final url = imageUrl;
    if (url == null) return fallback;
    return Image.network(
      url,
      width: width,
      height: height,
      fit: fit,
      cacheWidth: cacheWidth,
      semanticLabel: '',
      loadingBuilder: (context, child, progress) => progress == null ? child : SizedBox(width: width, height: height, child: ColoredBox(color: Tokens.fill)),
      errorBuilder: (_, _, _) => fallback,
    );
  }
}

/// A square dish picture with rounded corners, for lists.
class DishThumb extends StatelessWidget {
  const DishThumb({super.key, required this.illustration, this.imageUrl, this.size = 64});
  final String illustration;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Tokens.radiusMd),
        child: DishImage(illustration: illustration, imageUrl: imageUrl, width: size, height: size, cacheWidth: (size * 3).round()),
      ),
    );
  }
}
