import 'package:flutter/material.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';

// S40: the membership plan. Benefit tiles open a sheet from below with the details. The plan, its benefits and
// the price all come from the server; the app holds only the icon and colour sets for the keys the server sends.
class MembershipScreen extends StatefulWidget {
  const MembershipScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends State<MembershipScreen> {
  MembershipState? _state;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final state = await widget.api.membership();
      if (mounted) setState(() => _state = state);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final state = _state;
        return Scaffold(
          appBar: AppBar(title: Text(s.membership)),
          body: _failed
              ? Center(child: Text(s.genericError))
              : state == null
                  ? const Center(child: CircularProgressIndicator())
                  : _body(context, s, state),
        );
      },
    );
  }

  Widget _body(BuildContext context, Strings s, MembershipState state) {
    final plan = state.plans.isEmpty ? null : state.plans.first;
    if (plan == null) return Center(child: Text(s.comingSoon));
    final member = state.membershipPlanId == plan.id;
    return ListView(
      padding: const EdgeInsets.only(bottom: Tokens.space5),
      children: [
        _Hero(s: s, plan: plan, member: member, startedAt: state.startedAt),
        Padding(
          padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space5, Tokens.space4, Tokens.space2),
          child: Text(s.membershipBenefits, style: Theme.of(context).textTheme.titleLarge),
        ),
        SizedBox(
          height: 184,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
            itemCount: plan.benefits.length,
            separatorBuilder: (context, index) => const SizedBox(width: Tokens.space3),
            itemBuilder: (context, i) => _BenefitTile(benefit: plan.benefits[i], s: s),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space5, Tokens.space4, 0),
          child: Text(s.planOverview, style: Theme.of(context).textTheme.titleLarge),
        ),
        Padding(
          padding: const EdgeInsets.all(Tokens.space4),
          child: Container(
            padding: const EdgeInsets.all(Tokens.space4),
            decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(plan.name.of(s.lang), style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: Tokens.space1),
              Text('${formatMoney(plan.amountMinor, plan.currency)} ${s.perPeriod(plan.period)}', style: const TextStyle(color: Tokens.textMuted)),
              const SizedBox(height: Tokens.space3),
              // A plan is for sale only once its price is confirmed and the server marks it active.
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: member || !plan.active ? null : () {},
                child: Text(member ? s.membership : (plan.active ? s.upgrade : s.comingSoon)),
              ),
            ]),
          ),
        ),
      ],
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.s, required this.plan, required this.member, required this.startedAt});
  final Strings s;
  final MembershipPlan plan;
  final bool member;
  final DateTime? startedAt;

  @override
  Widget build(BuildContext context) {
    final date = startedAt == null ? '' : '${startedAt!.day.toString().padLeft(2, '0')}/${startedAt!.month.toString().padLeft(2, '0')}/${startedAt!.year}';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Tokens.space5),
      color: Tokens.brandPurple,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(plan.name.of(s.lang), style: const TextStyle(color: Tokens.onAccent, fontSize: 22, fontWeight: FontWeight.w700)),
        const SizedBox(height: Tokens.space1),
        Text(member ? s.memberSince(date) : s.notAMember, style: const TextStyle(color: Color(0xFFEDE9FE))),
      ]),
    );
  }
}

class _BenefitTile extends StatelessWidget {
  const _BenefitTile({required this.benefit, required this.s});
  final MembershipBenefit benefit;
  final Strings s;

  @override
  Widget build(BuildContext context) {
    final tone = toneFor(benefit.accent);
    return Semantics(
      button: true,
      label: benefit.title.of(s.lang),
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
        onTap: () => showBenefitSheet(context, benefit, s),
        child: Container(
          width: 168,
          padding: const EdgeInsets.all(Tokens.space4),
          decoration: BoxDecoration(color: tone.background, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(iconFor(benefit.icon), color: tone.ink, size: 32),
            const Spacer(),
            Text(benefit.title.of(s.lang), style: TextStyle(color: tone.ink, fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: Tokens.space1),
            Row(children: [
              Expanded(child: Text(benefit.summary.of(s.lang), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: tone.ink, fontSize: 13))),
              Icon(Icons.chevron_right, color: tone.ink),
            ]),
          ]),
        ),
      ),
    );
  }
}

/// Opens the benefit's details from the bottom of the screen, with a close button.
Future<void> showBenefitSheet(BuildContext context, MembershipBenefit benefit, Strings s) {
  final tone = toneFor(benefit.accent);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Tokens.bg,
    builder: (sheetContext) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          height: 160,
          color: tone.background,
          alignment: Alignment.center,
          child: CircleAvatar(
            radius: 44,
            backgroundColor: Tokens.bg,
            child: Icon(iconFor(benefit.icon), color: tone.ink, size: 40),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(Tokens.space4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(benefit.title.of(s.lang), style: Theme.of(sheetContext).textTheme.headlineSmall),
            const SizedBox(height: Tokens.space1),
            Text(benefit.summary.of(s.lang), style: const TextStyle(color: Tokens.textMuted)),
            const SizedBox(height: Tokens.space4),
            for (final point in benefit.points)
              Padding(
                padding: const EdgeInsets.only(bottom: Tokens.space3),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.check_circle, color: tone.ink, size: 22),
                  const SizedBox(width: Tokens.space3),
                  Expanded(child: Text(point.of(s.lang))),
                ]),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space4, Tokens.space4),
          child: FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: () => Navigator.of(sheetContext).pop(),
            child: Text(s.close),
          ),
        ),
      ]),
    ),
  );
}

class Tone {
  const Tone(this.background, this.ink);
  final Color background;
  final Color ink;
}

/// The colour pair for an accent key from the server. An unknown key falls back to the lilac tone.
Tone toneFor(String key) => switch (key) {
      'peach' => const Tone(Tokens.tonePeach, Tokens.tonePeachInk),
      'mint' => const Tone(Tokens.toneMint, Tokens.toneMintInk),
      _ => const Tone(Tokens.toneLilac, Tokens.toneLilacInk),
    };

/// The icon for an icon key from the server. An unknown key falls back to a star.
IconData iconFor(String key) => switch (key) {
      'delivery' => Icons.delivery_dining,
      'tag' => Icons.local_offer_outlined,
      'calendar' => Icons.calendar_month_outlined,
      _ => Icons.star_outline,
    };
