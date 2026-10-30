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
    return channel == 'delivery' ? [if (p.cod) 'cod'] : [if (p.payOnArrival) 'pay_on_arrival'];
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
                ]),
              ),
              if (_channel == 'delivery') ...[
                const SizedBox(height: Tokens.space3),
                _deliveryAddresses(context, s),
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
