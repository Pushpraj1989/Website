import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/brand.dart';
import '../core/strings.dart';
import '../core/theme.dart';

/// A white card with an optional icon and title, the building block of the cart, checkout and order screens.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, this.icon, this.trailing, required this.child, this.padding = const EdgeInsets.all(Tokens.space4)});
  final String? title;
  final IconData? icon;
  final Widget? trailing;
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Tokens.bg,
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (title != null) ...[
          Row(children: [
            if (icon != null) ...[
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(Tokens.radiusMd)),
                child: Icon(icon, size: 18, color: context.accent),
              ),
              const SizedBox(width: Tokens.space3),
            ],
            Expanded(child: Text(title!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
            ?trailing,
          ]),
          const SizedBox(height: Tokens.space3),
        ],
        child,
      ]),
    );
  }
}

/// A pill with minus, the quantity and plus. Each button is a 44 px target and names the dish for screen readers.
/// With [removeLabel], minus on the last one becomes a bin that sets the quantity to 0.
class QtyStepper extends StatelessWidget {
  const QtyStepper({super.key, required this.qty, required this.onChanged, required this.label, this.removeLabel, this.max = 20, this.compact = false});
  final int qty;
  final ValueChanged<int> onChanged;
  final String label;
  final String? removeLabel;
  final int max;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final size = compact ? 36.0 : 44.0;
    Widget button(IconData icon, String tip, VoidCallback? onTap) => SizedBox(
          width: size + 8,
          height: size + 8,
          child: IconButton(
            tooltip: tip,
            onPressed: onTap,
            iconSize: compact ? 16 : 20,
            color: context.accent,
            disabledColor: Tokens.textMuted.withValues(alpha: 0.4),
            icon: Icon(icon),
          ),
        );
    return Container(
      decoration: BoxDecoration(border: Border.all(color: Tokens.border), borderRadius: BorderRadius.circular(999), color: Tokens.bg),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (qty <= 1 && removeLabel != null)
          button(LucideIcons.trash2, removeLabel!, () => onChanged(0))
        else
          button(LucideIcons.minus, '− $label', qty > 1 ? () => onChanged(qty - 1) : null),
        Semantics(
          label: label,
          value: '$qty',
          child: SizedBox(width: 24, child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
        ),
        button(LucideIcons.plus, '+ $label', qty < max ? () => onChanged(qty + 1) : null),
      ]),
    );
  }
}

/// The bar pinned to the bottom of a screen with its main action, above the system gesture area.
class BottomActionBar extends StatelessWidget {
  const BottomActionBar({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(Tokens.space4, Tokens.space3, Tokens.space4, Tokens.space3 + MediaQuery.paddingOf(context).bottom),
      decoration: const BoxDecoration(
        color: Tokens.bg,
        boxShadow: [BoxShadow(color: Color(0x1F000000), blurRadius: 20, offset: Offset(0, -4))],
      ),
      child: child,
    );
  }
}

/// The main button: brand colour, full width, with the amount on the end when there is one.
class PrimaryAction extends StatelessWidget {
  const PrimaryAction({super.key, required this.label, required this.onPressed, this.amount, this.busy = false});
  final String label;
  final String? amount;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.radiusLg)),
        // Keep the theme's font; only the size and weight change.
        textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(fontSize: 16, fontWeight: FontWeight.w700),
      ),
      child: Row(children: [
        if (busy) ...[
          SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: context.onAccent)),
          const SizedBox(width: Tokens.space3),
        ],
        Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: amount == null ? TextAlign.center : TextAlign.start)),
        if (amount != null) Text(amount!, style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
      ]),
    );
  }
}

/// One line of a bill: label on the start side, amount on the end side.
class BillRow extends StatelessWidget {
  const BillRow({super.key, required this.label, required this.amount, this.strong = false, this.positive = false});
  final String label;
  final String amount;
  final bool strong;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: strong ? FontWeight.w700 : FontWeight.w400,
      fontSize: strong ? 17 : 15,
      color: positive ? Tokens.success : Tokens.text,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Text(label, style: style)),
        const SizedBox(width: Tokens.space3),
        Text(amount, style: style),
      ]),
    );
  }
}

/// An order's status as a coloured pill: in progress, done, or stopped.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, required this.s});
  final String status;
  final Strings s;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (status) {
      'delivered' || 'collected' => (const Color(0xFFDCFCE7), const Color(0xFF166534)),
      'cancelled' || 'rejected' => (const Color(0xFFFEE2E2), Tokens.danger),
      _ => (context.accentSoft, context.accent),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(s.statusLabel(status), style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

/// A selectable card in a group of choices (order type, address, payment). It reads as a selected or unselected
/// option to screen readers, and the whole card is the tap target.
class ChoiceTile extends StatelessWidget {
  const ChoiceTile({super.key, required this.icon, required this.title, this.subtitle, required this.selected, required this.onTap});
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      selected: selected,
      enabled: enabled,
      button: true,
      child: Material(
        color: selected ? context.accentSoft : Tokens.bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Tokens.radiusLg),
          side: BorderSide(color: selected ? context.accent : Tokens.border, width: selected ? 2 : 1),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Tokens.space3, vertical: Tokens.space3),
            child: Row(children: [
              Icon(icon, color: enabled ? (selected ? context.accent : Tokens.text) : Tokens.textMuted),
              const SizedBox(width: Tokens.space3),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: enabled ? Tokens.text : Tokens.textMuted)),
                  if (subtitle != null && subtitle!.isNotEmpty)
                    Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Tokens.textMuted, fontSize: 13)),
                ]),
              ),
              if (selected) Icon(LucideIcons.circleCheck, color: context.accent, size: 22),
            ]),
          ),
        ),
      ),
    );
  }
}
