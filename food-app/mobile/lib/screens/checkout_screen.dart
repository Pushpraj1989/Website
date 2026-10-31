import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'address_sheet.dart';
import 'order_screen.dart';
import 'cart_screen.dart';
import '../widgets/ui.dart';
import '../widgets/top_icons.dart';

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
  // Courier shipping (shops): the options on offer, the one chosen, and the address to ship to.
  List<ShippingRate> _rates = const [];
  String? _rateId;
  String? _shipAddressId;
  bool _loadingAddresses = true;
  Quote? _quote;
  DeliveryQuote? _delivery;
  CartOffer? _offer;
  PaymentOptions? _payments;
  String _currency = 'AED';
  String? _error;
  bool _busy = false;
  // One key per visit: a double tap returns the same order (idempotency from the architecture).
  final _idempotencyKey = newIdempotencyKey();

  @override
  void initState() {
    super.initState();
    _loadPayments();
    _loadAddresses();
    _loadRates();
  }

  Future<void> _loadRates() async {
    try {
      final rates = await widget.api.shippingRates();
      if (!mounted) return;
      setState(() {
        _rates = rates;
        _rateId ??= rates.isEmpty ? null : rates.first.id;
      });
    } catch (_) {
      // Shipping is optional: without its options, the screen offers delivery and pickup only.
    }
  }

  /// The payment methods the restaurant accepts, from its settings (the menu response), not from the screen.
  Future<void> _loadPayments() async {
    try {
      final menu = await widget.api.menu();
      if (!mounted) return;
      setState(() {
        _payments = menu.payments;
        _method = _methodsFor(_channel).firstOrNull ?? _method;
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'payments');
    }
  }

  /// Methods offered for an order type. Card needs the in-app payment step, which this app does not have yet, so it
  /// is not offered even when the restaurant accepts card.
  List<String> _methodsFor(String channel) {
    final p = _payments;
    if (p == null) return const [];
    return channel == 'pickup' ? [if (p.payOnArrival) 'pay_on_arrival'] : [if (p.cod) 'cod'];
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
        final shippable = addresses.where((a) => a.shippable).toList();
        if (!shippable.any((a) => a.id == _shipAddressId)) _shipAddressId = shippable.isEmpty ? null : shippable.first.id;
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
      final result = await widget.api.quote(
        _channel,
        addressId: _channel == 'delivery' ? _addressId : _channel == 'shipping' ? _shipAddressId : null,
        shippingRateId: _channel == 'shipping' ? _rateId : null,
      );
      if (!mounted) return;
      setState(() {
        _quote = result.quote;
        _delivery = result.delivery;
        _offer = result.offer;
        _currency = result.quote.currency;
        _error = null;
        _method = _methodsFor(_channel).firstOrNull ?? _method;
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
      builder: (_) => AddressSheet(api: widget.api, language: widget.language, s: s, currency: _currency, isFirst: _addresses.isEmpty),
    );
    if (saved == null || !mounted) return;
    setState(() => _addressId = saved.id);
    await _loadAddresses();
  }

  /// Takes the code off the cart when it does not apply to this order, then prices the order again.
  Future<void> _removeCode(Strings s) async {
    try {
      await widget.api.removeCartCode();
      await _loadQuote();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = s.genericError);
    }
  }

  bool get _codeBlocked => _offer != null && !_offer!.applied;

  bool get _deliveryBlocked =>
      (_channel == 'delivery' && (_addressId == null || (_delivery != null && !_delivery!.deliverable))) ||
      (_channel == 'shipping' && (_shipAddressId == null || _rateId == null));

  /// A shipping address: street, city and country, saved to the customer's addresses.
  Future<void> _addShippingAddress(Strings s) async {
    final line1 = TextEditingController(), line2 = TextEditingController(), city = TextEditingController(), country = TextEditingController();
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => Padding(
        padding: EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space4, MediaQuery.viewInsetsOf(sheet).bottom + Tokens.space4),
        child: _ShippingAddressForm(s: s, line1: line1, line2: line2, city: city, country: country, onSave: () async {
          await widget.api.saveAddress({'forShipping': true, 'label': 'Home', 'line1': line1.text, 'line2': line2.text, 'city': city.text, 'country': country.text});
          if (sheet.mounted) Navigator.of(sheet).pop(true);
        }),
      ),
    );
    if (saved == true && mounted) {
      final addresses = await widget.api.addresses();
      final added = addresses.where((a) => a.shippable).toList();
      if (mounted) setState(() => _shipAddressId = added.isEmpty ? null : added.first.id);
      await _loadAddresses();
    }
  }

  Widget _shipping(BuildContext context, Strings s) {
    final lang = s.lang;
    final shippable = _addresses.where((a) => a.shippable).toList();
    return Column(children: [
      SectionCard(
        title: s.shipTo,
        icon: LucideIcons.mapPin,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (final a in shippable) ...[
            ChoiceTile(
              icon: LucideIcons.mapPin,
              title: a.label,
              subtitle: [a.line1, a.line2, a.city, a.country].where((p) => p.isNotEmpty).join(', '),
              selected: a.id == _shipAddressId,
              onTap: () {
                setState(() => _shipAddressId = a.id);
                _loadQuote();
              },
            ),
            const SizedBox(height: Tokens.space2),
          ],
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(onPressed: () => _addShippingAddress(s), icon: const Icon(LucideIcons.plus, size: 18), label: Text(s.addShippingAddress)),
          ),
        ]),
      ),
      const SizedBox(height: Tokens.space3),
      SectionCard(
        title: s.shippingOption,
        icon: LucideIcons.truck,
        child: Column(children: [
          for (final r in _rates) ...[
            ChoiceTile(
              icon: LucideIcons.package,
              title: '${r.name.of(lang)} · ${formatMoney(r.priceMinor, _currency)}',
              subtitle: [r.eta.of(lang), if (r.freeOverMinor != null) s.freeOver(formatMoney(r.freeOverMinor!, _currency))].where((p) => p.isNotEmpty).join(' · '),
              selected: r.id == _rateId,
              onTap: () {
                setState(() => _rateId = r.id);
                _loadQuote();
              },
            ),
            if (r != _rates.last) const SizedBox(height: Tokens.space2),
          ],
        ]),
      ),
    ]);
  }

  Future<void> _place(Strings s) async {
    if ((_channel == 'delivery' && _addressId == null) || (_channel == 'shipping' && _shipAddressId == null)) {
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
        addressId: _channel == 'delivery' ? _addressId : _channel == 'shipping' ? _shipAddressId : null,
        shippingRateId: _channel == 'shipping' ? _rateId : null,
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
    return SectionCard(
      title: s.deliverTo,
      icon: LucideIcons.mapPin,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_addresses.isEmpty) Padding(padding: const EdgeInsets.only(bottom: Tokens.space2), child: Text(s.noAddressYet, style: TextStyle(color: Tokens.textMuted))),
        for (final a in _addresses) ...[
          ChoiceTile(
            icon: a.isDefault ? LucideIcons.house : LucideIcons.mapPin,
            title: a.isDefault ? '${a.label} · ${s.defaultAddress}' : a.label,
            subtitle: [a.line1, a.line2, a.zoneName?.of(lang) ?? ''].where((part) => part.isNotEmpty).join(', '),
            selected: a.id == _addressId,
            onTap: () => _selectAddress(a.id),
          ),
          const SizedBox(height: Tokens.space2),
        ],
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(onPressed: () => _addAddress(s), icon: const Icon(LucideIcons.plus, size: 18), label: Text(s.addNewAddress)),
        ),
        if (_addressId != null && _delivery == null && _quote != null)
          Text(s.feeAfterAddress, style: TextStyle(color: Tokens.textMuted)),
        if (_delivery != null && !_delivery!.deliverable)
          Semantics(liveRegion: true, child: Text(s.belowMinimum(formatMoney(_delivery!.minOrderMinor, _currency)), style: TextStyle(color: Tokens.danger))),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final methods = _methodsFor(_channel);
        final canPlace = !(_busy || _quote == null || _deliveryBlocked || _codeBlocked || methods.isEmpty);
        return Scaffold(
          backgroundColor: Tokens.surface,
          appBar: AppBar(backgroundColor: Tokens.bg, title: Text(s.checkout), actions: [LanguageIcon(language: widget.language, s: s)]),
          bottomNavigationBar: BottomActionBar(
            child: PrimaryAction(
              label: _busy ? s.placing : s.placeOrder,
              amount: _quote == null ? null : formatMoney(_quote!.totalMinor, _currency),
              busy: _busy,
              onPressed: canPlace ? () => _place(s) : null,
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.all(Tokens.space4),
            children: [
              SectionCard(
                title: s.orderType,
                icon: LucideIcons.shoppingBag,
                child: Row(children: [
                  Expanded(child: ChoiceTile(icon: LucideIcons.bike, title: s.delivery, selected: _channel == 'delivery', onTap: _methodsFor('delivery').isEmpty && _payments != null ? null : () => _setChannel('delivery'))),
                  const SizedBox(width: Tokens.space2),
                  Expanded(child: ChoiceTile(icon: LucideIcons.store, title: s.pickup, selected: _channel == 'pickup', onTap: _methodsFor('pickup').isEmpty && _payments != null ? null : () => _setChannel('pickup'))),
                  if (_rates.isNotEmpty) ...[
                    const SizedBox(width: Tokens.space2),
                    Expanded(child: ChoiceTile(icon: LucideIcons.truck, title: s.shipByCourier, selected: _channel == 'shipping', onTap: _methodsFor('shipping').isEmpty && _payments != null ? null : () => _setChannel('shipping'))),
                  ],
                ]),
              ),
              if (_channel == 'delivery') ...[
                const SizedBox(height: Tokens.space3),
                _deliveryAddresses(context, s),
              ],
              if (_channel == 'shipping') ...[
                const SizedBox(height: Tokens.space3),
                _shipping(context, s),
              ],
              const SizedBox(height: Tokens.space3),
              SectionCard(
                title: s.paymentMethod,
                icon: LucideIcons.wallet,
                child: Column(children: [
                  for (final m in methods) ...[
                    ChoiceTile(
                      icon: m == 'cod' ? LucideIcons.banknote : LucideIcons.handCoins,
                      title: m == 'cod' ? s.payCod : s.payArrival,
                      selected: _method == m,
                      onTap: () => setState(() => _method = m),
                    ),
                    if (m != methods.last) const SizedBox(height: Tokens.space2),
                  ],
                  if (_payments != null && methods.isEmpty) Text(s.noPaymentMethod, style: TextStyle(color: Tokens.danger)),
                ]),
              ),
              if (_codeBlocked) ...[
                const SizedBox(height: Tokens.space3),
                Semantics(
                  liveRegion: true,
                  child: Container(
                    padding: const EdgeInsets.all(Tokens.space3),
                    decoration: BoxDecoration(color: Tokens.palette.warnSoft, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
                    child: Row(children: [
                      Icon(LucideIcons.ticketPercent, color: Tokens.palette.warnInk),
                      const SizedBox(width: Tokens.space2),
                      Expanded(child: Text(s.codeDoesNotApply(_offer!.reason ?? ''), style: TextStyle(color: Tokens.palette.warnInk))),
                      TextButton(onPressed: () => _removeCode(s), style: TextButton.styleFrom(foregroundColor: Tokens.palette.warnInk), child: Text(s.removeCode)),
                    ]),
                  ),
                ),
              ],
              if (_quote != null) ...[
                const SizedBox(height: Tokens.space3),
                BillCard(quote: _quote!, s: s, currency: _currency),
              ],
              if (_error != null)
                Semantics(liveRegion: true, child: Padding(padding: const EdgeInsets.only(top: Tokens.space3), child: Text(_error!, style: TextStyle(color: Tokens.danger)))),
              const SizedBox(height: Tokens.space4),
            ],
          ),
        );
      },
    );
  }
}

