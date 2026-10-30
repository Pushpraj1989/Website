// The welcome pop-up shows as often as staff chose, and the promotion's look and offer terms come through intact.
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/models.dart';
import 'package:sample_kitchen/widgets/welcome_offer.dart';
import 'package:shared_preferences/shared_preferences.dart';

Promotion promo(String frequency) => Promotion.fromJson({
      'id': 'p-$frequency',
      'media': null,
      'title': {'en': 'A little treat', 'ar': 'هدية'},
      'cta': {'en': '', 'ar': ''},
      'offer': {'headline': {'en': '10% OFF', 'ar': 'خصم 10%'}, 'code': 'HELLO10', 'minSpendMinor': 4000, 'maxSavingMinor': 2000, 'currency': 'AED', 'endsAt': '2026-11-02T00:00:00.000Z', 'daysLeft': 3, 'appliesTo': 'order'},
      'look': {'animation': 'zoom', 'size': 'tall', 'frame': 'ticket', 'colour': '#0F766E', 'durationSeconds': 4, 'frequency': frequency},
    });

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    resetWelcomeForTests();
  });

  test('a promotion carries its look and its offer terms', () {
    final p = promo('once');
    expect(p.hasMedia, isFalse);
    expect(p.kind, 'none');
    expect(p.look.animation, 'zoom');
    expect(p.look.colour?.toARGB32(), 0xFF0F766E);
    expect(p.offer?.headline.en, '10% OFF');
    expect(p.offer?.maxSavingMinor, 2000);
  });

  test('"only once" shows the first time and never again', () async {
    final prefs = await SharedPreferences.getInstance();
    expect(await shouldShowWelcome(promo('once'), prefs: prefs), isTrue);
    resetWelcomeForTests();
    expect(await shouldShowWelcome(promo('once'), prefs: prefs, now: DateTime(2030)), isFalse);
  });

  test('"once a day" shows again the next day, not the same day', () async {
    final prefs = await SharedPreferences.getInstance();
    final day = DateTime(2026, 10, 30, 9);
    expect(await shouldShowWelcome(promo('once_per_day'), prefs: prefs, now: day), isTrue);
    expect(await shouldShowWelcome(promo('once_per_day'), prefs: prefs, now: day.add(const Duration(hours: 5))), isFalse);
    expect(await shouldShowWelcome(promo('once_per_day'), prefs: prefs, now: day.add(const Duration(days: 1))), isTrue);
  });

  test('"every time the app opens" shows once per opening', () async {
    final prefs = await SharedPreferences.getInstance();
    expect(await shouldShowWelcome(promo('every_open'), prefs: prefs), isTrue);
    expect(await shouldShowWelcome(promo('every_open'), prefs: prefs), isFalse, reason: 'not twice in the same opening');
    resetWelcomeForTests();
    expect(await shouldShowWelcome(promo('every_open'), prefs: prefs), isTrue, reason: 'the next opening shows it again');
  });
}
