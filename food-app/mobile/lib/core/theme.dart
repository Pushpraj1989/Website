import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// Colours and sizes from replica/design/tokens.json. Screens use these, never raw values.
class Tokens {
  // Benefit tile tones, keyed by the accent names the server sends. Each tone is a background and an ink colour.
  static const toneLilac = Color(0xFFEDE9FE);
  static const toneLilacInk = Color(0xFF5B21B6);
  static const tonePeach = Color(0xFFFFEDD5);
  static const tonePeachInk = Color(0xFF9A3412);
  static const toneMint = Color(0xFFD1FAE5);
  static const toneMintInk = Color(0xFF065F46);
  static const brandPurple = Color(0xFF5B21B6);
  // The colours below come from the theme the restaurant chose (see [Palette]); the app is rebuilt when it changes.
  static Palette palette = Palette.classic;
  static Color get bg => palette.bg;
  static Color get surface => palette.surface;
  /// A subtle fill inside cards: chips, inactive tiles, empty slots.
  static Color get fill => palette.fill;
  static Color get border => palette.border;
  static Color get borderInput => palette.borderInput;
  static Color get text => palette.text;
  static Color get textMuted => palette.textMuted;
  static Color get danger => palette.danger;
  static Color get success => palette.success;
  /// A red to fill behind white text (a cancelled order, an error banner): 6.5:1 with white in every theme.
  static const dangerFill = Color(0xFFB91C1C);
  /// The restaurant's colour before its settings arrive. Screens use `context.accent`, never this.
  static const accent = Color(0xFFB45309);
  static const onAccent = Color(0xFFFFFFFF);

  static const space1 = 4.0;
  static const space2 = 8.0;
  static const space3 = 12.0;
  static const space4 = 16.0;
  static const space5 = 24.0;
  static const radiusSm = 6.0;
  static const radiusMd = 10.0;
  static const radiusLg = 16.0;

  // Touch targets: at least 48 px, per the button tokens.
  static const minHit = 48.0;
  static const headingFont = 'Fraunces';
  /// The floating bottom dock and the floating cart bar: the room content keeps clear of them.
  static const dockHeight = 64.0;
  static const dockGap = 12.0;
  static const cartBarHeight = 64.0;
}

/// The looks a restaurant can choose in the admin. The brand colour goes on top of each.
enum AppTheme {
  classic('classic'),
  midnight('midnight'),
  glass('glass'),
  glassNight('glass_night');

  const AppTheme(this.id);
  final String id;

  static AppTheme fromId(String? id) => AppTheme.values.firstWhere((t) => t.id == id, orElse: () => AppTheme.classic);
  Palette get palette => switch (this) {
        AppTheme.classic => Palette.classic,
        AppTheme.midnight => Palette.midnight,
        AppTheme.glass => Palette.glass,
        AppTheme.glassNight => Palette.glassNight,
      };
}

/// The neutral colours of one theme. [bg] is the colour of cards and bars; [surface] is behind them (transparent in
/// the glass themes, where each page draws [backdrop] instead); [fill] is a subtle fill inside cards. Every text colour reaches 4.5:1 on what it sits on.
class Palette {
  const Palette({
    required this.brightness,
    required this.isGlass,
    required this.bg,
    required this.surface,
    required this.fill,
    required this.sheet,
    required this.border,
    required this.borderInput,
    required this.text,
    required this.textMuted,
    required this.danger,
    required this.success,
    required this.successSoft,
    required this.successInk,
    required this.warnSoft,
    required this.warnInk,
    required this.dangerSoft,
    required this.base,
  });
  final Brightness brightness;
  final bool isGlass;
  final Color bg, surface, fill, sheet, border, borderInput, text, textMuted, danger, success;
  final Color successSoft, successInk, warnSoft, warnInk, dangerSoft;
  /// The solid colour the page is built on: the screen colour, or the darkest or lightest end of the glass backdrop.
  final Color base;

  bool get dark => brightness == Brightness.dark;