/// The fields of a shipping address. Saving reports a problem from the server under the fields.
class _ShippingAddressForm extends StatefulWidget {
  const _ShippingAddressForm({required this.s, required this.line1, required this.line2, required this.city, required this.country, required this.onSave});
  final Strings s;
  final TextEditingController line1, line2, city, country;
  final Future<void> Function() onSave;

  @override
  State<_ShippingAddressForm> createState() => _ShippingAddressFormState();
}

class _ShippingAddressFormState extends State<_ShippingAddressForm> {
  bool _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(s.addShippingAddress, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: Tokens.space3),
      TextField(controller: widget.line1, decoration: InputDecoration(labelText: s.addressLine1), textInputAction: TextInputAction.next, autofillHints: const [AutofillHints.streetAddressLine1]),
      const SizedBox(height: Tokens.space2),
      TextField(controller: widget.line2, decoration: InputDecoration(labelText: s.addressLine2), textInputAction: TextInputAction.next),
      const SizedBox(height: Tokens.space2),
      TextField(controller: widget.city, decoration: InputDecoration(labelText: s.city), textInputAction: TextInputAction.next, autofillHints: const [AutofillHints.addressCity]),
      const SizedBox(height: Tokens.space2),
      TextField(controller: widget.country, decoration: InputDecoration(labelText: s.country), autofillHints: const [AutofillHints.countryName]),
      if (_error != null) Padding(padding: const EdgeInsets.only(top: Tokens.space2), child: Text(_error!, style: TextStyle(color: Tokens.danger))),
      const SizedBox(height: Tokens.space3),
      FilledButton(
        onPressed: _busy ? null : () async {
          setState(() { _busy = true; _error = null; });
          try {
            await widget.onSave();
          } on ApiException catch (e) {
            if (mounted) setState(() => _error = e.message);
          } finally {
            if (mounted) setState(() => _busy = false);
          }
        },
        child: Text(s.saveAddress),
      ),
    ]);
  }
}
