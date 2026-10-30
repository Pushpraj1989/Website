import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/brand.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/ui.dart';
import '../widgets/top_icons.dart';
import 'cart_screen.dart';
import 'orders_screen.dart';

// S10: order status. Polls every 5 seconds until the order is finished; the web app and this screen read the same order.
class OrderScreen extends StatefulWidget {
  const OrderScreen({super.key, required this.api, required this.language, required this.orderId});
  final ApiClient api;
  final ValueNotifier<String> language;
  final String orderId;

  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

const _deliverySteps = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
const _pickupSteps = ['placed', 'accepted', 'preparing', 'ready', 'collected'];
const _finished = {'delivered', 'collected', 'cancelled', 'rejected'};

IconData _iconFor(String status) => switch (status) {
      'placed' || 'awaiting_payment' => LucideIcons.clock,
      'accepted' => LucideIcons.check,
      'preparing' => LucideIcons.chefHat,
      'ready' => LucideIcons.packageCheck,
      'out_for_delivery' => LucideIcons.bike,
      'delivered' || 'collected' => LucideIcons.circleCheck,
      _ => LucideIcons.ban,
    };

class _OrderScreenState extends State<OrderScreen> {
  PlacedOrder? _order;
  String? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final order = await widget.api.order(widget.orderId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _error = null;
      });
      // A finished order will not change again, so stop asking.
      if (_finished.contains(order.status)) _timer?.cancel();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'network');
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final order = _order;
        return Scaffold(
          backgroundColor: Tokens.surface,
          appBar: AppBar(backgroundColor: Tokens.bg, title: Text(s.orderStatus), actions: [LanguageIcon(language: widget.language, s: s)]),
          body: _error != null && order == null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(s.genericError, style: TextStyle(color: Tokens.danger)),
                    const SizedBox(height: Tokens.space3),
                    FilledButton(onPressed: _load, child: Text(s.retry)),
                  ]),
                )
              : order == null
                  ? const Center(child: CircularProgressIndicator())
                  : _content(context, s, order),
        );
      },
    );
  }

  Widget _content(BuildContext context, Strings s, PlacedOrder order) {
    final steps = order.channel == 'pickup' ? _pickupSteps : _deliverySteps;
    final stopped = order.status == 'cancelled' || order.status == 'rejected';
    final current = steps.indexOf(order.status);
    final reachedAt = {for (final h in order.history) h.status: h.at};
    final time = MaterialLocalizations.of(context);
    String at(DateTime d) => time.formatTimeOfDay(TimeOfDay.fromDateTime(d.toLocal()));
    return ListView(
      padding: const EdgeInsets.all(Tokens.space4),
      children: [
        _StatusCard(order: order, s: s, stopped: stopped, progress: stopped || current < 0 ? 0 : (current + 1) / steps.length),
        const SizedBox(height: Tokens.space3),
        if (!stopped)
          SectionCard(
            title: s.trackOrder,
            icon: LucideIcons.clock,
            child: Column(children: [
              for (var i = 0; i < steps.length; i++)
                _StepRow(
                  label: s.statusLabel(steps[i]),
                  icon: _iconFor(steps[i]),
                  time: reachedAt[steps[i]] == null ? null : at(reachedAt[steps[i]]!),
                  done: current >= 0 && i < current,
                  current: i == current,
                  last: i == steps.length - 1,
                ),
            ]),
          ),
        const SizedBox(height: Tokens.space3),
        SectionCard(
          title: s.orderItems,
          icon: LucideIcons.utensils,
          child: Column(children: [
            for (final l in order.lines)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: Tokens.space1),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(Tokens.radiusSm)),
                    child: Text('${l.qty}×', style: TextStyle(color: context.accentInk, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: Tokens.space3),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.name.of(s.lang), style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (l.note.isNotEmpty) Text(l.note, style: TextStyle(color: Tokens.textMuted, fontSize: 13)),
                    ]),
                  ),
                  Text(formatMoney(l.unitMinor * l.qty, order.quote.currency), style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
                ]),
              ),
            const Divider(height: Tokens.space4),
            _InfoRow(icon: order.channel == 'pickup' ? LucideIcons.store : LucideIcons.mapPin, text: order.channel == 'pickup' ? s.pickup : (order.address ?? s.delivery)),
            _InfoRow(icon: order.method == 'cod' ? LucideIcons.banknote : LucideIcons.handCoins, text: order.method == 'cod' ? s.payCod : s.payArrival),
            if (order.history.isNotEmpty) _InfoRow(icon: LucideIcons.clock, text: '${s.placedAt} ${at(order.history.first.at)}'),
          ]),
        ),
        if (order.status == 'delivered' || order.status == 'collected') ...[
          const SizedBox(height: Tokens.space3),
          SectionCard(title: s.howWasIt, icon: LucideIcons.star, child: OrderRating(api: widget.api, orderId: order.id, initial: order.ratingStars, s: s)),
        ],
        const SizedBox(height: Tokens.space3),
        BillCard(quote: order.quote, s: s, currency: order.quote.currency),
        const SizedBox(height: Tokens.space4),
      ],
    );
  }
}

