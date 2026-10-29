import 'package:flutter/material.dart';

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
  static const bg = Color(0xFFFFFFFF);
  static const surface = Color(0xFFF5F5F4);
  static const border = Color(0xFFE7E5E4);
  static const borderInput = Color(0xFF78716C);
  static const text = Color(0xFF1C1917);
  static const textMuted = Color(0xFF57534E);
  static const accent = Color(0xFFB45309);
  static const onAccent = Color(0xFFFFFFFF);
  static const danger = Color(0xFFB91C1C);
  static const success = Color(0xFF15803D);

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
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: Tokens.accent, primary: Tokens.accent, onPrimary: Tokens.onAccent, surface: Tokens.bg, onSurface: Tokens.text, error: Tokens.danger);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Tokens.bg,
    appBarTheme: const AppBarTheme(backgroundColor: Tokens.bg, foregroundColor: Tokens.text, elevation: 0, surfaceTintColor: Colors.transparent),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Tokens.accent,
        foregroundColor: Tokens.onAccent,
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd), borderSide: const BorderSide(color: Tokens.borderInput)),
    ),
    dividerColor: Tokens.border,
    // Material 3 tints sheets with the seed colour; the design keeps them on the plain background.
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Tokens.bg, surfaceTintColor: Colors.transparent, modalBackgroundColor: Tokens.bg),
  );
}
