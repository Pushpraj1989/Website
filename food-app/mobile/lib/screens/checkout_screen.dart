import 'package:flutter/material.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'address_sheet.dart';
import 'order_screen.dart';

// S06: delivery to a saved address, or pickup; cash on delivery or pay on arrival. Card is shown but not offered
// until the Stripe payment sheet is wired into the app (see README). The fee and the minimum order come from the
// zone of the chosen address, as the server computes them.
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
  List<SavedAddress> _addresses = [];
  String? _addressId;
  bool _loadingAddresses = true;
  Quote? _quote;
  DeliveryQuote? _delivery;
  String _currency = 'AED';
  String? _error;
  bool _busy = false;
  // One key per visit: a double tap returns the same order (idempotency from the architecture).
  final _idempotencyKey = newIdempotencyKey();

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  /// Keeps the chosen address when it still exists, otherwise the default, otherwise the first saved one.
  String? _choose(List<SavedAddress> addresses) {
    if (addresses.any((a) => a.id == _addressId)) return _addressId;
    for (final a in addresses) {
      if (a.isDefault) return a.id;
    }
    return addresses.isEmpty ? null : addresses.first.id;
  }

  Future<void> _loadAddresses() async {
    try {
      final addresses = await widget.api.addresses();
      if (!mounted) return;
      setState(() {
        _addresses = addresses;
        _addressId = _choose(addresses);
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'addresses');
    } finally {
      if (mounted) setState(() => _loadingAddresses = false);
    }
    await _loadQuote();
  }

  Future<void> _loadQuote() async {
    try {
      final result = await widget.api.quote(_channel, addressId: _channel == 'delivery' ? _addressId : null);
      if (!mounted) return;
      setState(() {
        _quote = result.quote;
        _delivery = result.delivery;
        _currency = result.quote.currency;
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
      _delivery = null;
    });
    _loadQuote();
  }

  void _selectAddress(String? id) {
    if (id == null) return;
    setState(() {
      _addressId = id;
      _quote = null;
      _delivery = null;
    });
    _loadQuote();
  }

  Future<void> _addAddress(Strings s) async {
    final saved = await showModalBottomSheet<SavedAddress>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => AddressSheet(api: widget.api, s: s, currency: _currency, isFirst: _addresses.isEmpty),
    );
    if (saved == null || !mounted) return;
    setState(() => _addressId = saved.id);
    await _loadAddresses();
  }

  bool get _deliveryBlocked => _channel == 'delivery' && (_addressId == null || (_delivery != null && !_delivery!.deliverable));

  Future<void> _place(Strings s) async {
    if (_channel == 'delivery' && _addressId == null) {
      setState(() => _error = s.chooseAddress);
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
        addressId: _channel == 'delivery' ? _addressId : null,
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

  Widget _deliveryAddresses(BuildContext context, Strings s) {
    final lang = s.lang;
    if (_loadingAddresses) return const Padding(padding: EdgeInsets.all(Tokens.space3), child: Center(child: CircularProgressIndicator()));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(s.deliverTo, style: Theme.of(context).textTheme.titleMedium),
      if (_addresses.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: Tokens.space2), child: Text(s.noAddressYet)),
      RadioGroup<String>(
        groupValue: _addressId,
        onChanged: _selectAddress,
        child: Column(children: [
          for (final a in _addresses)
            RadioListTile<String>(
              value: a.id,
              title: Text(a.isDefault ? '${a.label} · ${s.defaultAddress}' : a.label),
              subtitle: Text([a.line1, a.line2, a.zoneName?.of(lang) ?? ''].where((part) => part.isNotEmpty).join(', ')),
            ),
        ]),
      ),
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton.icon(onPressed: () => _addAddress(s), icon: const Icon(Icons.add_location_alt_outlined), label: Text(s.addNewAddress)),
      ),
      if (_addressId != null && _delivery == null && _quote != null)
        Padding(padding: const EdgeInsets.only(bottom: Tokens.space2), child: Text(s.feeAfterAddress)),
      if (_delivery != null && !_delivery!.deliverable)
        Padding(
          padding: const EdgeInsets.only(bottom: Tokens.space2),
          child: Semantics(liveRegion: true, child: Text(s.belowMinimum(formatMoney(_delivery!.minOrderMinor, _currency)), style: const TextStyle(color: Tokens.danger))),
        ),
    ]);
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
              if (_channel == 'delivery') Padding(padding: const EdgeInsets.symmetric(vertical: Tokens.space2), child: _deliveryAddresses(context, s)),
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
                onPressed: _busy || _quote == null || _deliveryBlocked ? null : () => _place(s),
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
