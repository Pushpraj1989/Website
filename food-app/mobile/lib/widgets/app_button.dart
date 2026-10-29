import 'package:flutter/material.dart';

import '../core/theme.dart';

// Variants and sizes come from replica/design/tokens.json ("button"). Colours are roles, never raw values.
enum ButtonVariant { primary, secondary, ghost, danger }

enum ButtonSize { sm, md, lg }

const _heights = {ButtonSize.sm: 32.0, ButtonSize.md: 40.0, ButtonSize.lg: 48.0};

/// A button with a minimum 48 px touch target. A small button keeps its visual height, but its tappable
/// area is still 48 px tall, so a 32 px button is not a 32 px target (WCAG 2.2 target size guidance).
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = ButtonVariant.primary,
    this.size = ButtonSize.md,
    this.icon,
    this.loading = false,
    this.expand = false,
    this.radius = Tokens.radiusMd,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final ButtonSize size;
  final IconData? icon;
  final bool loading;
  final bool expand;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    final colours = _colours(variant, enabled);
    final visualHeight = _heights[size]!;

    final visual = Container(
      height: visualHeight,
      padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
      decoration: BoxDecoration(
        color: colours.bg,
        border: Border.all(color: colours.border, width: variant == ButtonVariant.secondary ? 1.5 : 1),
        borderRadius: BorderRadius.circular(radius),
      ),
      alignment: Alignment.center,
      child: Row(
        mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null && !loading) ...[Icon(icon, size: 18, color: colours.text), const SizedBox(width: Tokens.space2)],
          // The label keeps its width while loading: a spinner replaces the icon, not the text.
          Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: TextStyle(color: colours.text, fontWeight: FontWeight.w600, fontSize: size == ButtonSize.sm ? 14 : 16))),
          if (loading) ...[const SizedBox(width: Tokens.space2), SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: colours.text))],
        ],
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: BorderRadius.circular(radius),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: Tokens.minHit, minWidth: Tokens.minHit),
          child: Align(
            widthFactor: expand ? null : 1,
            child: SizedBox(width: expand ? double.infinity : null, child: visual),
          ),
        ),
      ),
    );
  }

  _Colours _colours(ButtonVariant v, bool enabled) {
    if (!enabled) return const _Colours(bg: Tokens.surface, text: Tokens.textMuted, border: Tokens.border);
    return switch (v) {
      ButtonVariant.primary => const _Colours(bg: Tokens.accent, text: Tokens.onAccent, border: Tokens.accent),
      ButtonVariant.secondary => const _Colours(bg: Tokens.bg, text: Tokens.text, border: Tokens.borderInput),
      ButtonVariant.ghost => const _Colours(bg: Colors.transparent, text: Tokens.accent, border: Colors.transparent),
      ButtonVariant.danger => const _Colours(bg: Tokens.bg, text: Tokens.danger, border: Tokens.danger),
    };
  }
}

class _Colours {
  const _Colours({required this.bg, required this.text, required this.border});
  final Color bg;
  final Color text;
  final Color border;
}