  static const classic = Palette(
    brightness: Brightness.light, isGlass: false,
    bg: Color(0xFFFFFFFF), surface: Color(0xFFF5F5F4), fill: Color(0xFFF5F5F4), sheet: Color(0xFFFFFFFF), base: Color(0xFFF5F5F4),
    border: Color(0xFFE7E5E4), borderInput: Color(0xFF78716C), text: Color(0xFF1C1917), textMuted: Color(0xFF57534E),
    danger: Color(0xFFB91C1C), success: Color(0xFF15803D),
    successSoft: Color(0xFFDCFCE7), successInk: Color(0xFF166534), warnSoft: Color(0xFFFEF3C7), warnInk: Color(0xFF92400E), dangerSoft: Color(0xFFFEE2E2),
  );
  static const midnight = Palette(
    brightness: Brightness.dark, isGlass: false,
    bg: Color(0xFF1C1A18), surface: Color(0xFF0F0E0D), fill: Color(0xFF292622), sheet: Color(0xFF1C1A18), base: Color(0xFF0F0E0D),
    border: Color(0xFF34302C), borderInput: Color(0xFF8A847E), text: Color(0xFFF5F5F4), textMuted: Color(0xFFB0AAA4),
    danger: Color(0xFFF87171), success: Color(0xFF4ADE80),
    successSoft: Color(0xFF14321F), successInk: Color(0xFF86EFAC), warnSoft: Color(0xFF3A2A0A), warnInk: Color(0xFFFCD34D), dangerSoft: Color(0xFF3B1414),
  );
  static const glass = Palette(
    brightness: Brightness.light, isGlass: true,
    bg: Color(0x8CFFFFFF), surface: Color(0x00000000), fill: Color(0x121C1917), sheet: Color(0xFFF8F7F6), base: Color(0xFFFFFFFF),
    border: Color(0x1F1C1917), borderInput: Color(0xFF6B655F), text: Color(0xFF1C1917), textMuted: Color(0xFF48433F),
    danger: Color(0xFF991B1B), success: Color(0xFF15803D),
    successSoft: Color(0xFFDCFCE7), successInk: Color(0xFF166534), warnSoft: Color(0xFFFEF3C7), warnInk: Color(0xFF92400E), dangerSoft: Color(0xFFFEE2E2),
  );
  static const glassNight = Palette(
    brightness: Brightness.dark, isGlass: true,
    bg: Color(0x1AFFFFFF), surface: Color(0x00000000), fill: Color(0x17FFFFFF), sheet: Color(0xFF1A1816), base: Color(0xFF0B0A09),
    border: Color(0x2EFFFFFF), borderInput: Color(0xFF9A948E), text: Color(0xFFFAFAF9), textMuted: Color(0xFFD0CAC4),
    danger: Color(0xFFFCA5A5), success: Color(0xFF4ADE80),
    successSoft: Color(0xFF14321F), successInk: Color(0xFF86EFAC), warnSoft: Color(0xFF3A2A0A), warnInk: Color(0xFFFCD34D), dangerSoft: Color(0xFF3B1414),
  );

  /// The brightest colour behind content in a glass backdrop: where text has the least contrast.
  Color glowOf(Color accent) => dark ? Color.lerp(base, accent, 0.38)! : Color.lerp(base, accent, 0.24)!;

  /// What the glass themes draw behind every page: a soft wash (or a glow) of the brand colour.
  BoxDecoration backdrop(Color accent) => dark
      ? BoxDecoration(
          gradient: RadialGradient(center: const Alignment(-0.8, -1.0), radius: 1.4, colors: [glowOf(accent), Color.lerp(base, accent, 0.12)!, base], stops: const [0, 0.55, 1]),
        )
      : BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [glowOf(accent), Color.lerp(base, accent, 0.06)!, Color.lerp(base, accent, 0.18)!], stops: const [0, 0.55, 1]),
        );
}

/// The brand colours worked out for the theme: [accent] fills buttons (white text on it reaches 4.5:1, which the
/// settings enforce); [accentFg] is for text, icons and outlines on the page; [accentSoft] is a tint for selected
/// things, and [accentInk] is text on that tint. [accentFg] and [accentInk] are moved towards white (dark themes) or
/// black (light themes) only as far as needed to reach 4.5:1 on every background they meet.
class BrandPalette extends ThemeExtension<BrandPalette> {
  const BrandPalette({required this.accent, required this.onAccent, required this.accentFg, required this.accentSoft, required this.accentInk});
  final Color accent, onAccent, accentFg, accentSoft, accentInk;

  factory BrandPalette.of(Color accent, Palette p) {
    final soft = p.dark ? Color.lerp(accent, p.base, 0.72)! : Color.lerp(accent, Colors.white, 0.88)!;
    final page = [p.base, Color.alphaBlend(p.bg, p.base), if (p.isGlass) p.glowOf(accent), if (p.isGlass) Color.alphaBlend(p.bg, p.glowOf(accent))];
    return BrandPalette(
      accent: accent,
      onAccent: Tokens.onAccent,
      accentFg: readableOn(accent, page, toLight: p.dark),
      accentSoft: soft,
      accentInk: readableOn(accent, [soft], toLight: p.dark),
    );
  }

  @override
  BrandPalette copyWith() => this;

  @override
  BrandPalette lerp(BrandPalette? other, double t) => other == null || t < 0.5 ? this : other;
}

