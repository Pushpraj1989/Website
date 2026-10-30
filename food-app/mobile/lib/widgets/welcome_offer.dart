import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/brand.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'home_hero.dart';
import 'promo_motion.dart';
import 'ui.dart';

// The pop-up that greets a customer when the app opens: the offer staff published, how it arrives (slide from any
// side, zoom or fade), its size and frame, and how often it shows (every open, once a day, or only once).

bool _shownThisOpen = false;

/// Whether the pop-up should show now, by the frequency staff set. Remembers the showing on the device.
Future<bool> shouldShowWelcome(Promotion promo, {SharedPreferences? prefs, DateTime? now}) async {
  final store = prefs ?? await SharedPreferences.getInstance();
  final key = 'welcome_${promo.id}';
  final today = (now ?? DateTime.now()).toIso8601String().substring(0, 10);
  final last = store.getString(key);
  final due = switch (promo.look.frequency) {
    'every_open' => !_shownThisOpen,
    'once' => last == null,
    _ => last != today,
  };
  if (due) {
    _shownThisOpen = true;
    await store.setString(key, today);
  }
  return due;
}

/// For tests: forget that the pop-up showed in this run of the app.
void resetWelcomeForTests() => _shownThisOpen = false;

Future<void> showWelcomeOffer(BuildContext context, {required Promotion promo, required Strings s, required VoidCallback onAction}) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: s.close,
    barrierColor: const Color(0x99000000),
    transitionDuration: reducedMotion(context) ? Duration.zero : const Duration(milliseconds: 480),
    pageBuilder: (context, _, _) => _WelcomeOffer(promo: promo, s: s, onAction: onAction),
    transitionBuilder: (context, animation, _, child) => promoTransition(promo.look.animation, animation, child),
  );
}

class _WelcomeOffer extends StatelessWidget {
  const _WelcomeOffer({required this.promo, required this.s, required this.onAction});
  final Promotion promo;
  final Strings s;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final lang = s.lang;
    final offer = promo.offer;
    final screen = MediaQuery.sizeOf(context);
    final full = promo.look.size == 'full';
    final maxHeight = switch (promo.look.size) {
      'compact' => screen.height * 0.6,
      'tall' => screen.height * 0.9,
      'full' => screen.height,
      _ => screen.height * 0.82,
    };
    final title = promo.title.of(lang).isNotEmpty ? promo.title.of(lang) : offer?.headline.of(lang) ?? '';
    final local = MaterialLocalizations.of(context);
    return Align(
      alignment: Alignment.bottomCenter,
      child: Material(
        color: Tokens.palette.sheet,
        borderRadius: full ? null : const BorderRadius.vertical(top: Radius.circular(28)),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxHeight, minHeight: full ? maxHeight : 0, maxWidth: 600),
          child: SafeArea(
            top: full,
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space3, Tokens.space4, Tokens.space4),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: IconButton.outlined(
                      onPressed: () => Navigator.of(context).pop(),
                      tooltip: s.close,
                      icon: const Icon(LucideIcons.x),
                      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
                    ),
                  ),
                  Semantics(
                    header: true,
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.15),
                    ),
                  ),
                  if (promo.body.of(lang).isNotEmpty) ...[
                    const SizedBox(height: Tokens.space2),
                    Text(
                      promo.body.of(lang),
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Tokens.textMuted),
                    ),
                  ],
                  const SizedBox(height: Tokens.space5),
                  _Ticket(promo: promo, s: s),
                  if (offer != null) ...[
                    const SizedBox(height: Tokens.space5),
                    Text(s.daysLeft(offer.daysLeft), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                    if (offer.code != null) ...[
                      const SizedBox(height: Tokens.space2),
                      Text(
                        s.useCode(offer.code!),
                        style: TextStyle(color: Tokens.textMuted, fontWeight: FontWeight.w600),
                      ),
                    ],
                    const SizedBox(height: Tokens.space4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Fact(icon: LucideIcons.shoppingBasket, label: s.validOn, value: offer.appliesTo == 'order' ? s.allDishes : s.selectedDishes),
                        _Fact(
                          icon: LucideIcons.wallet,
                          label: s.minSpend,
                          value: offer.minSpendMinor > 0 ? formatMoney(offer.minSpendMinor, offer.currency) : s.noLimit,
                        ),
                        _Fact(
                          icon: LucideIcons.coins,
                          label: s.maxSaving,
                          value: offer.maxSavingMinor != null ? formatMoney(offer.maxSavingMinor!, offer.currency) : s.noLimit,
                        ),
                        _Fact(icon: LucideIcons.calendarDays, label: s.validUntil, value: local.formatShortMonthDay(offer.endsAt.toLocal())),
                      ],
                    ),
                  ],
                  const SizedBox(height: Tokens.space5),
                  PrimaryAction(
                    label: promo.cta.of(lang).isEmpty ? s.orderNow : promo.cta.of(lang),
                    onPressed: () {
                      Navigator.of(context).pop();
                      onAction();
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        container: true,
        label: '$label: $value',
        excludeSemantics: true,
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(14)),
              child: Icon(icon, color: context.accentInk, size: 20),
            ),
            const SizedBox(height: Tokens.space2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(color: Tokens.textMuted, fontSize: 12),
            ),
            Text(
              value,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

/// The offer in its frame: a ticket with notches, a rounded or square card, or a circle. With a picture or GIF the
/// picture fills it; otherwise the offer's headline does.
class _Ticket extends StatelessWidget {
  const _Ticket({required this.promo, required this.s});
  final Promotion promo;
  final Strings s;

  @override
  Widget build(BuildContext context) {
    final colours = [promo.look.colour ?? context.accent, Color.lerp(promo.look.colour ?? context.accent, Colors.black, 0.35)!];
    final headline = promo.offer?.headline.of(s.lang) ?? promo.kicker.of(s.lang);
    final frame = promo.look.frame;
    final inner = Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colours),
      ),
      alignment: Alignment.center,
      child: promo.hasMedia
          ? SizedBox.expand(child: ExcludeSemantics(child: HeroSlide.mediaFor(promo, colours.first)))
          : Padding(
              padding: const EdgeInsets.symmetric(horizontal: Tokens.space5),
              child: FittedBox(
                child: Text(
                  headline.replaceFirst(' ', '\n'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 48, height: 0.95, fontWeight: FontWeight.w900),
                ),
              ),
            ),
    );
    final shape = switch (frame) {
      'circle' => ClipOval(child: SizedBox(width: 220, height: 220, child: inner)),
      'square' => SizedBox(width: 290, height: 180, child: inner),
      'rounded' => ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: SizedBox(width: 290, height: 180, child: inner),
      ),
      _ => Transform.rotate(
        angle: -0.07,
        child: DecoratedBox(
          decoration: BoxDecoration(
            boxShadow: [BoxShadow(color: Color.lerp(colours.first, Colors.black, 0.6)!, offset: const Offset(8, 10))],
            borderRadius: BorderRadius.circular(16),
          ),
          child: ClipPath(
            clipper: _TicketClipper(),
            child: SizedBox(width: 280, height: 175, child: inner),
          ),
        ),
      ),
    };
    return Semantics(
      label: headline,
      child: Center(child: shape),
    );
  }
}

class _TicketClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    const notch = 22.0;
    final body = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(16)));
    final cuts = Path()
      ..addOval(Rect.fromCircle(center: Offset(0, size.height / 2), radius: notch))
      ..addOval(Rect.fromCircle(center: Offset(size.width, size.height / 2), radius: notch));
    return Path.combine(PathOperation.difference, body, cuts);
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
