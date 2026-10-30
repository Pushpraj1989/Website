import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../screens/cart_screen.dart';
import '../screens/order_screen.dart';
import 'dish_sheet.dart';
import 'dish_thumb.dart';
import 'ui.dart';

// The cart that slides up from the bottom. It lists everything in the cart, lets the customer change amounts,
// choose delivery or pickup, the address and how to pay, and place the order without leaving the screen they are
// on. A dish's name opens its full page; "See full cart" opens the cart screen for notes and codes. The prices,
// fees, minimums and payment methods are the server's, exactly as at checkout.

Future<void> showCartSheet(BuildContext context, {required ApiClient api, required ValueNotifier<String> language, required Strings s}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => CartSheet(api: api, language: language, s: s),
  );
}

class CartSheet extends StatefulWidget {
  const CartSheet({super.key, required this.api, required this.language, required this.s});
  final ApiClient api;
  final ValueNotifier<String> language;
  final Strings s;

  @override
  State<CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends State<CartSheet> {
  List<CartLine>? _lines;
  Menu? _menu;
  List<SavedAddress> _addresses = [];
  String? _addressId;
  String _channel = 'delivery';
  String? _method;
  QuoteResult? _quote;
  String? _error;
  bool _busy = false;
  final _idempotencyKey = newIdempotencyKey();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([widget.api.menu(), widget.api.cartLines()]);
      _menu = results[0] as Menu;
      _lines = results[1] as List<CartLine>;
      try {
        _addresses = await widget.api.addresses();
      } catch (_) {
        _addresses = [];
      }
      _addressId ??= (_addresses.where((a) => a.isDefault).firstOrNull ?? _addresses.firstOrNull)?.id;
      if (_methodsFor('delivery').isEmpty && _methodsFor('pickup').isNotEmpty) _channel = 'pickup';
      _method = _methodsFor(_channel).firstOrNull;
      await _price();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = widget.s.genericError);
    }
  }

  List<String> _methodsFor(String channel) {
    final p = _menu?.payments;
    if (p == null) return const [];
    return channel == 'delivery' ? [if (p.cod) 'cod'] : [if (p.payOnArrival) 'pay_on_arrival'];
  }

  Future<void> _price() async {
    if ((_lines ?? const []).isEmpty) {
      if (mounted) setState(() => _quote = null);
      return;
    }
    try {
      final q = await widget.api.quote(_channel, addressId: _channel == 'delivery' ? _addressId : null);
      if (mounted) {
        setState(() {
          _quote = q;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _setQty(CartLine line, int qty) async {
    final lines = [for (final l in _lines!) l.itemId == line.itemId ? l.copyWith(qty: qty) : l].where((l) => l.qty > 0).toList();
    setState(() => _lines = lines);
    try {
      await widget.api.saveCart(lines);
      await _price();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  MenuItem? _item(String id) {
    for (final c in _menu?.categories ?? const <MenuCategory>[]) {
      for (final i in c.items) {
        if (i.id == id) return i;
      }
    }
    return null;
  }

  String _illustration(String id) {
    for (final c in _menu?.categories ?? const <MenuCategory>[]) {
      if (c.items.any((i) => i.id == id)) return c.illustration;
    }
    return 'dish';
  }

  Future<void> _place() async {
    final s = widget.s;
    if (_method == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final order = await widget.api.placeOrder(channel: _channel, method: _method!, addressId: _channel == 'delivery' ? _addressId : null, idempotencyKey: _idempotencyKey);
      if (!mounted) return;
      final navigator = Navigator.of(context);
      navigator.pop();
      navigator.push(MaterialPageRoute(builder: (_) => OrderScreen(api: widget.api, language: widget.language, orderId: order.id)));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openFullCart() {
    final navigator = Navigator.of(context);
    navigator.pop();
    navigator.push(MaterialPageRoute(builder: (_) => CartScreen(api: widget.api, language: widget.language)));
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final lines = _lines;
    final currency = _menu?.currency ?? _quote?.quote.currency ?? '';
    final q = _quote;
    final delivery = q?.delivery;
    final blocked = _channel == 'delivery' && (_addressId == null || (delivery != null && !delivery.deliverable));
    final codeBlocked = q?.offer != null && !q!.offer!.applied;
    final canPlace = !_busy && q != null && !blocked && !codeBlocked && _method != null && (lines?.isNotEmpty ?? false);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.88),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space2, Tokens.space2),
          child: Row(children: [
            Expanded(child: Semantics(header: true, child: Text(s.yourCart, style: Theme.of(context).textTheme.titleLarge))),
            IconButton(onPressed: () => Navigator.of(context).pop(), tooltip: s.close, icon: const Icon(LucideIcons.x)),
          ]),
        ),
        Flexible(
          child: lines == null
              ? const Padding(padding: EdgeInsets.all(Tokens.space5), child: Center(child: CircularProgressIndicator()))
              : ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
                  children: [
                    if (lines.isEmpty) Padding(padding: const EdgeInsets.all(Tokens.space5), child: Text(s.emptyCart, textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted))),
                    for (final line in lines) _line(context, line, currency),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton.icon(onPressed: () => Navigator.of(context).pop(), icon: const Icon(LucideIcons.plus, size: 18), label: Text(s.addMore)),
                    ),
                    if (lines.isNotEmpty) ...[
                      if (q?.offer != null && q!.offer!.applied)
                        Container(
                          margin: const EdgeInsets.only(bottom: Tokens.space3),
                          padding: const EdgeInsets.all(Tokens.space3),
                          decoration: BoxDecoration(color: Tokens.palette.successSoft, borderRadius: BorderRadius.circular(Tokens.radiusMd)),
                          child: Row(children: [
                            Icon(LucideIcons.circleCheck, color: Tokens.palette.successInk, size: 20),
                            const SizedBox(width: Tokens.space2),
                            Expanded(child: Text(s.offerApplied(q.offer!.label ?? ''), style: TextStyle(color: Tokens.palette.successInk, fontWeight: FontWeight.w700))),
                          ]),
                        ),
                      if (codeBlocked) Text(s.codeDoesNotApply(q.offer!.reason ?? ''), style: TextStyle(color: Tokens.danger)),
                      Row(children: [
                        if (_methodsFor('delivery').isNotEmpty)
                          Expanded(child: ChoiceTile(icon: LucideIcons.bike, title: s.delivery, selected: _channel == 'delivery', onTap: () => _setChannel('delivery'))),
                        if (_methodsFor('delivery').isNotEmpty && _methodsFor('pickup').isNotEmpty) const SizedBox(width: Tokens.space2),
                        if (_methodsFor('pickup').isNotEmpty)
                          Expanded(child: ChoiceTile(icon: LucideIcons.store, title: s.pickup, selected: _channel == 'pickup', onTap: () => _setChannel('pickup'))),
                      ]),
                      const SizedBox(height: Tokens.space3),
                      if (_channel == 'delivery') ...[
                        if (_addresses.isEmpty)
                          OutlinedButton.icon(onPressed: _openFullCart, icon: const Icon(LucideIcons.mapPin), label: Text(s.addNewAddress))
                        else
                          for (final a in _addresses) ...[
                            ChoiceTile(
                              icon: a.isDefault ? LucideIcons.house : LucideIcons.mapPin,
                              title: s.deliverToLabel(a.label),
                              subtitle: [a.line1, a.line2].where((t) => t.isNotEmpty).join(', '),
                              selected: a.id == _addressId,
                              onTap: () {
                                setState(() => _addressId = a.id);
                                _price();
                              },
                            ),
                            const SizedBox(height: Tokens.space2),
                          ],
                        if (delivery != null && !delivery.deliverable)
                          Semantics(liveRegion: true, child: Text(s.belowMinimum(formatMoney(delivery.minOrderMinor, currency)), style: TextStyle(color: Tokens.danger))),
                      ],
                      const SizedBox(height: Tokens.space2),
                      Text(s.payWith.toUpperCase(), style: TextStyle(color: Tokens.textMuted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2)),
                      const SizedBox(height: Tokens.space2),
                      for (final m in _methodsFor(_channel)) ...[
                        ChoiceTile(icon: m == 'cod' ? LucideIcons.banknote : LucideIcons.handCoins, title: m == 'cod' ? s.payCod : s.payArrival, selected: _method == m, onTap: () => setState(() => _method = m)),
                        const SizedBox(height: Tokens.space2),
                      ],
                      if (_methodsFor(_channel).isEmpty) Text(s.noPaymentMethod, style: TextStyle(color: Tokens.danger)),
                      if (q != null) BillCard(quote: q.quote, s: s, currency: currency),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: TextButton(onPressed: _openFullCart, child: Row(mainAxisSize: MainAxisSize.min, children: [Text(s.seeFullCart), const Icon(LucideIcons.chevronRight, size: 16)])),
                      ),
                    ],
                    if (_error != null) Semantics(liveRegion: true, child: Padding(padding: const EdgeInsets.only(bottom: Tokens.space2), child: Text(_error!, style: TextStyle(color: Tokens.danger)))),
                  ],
                ),
        ),
        if (lines != null && lines.isNotEmpty)
          BottomActionBar(
            child: PrimaryAction(
              label: _busy ? s.placing : s.placeOrder,
              amount: q == null ? null : formatMoney(q.quote.totalMinor, currency),
              busy: _busy,
              onPressed: canPlace ? _place : null,
            ),
          ),
      ]),
    );
  }

  void _setChannel(String channel) {
    setState(() {
      _channel = channel;
      _method = _methodsFor(channel).firstOrNull;
      _quote = null;
    });
    _price();
  }

  Widget _line(BuildContext context, CartLine line, String currency) {
    final s = widget.s;
    final item = _item(line.itemId);
    final name = (line.name ?? item?.name)?.of(s.lang) ?? '';
    final unit = line.unitMinor ?? item?.priceMinor ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Tokens.space2),
      child: Row(children: [
        ClipRRect(borderRadius: BorderRadius.circular(14), child: DishImage(illustration: _illustration(line.itemId), imageUrl: item?.imageUrl, width: 56, height: 56, cacheWidth: 112)),
        const SizedBox(width: Tokens.space3),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            InkWell(
              onTap: item == null ? null : () => showDishSheet(context, api: widget.api, item: item, illustration: _illustration(item.id), currency: currency, s: s),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 32),
                child: Row(children: [
                  Flexible(child: Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
                  Icon(LucideIcons.chevronRight, size: 16, color: Tokens.textMuted),
                ]),
              ),
            ),
            Text(formatMoney(unit * line.qty, currency), style: TextStyle(color: Tokens.textMuted, fontSize: 13)),
            if (line.note.isNotEmpty) Text(line.note, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Tokens.textMuted, fontSize: 12)),
          ]),
        ),
        QtyStepper(qty: line.qty, compact: true, label: name, removeLabel: s.remove, onChanged: (n) => _setQty(line, n)),
      ]),
    );
  }
}
