import 'dart:async';

import 'package:flutter/material.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';

// S10: order status. Polls every 5 seconds; the web app and this screen read the same order.
class OrderScreen extends StatefulWidget {
  const OrderScreen({super.key, required this.api, required this.language, required this.orderId});
  final ApiClient api;
  final ValueNotifier<String> language;
  final String orderId;

  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

const _steps = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

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
      if (mounted) {
        setState(() {
          _order = order;
          _error = null;
        });
      }
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
          appBar: AppBar(title: Text(s.orderStatus), actions: [TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language))]),
          body: _error != null && order == null
              ? Center(child: Text(s.genericError, style: const TextStyle(color: Tokens.danger)))
              : order == null
                  ? const Center(child: CircularProgressIndicator())
                  : _content(context, s, order),
        );
      },
    );
  }

  Widget _content(BuildContext context, Strings s, PlacedOrder order) {
    final steps = order.channel == 'pickup' ? _steps.where((x) => x != 'out_for_delivery').toList() : _steps;
    final current = steps.indexOf(order.status);
    return ListView(
      padding: const EdgeInsets.all(Tokens.space4),
      children: [
        Text(s.orderNumber(order.number), style: const TextStyle(color: Tokens.textMuted)),
        const SizedBox(height: Tokens.space1),
        Semantics(
          liveRegion: true,
          child: Text(s.statusLabel(order.status), style: Theme.of(context).textTheme.titleLarge),
        ),
        if (order.etaMinutes != null && order.status != 'awaiting_payment')
          Padding(padding: const EdgeInsets.only(top: Tokens.space1), child: Text(s.etaLabel(order.etaMinutes!), style: const TextStyle(color: Tokens.textMuted))),
        const SizedBox(height: Tokens.space4),
        for (var i = 0; i < steps.length; i++)
          Container(
            margin: const EdgeInsets.only(bottom: Tokens.space2),
            padding: const EdgeInsetsDirectional.only(start: Tokens.space3),
            decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: i == current ? Tokens.accent : Tokens.border, width: 2))),
            child: Text(
              s.statusLabel(steps[i]),
              style: TextStyle(fontWeight: i == current ? FontWeight.w600 : FontWeight.w400),
              semanticsLabel: i == current ? '${s.statusLabel(steps[i])}, current' : s.statusLabel(steps[i]),
            ),
          ),
        const SizedBox(height: Tokens.space4),
        Container(
          padding: const EdgeInsets.all(Tokens.space4),
          decoration: BoxDecoration(color: Tokens.bg, border: Border.all(color: Tokens.border), borderRadius: BorderRadius.circular(Tokens.radiusLg)),
          child: Row(children: [
            Expanded(child: Text(s.total, style: const TextStyle(fontWeight: FontWeight.w600))),
            Text(formatMoney(order.quote.totalMinor, order.quote.currency), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18)),
          ]),
        ),
      ],
    );
  }
}
