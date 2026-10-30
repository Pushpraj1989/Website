// Every theme stays readable with any brand colour the admin accepts (white button text at 4.5:1 or more). Worked
// out from the colours, so it holds for Arabic and English alike, unlike the screen sweep's pixel sampling.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/theme.dart';

/// Brand colours across the whole range the settings accept: every hue, from light to very dark.
List<Color> acceptedBrandColours() {
  final out = <Color>[];
  for (var hue = 0.0; hue < 360; hue += 15) {
    for (final sat in [0.0, 0.5, 1.0]) {
      for (var light = 0.0; light <= 0.6; light += 0.05) {
        final c = HSLColor.fromAHSL(1, hue, sat, light).toColor();
        if (contrastBetween(c, Colors.white) >= 4.5) out.add(c);
      }
    }
  }
  return out;
}

void main() {
  final brands = acceptedBrandColours();

  test('there are many accepted brand colours to try, from near black to the lightest allowed', () {
    expect(brands.length, greaterThan(300));
  });

  for (final theme in AppTheme.values) {
    test('${theme.id}: text, muted text and status colours reach 4.5:1 on cards and on the page', () {
      final p = theme.palette;
      for (final accent in brands) {
        final card = Color.alphaBlend(p.bg, p.base);
        final backgrounds = [p.base, card, if (p.isGlass) p.glowOf(accent), if (p.isGlass) Color.alphaBlend(p.bg, p.glowOf(accent))];
        for (final bg in backgrounds) {
          expect(contrastBetween(p.text, bg), greaterThanOrEqualTo(4.5), reason: 'text on $bg with $accent');
          expect(contrastBetween(p.textMuted, bg), greaterThanOrEqualTo(4.5), reason: 'muted on $bg with $accent');
          expect(contrastBetween(p.danger, bg), greaterThanOrEqualTo(4.5), reason: 'danger on $bg with $accent');
        }
      }
      expect(contrastBetween(p.successInk, p.successSoft), greaterThanOrEqualTo(4.5));
      expect(contrastBetween(p.warnInk, p.warnSoft), greaterThanOrEqualTo(4.5));
      expect(contrastBetween(p.danger, Color.alphaBlend(p.dangerSoft, p.base)), greaterThanOrEqualTo(4.5));
    });

    test('${theme.id}: brand text on the page and on its tint reaches 4.5:1 for every accepted brand colour', () {
      final p = theme.palette;
      for (final accent in brands) {
        final b = BrandPalette.of(accent, p);
        final page = [p.base, Color.alphaBlend(p.bg, p.base), if (p.isGlass) p.glowOf(accent)];
        for (final bg in page) {
          expect(contrastBetween(b.accentFg, bg), greaterThanOrEqualTo(4.5), reason: 'brand text $accent on $bg');
        }
        expect(contrastBetween(b.accentInk, b.accentSoft), greaterThanOrEqualTo(4.5), reason: 'brand ink $accent on its tint');
        expect(contrastBetween(b.onAccent, b.accent), greaterThanOrEqualTo(4.5), reason: 'button text on $accent');
      }
    });
  }
}
