// Frames of the opening animation (widgets/brand_intro.dart), for checking it by eye: the name's halves arriving, the
// knife, the halves closing and the splash. Run: flutter test tool/intro_capture_test.dart --update-goldens
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/brand.dart';
import 'package:sample_kitchen/widgets/brand_intro.dart';

import 'capture_support.dart';

void main() {
  setUpAll(loadCaptureFonts);

  for (final (lang, name) in [('en', 'Vikashan Kitchen'), ('en', 'Vikashan')]) {
    testWidgets('intro $name', (tester) async {
      tester.view.physicalSize = const Size(390, 844) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final brand = Brand.fromJson({'name': {'en': name, 'ar': name}, 'color': '#B45309'});
      await tester.pumpWidget(captureApp(BrandIntro(brand: brand, lang: lang)));
      final tag = name.replaceAll(' ', '-').toLowerCase();
      var at = 0;
      await tester.pump();
      for (final ms in [300, 900, 1250, 1500, 1800, 2400]) {
        await tester.pump(Duration(milliseconds: ms - at));
        at = ms;
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/intro-$tag-$ms.png'));
      }
    });
  }
}
