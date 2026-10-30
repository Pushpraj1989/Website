// Shared by the screen captures: the app's fonts and theme, loaded the way a device would show them.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:sample_kitchen/core/theme.dart';

/// Loads the fonts the app uses, so captures match a device. The test runner does not load them on its own.
Future<void> loadCaptureFonts() async {
  final roboto = FontLoader('Roboto')
    ..addFont(Future.value(ByteData.sublistView(File('/opt/flutter/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf').readAsBytesSync())))
    ..addFont(Future.value(ByteData.sublistView(File('/opt/flutter/bin/cache/artifacts/material_fonts/Roboto-Medium.ttf').readAsBytesSync())))
    ..addFont(Future.value(ByteData.sublistView(File('/opt/flutter/bin/cache/artifacts/material_fonts/Roboto-Bold.ttf').readAsBytesSync())));
  await roboto.load();
  final icons = FontLoader('MaterialIcons')
    ..addFont(Future.value(ByteData.sublistView(File('/opt/flutter/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf').readAsBytesSync())));
  await icons.load();
  // The heading face is bundled with the app (assets/fonts). The test runner does not load app fonts, so it is registered here.
  final fraunces = FontLoader('Fraunces')..addFont(Future.value(ByteData.sublistView(File('assets/fonts/Fraunces-Variable.ttf').readAsBytesSync())));
  await fraunces.load();
  // The Lucide icons (the bottom bar and the home screen) are package fonts. Flutter names a package font
  // 'packages/<package>/<family>', so each family the package declares is loaded under that name.
  final config = File('.dart_tool/package_config.json').absolute;
  final packages = (jsonDecode(config.readAsStringSync())['packages'] as List).cast<Map<String, dynamic>>();
  final lucideRoot = packages.firstWhere((p) => p['name'] == 'lucide_icons_flutter')['rootUri'] as String;
  final lucideBase = Uri.file(config.path).resolve(lucideRoot.endsWith('/') ? lucideRoot : '$lucideRoot/');
  const lucideFonts = {
    'Lucide': 'assets/lucide.ttf',
    'Lucide100': 'assets/build_font/LucideVariable-w100.ttf',
    'Lucide200': 'assets/build_font/LucideVariable-w200.ttf',
    'Lucide300': 'assets/build_font/LucideVariable-w300.ttf',
    'Lucide400': 'assets/build_font/LucideVariable-w400.ttf',
    'Lucide500': 'assets/build_font/LucideVariable-w500.ttf',
    'Lucide600': 'assets/build_font/LucideVariable-w600.ttf',
  };
  for (final entry in lucideFonts.entries) {
    final lucide = FontLoader('packages/lucide_icons_flutter/${entry.key}')..addFont(Future.value(ByteData.sublistView(File.fromUri(lucideBase.resolve(entry.value)).readAsBytesSync())));
    await lucide.load();
  }
  // Arabic letters are not in Roboto. A device uses its system Arabic font; the capture uses FreeSerif, which has them.
  final arabic = FontLoader('ArabicFallback')..addFont(Future.value(ByteData.sublistView(File('/usr/share/fonts/truetype/freefont/FreeSerif.ttf').readAsBytesSync())));
  await arabic.load();
}

/// The app's theme and localisation around one screen.
Widget captureApp(Widget home, {String lang = 'en'}) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: buildTheme().copyWith(textTheme: buildTheme().textTheme.apply(fontFamilyFallback: const ['ArabicFallback'])),
    locale: Locale(lang),
    supportedLocales: const [Locale('en'), Locale('ar')],
    localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
    home: home,
    builder: (context, child) => DefaultTextStyle.merge(style: const TextStyle(fontFamilyFallback: ['ArabicFallback']), child: child!),
  );
}
