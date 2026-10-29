import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/art.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/app_button.dart';
import 'checkout_screen.dart';

// S05: cart with quantities and notes. Every change is saved on the server, which prices it.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  List<CartLine>? _lines;
  Quote? _quote;
  CartOffer? _offer;
  final _code = TextEditingController();
  String? _offerMessage;
  String? _problem;
  String? _error;
  String _currency = 'AED';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final body = await widget.api.cart();
      _apply(body);
    } catch (_) {
      setState(() => _error = 'load');
    }
  }

  void _apply(Map<String, dynamic> body) {
    if (!mounted) return;
    setState(() {
      _offer = body['offer'] == null ? null : CartOffer.fromJson(body['offer'] as Map<String, dynamic>);
      _currency = body['currency'] as String? ?? _currency;
      _lines = (body['lines'] as List<dynamic>).map((l) => CartLine.fromJson(l as Map<String, dynamic>)).toList();
      _quote = body['quote'] == null ? null : Quote.fromJson(body['quote'] as Map<String, dynamic>);
      _problem = body['problem'] as String?;
      _error = null;
    });
  }

  Future<void> _save(List<CartLine> lines) async {
    try {
      _apply(await widget.api.saveCart(lines.where((l) => l.qty > 0).toList()));
    } on ApiException catch (e) {
      setState(() => _problem = e.message);
    } catch (_) {
      setState(() => _error = 'save');
    }
  }

  Future<void> _applyCode(Strings s) async {
    final code = _code.text.trim();
    if (code.isEmpty) return;
    setState(() => _offerMessage = null);
    try {
      await widget.api.applyCartCode(code);
      _code.clear();
      _apply(await widget.api.cart());
    } on ApiException catch (e) {
      if (mounted) setState(() => _offerMessage = e.message);
    } catch (_) {
      if (mounted) setState(() => _offerMessage = s.genericError);
    }
  }

  Future<void> _removeCode(Strings s) async {
    try {
      await widget.api.removeCartCode();
      _apply(await widget.api.cart());
    } catch (_) {
      if (mounted) setState(() => _offerMessage = s.genericError);
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _change(int index, {int? qty, String? note}) {
    final lines = [..._lines!];
    lines[index] = lines[index].copyWith(qty: qty, note: note);
    setState(() => _lines = lines);
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        appBar: AppBar(
          title: Text(s.cart),
          actions: [TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language))],
        ),
        body: _body(context, s),
      ),
    );
  }

  Widget _body(BuildContext context, Strings s) {
    if (_error != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(s.genericError, style: const TextStyle(color: Tokens.danger)),
          const SizedBox(height: Tokens.space3),
          FilledButton(onPressed: _load, child: Text(s.retry)),
        ]),
      );
    }
    final lines = _lines;
    if (lines == null) return const Center(child: CircularProgressIndicator());
    if (lines.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(Tokens.space4),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Image.asset(Art.cartEmpty, width: 200, semanticLabel: ''),
            const SizedBox(height: Tokens.space3),
            Text(s.emptyCart, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: Tokens.space1),
            Text(s.cartEmptyBody, textAlign: TextAlign.center, style: const TextStyle(color: Tokens.textMuted)),
          ]),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(Tokens.space4),
      children: [
        for (var i = 0; i < lines.length; i++) _LineCard(line: lines[i], s: s, currency: _currency, onQty: (q) => _change(i, qty: q), onNote: (n) => _change(i, note: n), onSave: () => _save(_lines!), onRemove: () => _save(_lines!.where((l) => l.itemId != lines[i].itemId).toList())),
        if (_problem != null)
          Semantics(liveRegion: true, child: Padding(padding: const EdgeInsets.only(top: Tokens.space3), child: Text(_problem!, style: const TextStyle(color: Tokens.danger)))),
        const SizedBox(height: Tokens.space4),
        _OffersSection(code: _code, offer: _offer, message: _offerMessage, s: s, currency: _currency, onApply: () => _applyCode(s), onRemove: () => _removeCode(s)),
        if (_quote != null) ...[
          const SizedBox(height: Tokens.space4),
          _TotalsCard(quote: _quote!, s: s, currency: _currency),
        ],
        if (_quote != null && _problem == null) ...[
          const SizedBox(height: Tokens.space4),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: () async {
              await _save(_lines!);
              if (!context.mounted || _quote == null) return;
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => CheckoutScreen(api: widget.api, language: widget.language)));
            },
            child: Text(s.checkout),
          ),
        ],
      ],
    );
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.line, required this.s, required this.currency, required this.onQty, required this.onNote, required this.onSave, required this.onRemove});
  final CartLine line;
  final Strings s;
  final String currency;
  final ValueChanged<int> onQty;
  final ValueChanged<String> onNote;
  final VoidCallback onSave;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final name = line.name?.of(s.lang) ?? '—';
    return Container(
      margin: const EdgeInsets.only(bottom: Tokens.space3),
      padding: const EdgeInsets.all(Tokens.space3),
      decoration: BoxDecoration(color: Tokens.bg, border: Border.all(color: Tokens.border), borderRadius: BorderRadius.circular(Tokens.radiusLg)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w600))),
            if (line.unitMinor != null) Text(formatMoney(line.unitMinor! * line.qty, currency)),
          ]),
          if (line.soldOut) Padding(padding: const EdgeInsets.only(top: Tokens.space1), child: Text(s.soldOut, style: const TextStyle(color: Tokens.danger))),
          const SizedBox(height: Tokens.space2),
          Row(children: [
            IconButton(
              tooltip: '− $name',
              onPressed: line.qty > 1 ? () => onQty(line.qty - 1) : null,
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Semantics(
              label: '${s.note}: $name',
              value: '${line.qty}',
              child: Text('${line.qty}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
            IconButton(
              tooltip: '+ $name',
              onPressed: line.qty < 20 ? () => onQty(line.qty + 1) : null,
              icon: const Icon(Icons.add_circle_outline),
            ),
            const Spacer(),
            TextButton(onPressed: onRemove, child: Text(s.remove)),
          ]),
          TextFormField(
            initialValue: line.note,
            maxLength: 200,
            decoration: InputDecoration(labelText: s.note),
            onChanged: onNote,
            onEditingComplete: onSave,
          ),
        ],
      ),
    );
  }
}

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({required this.quote, required this.s, required this.currency});
  final Quote quote;
  final Strings s;
  final String currency;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Tokens.space4),
      decoration: BoxDecoration(color: Tokens.bg, border: Border.all(color: Tokens.border), borderRadius: BorderRadius.circular(Tokens.radiusLg)),
      child: Column(children: [
        _row(s.subtotal, formatMoney(quote.subtotalMinor, currency)),
        if (quote.deliveryFeeMinor > 0) _row(s.deliveryFee, formatMoney(quote.deliveryFeeMinor, currency)),
        if (quote.discountMinor > 0) _row(s.discount, '− ${formatMoney(quote.discountMinor, currency)}'),
        const Divider(),
        _row(s.total, formatMoney(quote.totalMinor, currency), bold: true),
        const SizedBox(height: Tokens.space1),
        Align(alignment: AlignmentDirectional.centerStart, child: Text(s.includesTax(quote.taxLabel), style: const TextStyle(color: Tokens.textMuted, fontSize: 12))),
      ]),
    );
  }

  Widget _row(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(label, style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.w400))),
          Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.w400, fontSize: bold ? 18 : 16)),
        ]),
      );
}

