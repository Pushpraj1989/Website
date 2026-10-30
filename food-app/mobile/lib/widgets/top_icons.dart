import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/brand.dart';
import '../core/strings.dart';
import '../core/theme.dart';

// The icons every top bar carries instead of words: ask the assistant, switch language, open the cart. Each has a
// tooltip and a spoken name, and a 48 point touch area. [onPhoto] draws them as frosted circles for use over a photo.

class TopIcon extends StatelessWidget {
  const TopIcon({super.key, required this.icon, required this.label, required this.onTap, this.onPhoto = false, this.badge = 0, this.highlight = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool onPhoto;
  final int badge;
  /// The assistant's icon: filled in the brand colour so it stands out from the others.
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final fg = highlight ? Colors.white : (onPhoto ? Colors.white : Tokens.text);
    final bg = highlight
        ? context.accent
        : onPhoto
            ? Colors.white.withValues(alpha: 0.2)
            : Tokens.palette.dark ? Tokens.fill : Colors.white;
    return Semantics(
      button: true,
      label: badge > 0 ? '$label, $badge' : label,
      excludeSemantics: true,
      child: Tooltip(
        message: label,
        child: InkResponse(
          onTap: onTap,
          radius: 26,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Center(
              child: Stack(clipBehavior: Clip.none, children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: bg,
                    shape: BoxShape.circle,
                    border: highlight ? null : Border.all(color: onPhoto ? Colors.white.withValues(alpha: 0.35) : Tokens.border),
                  ),
                  child: Icon(icon, size: 20, color: fg),
                ),
                if (badge > 0)
                  PositionedDirectional(
                    top: -3,
                    end: -3,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 19),
                      height: 19,
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: onPhoto ? Colors.white : context.accent, borderRadius: BorderRadius.circular(10)),
                      child: Text('$badge', style: TextStyle(color: onPhoto ? const Color(0xFF1C1917) : Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                    ),
                  ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Switches between English and Arabic. Its name is the other language, so a reader hears where it goes.
class LanguageIcon extends StatelessWidget {
  const LanguageIcon({super.key, required this.language, required this.s, this.onPhoto = false});
  final ValueNotifier<String> language;
  final Strings s;
  final bool onPhoto;

  @override
  Widget build(BuildContext context) => TopIcon(icon: LucideIcons.globe, label: s.language, onPhoto: onPhoto, onTap: () => toggleLanguage(language));
}

/// The cart with the number of items in it, kept current as the cart changes anywhere in the app.
class CartIcon extends StatefulWidget {
  const CartIcon({super.key, required this.api, required this.s, required this.onTap, this.onPhoto = false});
  final ApiClient api;
  final Strings s;
  final VoidCallback onTap;
  final bool onPhoto;

  @override
  State<CartIcon> createState() => _CartIconState();
}

class _CartIconState extends State<CartIcon> {
  int _count = 0;

  @override
  void initState() {
    super.initState();
    widget.api.cartChanges.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    widget.api.cartChanges.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final lines = await widget.api.cartLines();
      if (mounted) setState(() => _count = lines.fold(0, (n, l) => n + l.qty));
    } catch (_) {
      // The icon still opens the cart; only the number is missing.
    }
  }

  @override
  Widget build(BuildContext context) => TopIcon(icon: LucideIcons.shoppingBag, label: widget.s.cart, badge: _count, onPhoto: widget.onPhoto, onTap: widget.onTap);
}
