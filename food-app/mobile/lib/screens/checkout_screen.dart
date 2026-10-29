import 'package:flutter/material.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'order_screen.dart';

// S06: delivery or pickup, cash on delivery or pay on arrival. Card is shown but not offered until the Stripe
// payment sheet is wired into the app (see README).
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _channel = 'delivery';
  String _method = 'cod';
  final _address = TextEditingController();
  Quote? _quote;
  String _currency = 'AED';
  String? _error;
  bool _busy = false;
  // One key per visit: a double tap returns the same order (idempotency from the architecture).
  final _idempotencyKey = newIdempotencyKey();

  @override
  void initState() {
    super.initState();
    _loadQuote();
  }

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  Future<void> _loadQuote() async {
    try {
      final quote = await widget.api.quote(_channel);
      if (!mounted) return;
      setState(() {
        _quote = quote;
        _currency = quote.currency;
        _error = null;
        _method = _channel == 'delivery' ? 'cod' : 'pay_on_arrival';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'quote');
    }
  }

  void _setChannel(String channel) {
    setState(() {
      _channel = channel;
      _quote = null;
    });
    _loadQuote();
  }

  Future<void> _place(Strings s) async {
    if (_channel == 'delivery' && _address.text.trim().isEmpty) {
      setState(() => _error = s.addressNeeded);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final order = await widget.api.placeOrder(
        channel: _channel,
        method: _method,
        address: _channel == 'delivery' ? _address.text.trim() : null,
        idempotencyKey: _idempotencyKey,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => OrderScreen(api: widget.api, language: widget.language, orderId: order.id)));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final methods = _channel == 'delivery'
            ? [('cod', s.payCod)]
            : [('pay_on_arrival', s.payArrival)];
        return Scaffold(
          appBar: AppBar(title: Text(s.checkout), actions: [TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language))]),
          body: ListView(
            padding: const EdgeInsets.all(Tokens.space4),
            children: [
              RadioGroup<String>(
                groupValue: _channel,
                onChanged: (v) => _setChannel(v!),
                child: Column(children: [
                  RadioListTile<String>(value: 'delivery', title: Text(s.delivery)),
                  RadioListTile<String>(value: 'pickup', title: Text(s.pickup)),
                ]),
              ),
              if (_channel == 'delivery')
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: Tokens.space2),
                  child: TextField(
                    controller: _address,
                    maxLength: 300,
                    maxLines: 3,
                    keyboardType: TextInputType.streetAddress,
                    decoration: InputDecoration(labelText: s.address),
                  ),
                ),
              const SizedBox(height: Tokens.space2),
              Text(s.paymentMethod, style: Theme.of(context).textTheme.titleMedium),
              RadioGroup<String>(
                groupValue: _method,
                onChanged: (v) => setState(() => _method = v!),
                child: Column(children: [
                  for (final (value, label) in methods) RadioListTile<String>(value: value, title: Text(label)),
                ]),
              ),
              if (_quote != null) ...[
                const SizedBox(height: Tokens.space3),
                _Totals(quote: _quote!, s: s, currency: _currency),
              ],
              if (_error != null)
                Semantics(liveRegion: true, child: Padding(padding: const EdgeInsets.only(top: Tokens.space3), child: Text(_error!, style: const TextStyle(color: Tokens.danger)))),
              const SizedBox(height: Tokens.space4),
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: _busy || _quote == null ? null : () => _place(s),
                child: Text(_busy ? s.placing : s.placeOrder),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.quote, required this.s, required this.currency});
  final Quote quote;
  final Strings s;
  final String currency;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Tokens.space4),
      decoration: BoxDecoration(color: Tokens.bg, border: Border.all(color: Tokens.border), borderRadius: BorderRadius.circular(Tokens.radiusLg)),
      child: Column(children: [
        Row(children: [Expanded(child: Text(s.subtotal)), Text(formatMoney(quote.subtotalMinor, currency))]),
        if (quote.deliveryFeeMinor > 0) Row(children: [Expanded(child: Text(s.deliveryFee)), Text(formatMoney(quote.deliveryFeeMinor, currency))]),
        const Divider(),
        Row(children: [Expanded(child: Text(s.total, style: const TextStyle(fontWeight: FontWeight.w600))), Text(formatMoney(quote.totalMinor, currency), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18))]),
        const SizedBox(height: Tokens.space1),
        Align(alignment: AlignmentDirectional.centerStart, child: Text(s.includesTax(quote.taxLabel), style: const TextStyle(color: Tokens.textMuted, fontSize: 12))),
      ]),
    );
  }
}