/// The big card at the top: the stage the order is at, in the brand colour, with how long is left.
class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.order, required this.s, required this.stopped, required this.progress});
  final PlacedOrder order;
  final Strings s;
  final bool stopped;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final bg = stopped ? Tokens.dangerFill : context.accent;
    return Container(
      padding: const EdgeInsets.all(Tokens.space4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [bg, Color.lerp(bg, Colors.black, 0.25)!]),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), shape: BoxShape.circle),
            child: Icon(_iconFor(order.status), color: Colors.white, size: 28),
          ),
          const SizedBox(width: Tokens.space3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.orderNumber(order.number), style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13)),
              Semantics(
                liveRegion: true,
                child: Text(s.statusLabel(order.status), style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
              ),
            ]),
          ),
        ]),
        const SizedBox(height: Tokens.space3),
        if (stopped)
          Text(s.orderStopped, style: const TextStyle(color: Colors.white))
        else ...[
          if (order.etaMinutes != null && order.status != 'awaiting_payment')
            Text(s.etaLabel(order.etaMinutes!), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          const SizedBox(height: Tokens.space2),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(value: progress, minHeight: 8, color: Colors.white, backgroundColor: Colors.white.withValues(alpha: 0.25)),
          ),
        ],
      ]),
    );
  }
}

/// One stage on the timeline: a dot (ticked when done), a line down to the next stage, the label and the time.
class _StepRow extends StatelessWidget {
  const _StepRow({required this.label, required this.icon, required this.time, required this.done, required this.current, required this.last});
  final String label;
  final IconData icon;
  final String? time;
  final bool done;
  final bool current;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final on = done || current;
    final colour = on ? context.accentFg : Tokens.border;
    return Semantics(
      label: '$label${current ? ', current' : done ? ', done' : ''}${time == null ? '' : ', $time'}',
      excludeSemantics: true,
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: current ? context.accent : (done ? context.accentSoft : Tokens.fill),
                shape: BoxShape.circle,
                border: Border.all(color: colour, width: 2),
              ),
              child: Icon(done ? LucideIcons.check : icon, size: 16, color: current ? context.onAccent : (done ? context.accentInk : Tokens.textMuted)),
            ),
            if (!last) Expanded(child: Container(width: 2, color: done ? context.accentFg : Tokens.border, margin: const EdgeInsets.symmetric(vertical: 2))),
          ]),
          const SizedBox(width: Tokens.space3),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 6, bottom: last ? 0 : Tokens.space4),
              child: Row(children: [
                Expanded(child: Text(label, style: TextStyle(fontWeight: current ? FontWeight.w800 : FontWeight.w500, color: on ? Tokens.text : Tokens.textMuted))),
                if (time != null) Text(time!, style: TextStyle(color: Tokens.textMuted, fontSize: 13, fontFeatures: [const FontFeature.tabularFigures()])),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 18, color: Tokens.textMuted),
        const SizedBox(width: Tokens.space2),
        Expanded(child: Text(text, style: TextStyle(color: Tokens.textMuted))),
      ]),
    );
  }
}