/// The offers and vouchers section: a code field, the applied code, and the reason when it does not apply.
class _OffersSection extends StatelessWidget {
  const _OffersSection({required this.code, required this.offer, required this.message, required this.s, required this.currency, required this.onApply, required this.onRemove});
  final TextEditingController code;
  final CartOffer? offer;
  final String? message;
  final Strings s;
  final String currency;
  final VoidCallback onApply;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final o = offer;
    return Container(
      padding: const EdgeInsets.all(Tokens.space4),
      decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(s.offersAndVouchers, style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: Tokens.space2),
        Row(children: [
          Expanded(
            child: TextField(
              controller: code,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => onApply(),
              decoration: InputDecoration(labelText: s.enterVoucherCode, border: const OutlineInputBorder(), isDense: true),
            ),
          ),
          const SizedBox(width: Tokens.space2),
          AppButton(label: s.applyCode, size: ButtonSize.md, onPressed: onApply),
        ]),
        if (o != null && o.applied) ...[
          const SizedBox(height: Tokens.space3),
          Row(children: [
            Icon(LucideIcons.tag, color: Tokens.success),
            const SizedBox(width: Tokens.space2),
            Expanded(child: Text(s.offerApplied(o.label ?? ''), style: const TextStyle(fontWeight: FontWeight.w600))),
            TextButton(onPressed: onRemove, child: Text(s.removeCode)),
          ]),
        ] else if (o != null && o.reason != null) ...[
          const SizedBox(height: Tokens.space3),
          Semantics(liveRegion: true, child: Text(o.reason!, style: const TextStyle(color: Tokens.textMuted))),
          TextButton(onPressed: onRemove, child: Text(s.removeCode)),
        ],
        if (message != null) ...[
          const SizedBox(height: Tokens.space2),
          Semantics(liveRegion: true, child: Text(message!, style: const TextStyle(color: Tokens.danger))),
        ],
      ]),
    );
  }
}