/// WCAG 2.2 contrast between two opaque colours.
double contrastBetween(Color a, Color b) {
  final la = a.computeLuminance(), lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// [colour], moved towards white or black in small steps until it reaches 4.5:1 on each of [backgrounds].
Color readableOn(Color colour, List<Color> backgrounds, {required bool toLight, double target = 4.5}) {
  final end = toLight ? Colors.white : Colors.black;
  for (var t = 0.0; t <= 1.0001; t += 0.05) {
    final c = Color.lerp(colour, end, t)!;
    if (backgrounds.every((b) => contrastBetween(c, b) >= target)) return c;
  }
  return end;
}

/// The app's theme: the restaurant's [theme] with its brand colour [accent] on top.
ThemeData buildTheme({Color accent = Tokens.accent, AppTheme theme = AppTheme.classic}) {
  final p = theme.palette;
  Tokens.palette = p;
  final brand = BrandPalette.of(accent, p);
  // Material's own parts (text buttons, radios, progress) take `primary` as a foreground, so on dark themes it is
  // the readable shade; filled buttons still use the true brand colour.
  final scheme = ColorScheme.fromSeed(
    seedColor: accent,
    brightness: p.brightness,
    primary: brand.accentFg,
    onPrimary: p.dark ? p.base : Tokens.onAccent,
    surface: p.dark ? Color.alphaBlend(p.bg, p.base) : Colors.white,
    onSurface: p.text,
    onSurfaceVariant: p.textMuted,
    outline: p.borderInput,
    outlineVariant: p.border,
    error: p.danger,
  );
  // Headings use Fraunces, a free serif (SIL Open Font License). Body text is the bundled Roboto, and Arabic falls back to
  // the bundled Noto Sans Arabic (OFL), so text is the same on every phone and the web build needs no font downloads.
  final typography = Typography.material2021();
  final base = (p.dark ? typography.white : typography.black).apply(fontFamily: 'Roboto', fontFamilyFallback: const ['NotoSansArabic'], bodyColor: p.text, displayColor: p.text);
  final headingFont = base.headlineSmall?.copyWith(fontFamily: Tokens.headingFont);
  return ThemeData(
    useMaterial3: true,
    brightness: p.brightness,
    colorScheme: scheme,
    extensions: [brand],
    scaffoldBackgroundColor: p.surface,
    canvasColor: p.sheet,
    textTheme: base.copyWith(
      headlineSmall: headingFont,
      headlineMedium: base.headlineMedium?.copyWith(fontFamily: Tokens.headingFont),
      titleLarge: base.titleLarge?.copyWith(fontFamily: Tokens.headingFont),
      titleMedium: base.titleMedium?.copyWith(fontFamily: Tokens.headingFont),
    ),
    appBarTheme: AppBarTheme(backgroundColor: p.bg, foregroundColor: p.text, elevation: 0, surfaceTintColor: Colors.transparent, systemOverlayStyle: p.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accent,
        foregroundColor: Tokens.onAccent,
        disabledBackgroundColor: p.text.withValues(alpha: 0.12),
        disabledForegroundColor: p.text.withValues(alpha: 0.45),
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd), borderSide: BorderSide(color: p.borderInput)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd), borderSide: BorderSide(color: p.borderInput)),
      labelStyle: TextStyle(color: p.textMuted),
      hintStyle: TextStyle(color: p.textMuted),
      fillColor: p.isGlass ? p.bg : null,
      filled: p.isGlass,
    ),
    dividerColor: p.border,
    dividerTheme: DividerThemeData(color: p.border),
    cardTheme: CardThemeData(color: p.bg, surfaceTintColor: Colors.transparent),
    snackBarTheme: SnackBarThemeData(backgroundColor: p.dark ? const Color(0xFFF5F5F4) : const Color(0xFF292524), contentTextStyle: TextStyle(color: p.dark ? const Color(0xFF1C1917) : Colors.white), actionTextColor: p.dark ? Color.lerp(accent, Colors.black, 0.2) : readableOn(accent, [const Color(0xFF292524)], toLight: true)),
    // Material 3 tints sheets with the seed colour; the design keeps them on the plain background.
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: p.sheet, surfaceTintColor: Colors.transparent, modalBackgroundColor: p.sheet),
    dialogTheme: DialogThemeData(backgroundColor: p.sheet, surfaceTintColor: Colors.transparent),
    // In the glass themes every page carries the backdrop itself, so pages stay solid while they slide over each other.
    pageTransitionsTheme: p.isGlass ? _GlassPages(p.backdrop(accent)) : const PageTransitionsTheme(),
  );
}

class _GlassPages extends PageTransitionsTheme {
  const _GlassPages(this.backdrop);
  final BoxDecoration backdrop;

  @override
  Widget buildTransitions<T>(PageRoute<T> route, BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) =>
      super.buildTransitions(route, context, animation, secondaryAnimation, DecoratedBox(decoration: backdrop, child: child));
}

/// The height of a fixed-height row that holds text, grown by however much the reader's text size enlarges that text.
/// [textPart] is the share of [base] taken by text at normal size.
double scaledHeight(BuildContext context, double base, double textPart) => base + MediaQuery.textScalerOf(context).scale(textPart) - textPart;
