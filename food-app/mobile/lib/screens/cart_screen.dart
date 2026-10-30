import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/art.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/dish_thumb.dart';
import '../widgets/ui.dart';
import 'checkout_screen.dart';

// S05: the cart. Every change is saved on the server straight away, and the server prices it.
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
  bool _saving = false;
  // The dish photos and category pictures, from the menu, so each line shows its dish.
  final Map<String, (String illustration, String? imageUrl)> _pictures = {};

  @override
  void initState() {
    super.initState();
    _load();
    _loadPictures();
  }

  Future<void> _loadPictures() async {
    try {
      final menu = await widget.api.menu();
      if (!mounted) return;
      setState(() {
        for (final c in menu.categories) {
          for (final i in c.items) {
            _pictures[i.id] = (c.illustration, i.imageUrl);
          }
        }
      });
    } catch (_) {
      // Lines show the plain plate picture until the menu loads.
    }
  }

  Future<void> _load() async {
    try {
      _apply(await widget.api.cart());
    } catch (_) {
      if (mounted) setState(() => _error = 'load');
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
    setState(() => _saving = true);
    try {
      _apply(await widget.api.saveCart(lines.where((l) => l.qty > 0).toList()));
    } on ApiException catch (e) {
      if (mounted) setState(() => _problem = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'save');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _setQty(int index, int qty) {
    final lines = [..._lines!];
    lines[index] = lines[index].copyWith(qty: qty);
    setState(() => _lines = lines);
    _save(lines);
  }

  void _setNote(int index, String note) {
    final lines = [..._lines!];
    lines[index] = lines[index].copyWith(note: note);
    setState(() => _lines = lines);
    _save(lines);
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

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final lines = _lines;
        final canCheckout = _quote != null && _problem == null && !_saving && lines != null && lines.isNotEmpty;
        return Scaffold(
          backgroundColor: Tokens.surface,
          appBar: AppBar(
            backgroundColor: Tokens.bg,
            title: Text(s.cart),
            actions: [TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language))],
          ),
          body: _body(context, s),
          bottomNavigationBar: lines == null || lines.isEmpty
              ? null
              : BottomActionBar(
                  child: PrimaryAction(
                    label: s.checkout,
                    amount: _quote == null ? null : formatMoney(_quote!.totalMinor, _currency),
                    busy: _saving,
                    onPressed: canCheckout
                        ? () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CheckoutScreen(api: widget.api, language: widget.language)))
                        : null,
                  ),
                ),
        );
      },
    );
  }

  Widget _body(BuildContext context, Strings s) {
    if (_error != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(s.genericError, style: TextStyle(color: Tokens.danger)),
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
            Text(s.cartEmptyBody, textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted)),
            const SizedBox(height: Tokens.space4),
            FilledButton.icon(onPressed: () => Navigator.of(context).maybePop(), icon: const Icon(LucideIcons.utensils), label: Text(s.menu)),
          ]),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(Tokens.space4),
      children: [
        SectionCard(
          title: s.yourOrder,
          icon: LucideIcons.shoppingBag,
          child: Column(children: [
            for (var i = 0; i < lines.length; i++) ...[
              if (i > 0) const Divider(height: Tokens.space5),
              _LineRow(
                line: lines[i],
                picture: _pictures[lines[i].itemId],
                s: s,
                currency: _currency,
                onQty: (q) => _setQty(i, q),
                onNote: (n) => _setNote(i, n),
              ),
            ],
            const SizedBox(height: Tokens.space2),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(onPressed: () => Navigator.of(context).maybePop(), icon: const Icon(LucideIcons.plus, size: 18), label: Text(s.addMore)),
            ),
          ]),
        ),
        if (_problem != null)
          Semantics(liveRegion: true, child: Padding(padding: const EdgeInsets.only(top: Tokens.space3), child: Text(_problem!, style: TextStyle(color: Tokens.danger)))),
        const SizedBox(height: Tokens.space3),
        _OffersSection(code: _code, offer: _offer, message: _offerMessage, s: s, onApply: () => _applyCode(s), onRemove: () => _removeCode(s)),
        if (_quote != null) ...[
          const SizedBox(height: Tokens.space3),
          BillCard(quote: _quote!, s: s, currency: _currency),
        ],
        const SizedBox(height: Tokens.space4),
      ],
    );
  }
}

/// One cart line: the dish photo, name and price, a quantity stepper, and its note for the kitchen.
class _LineRow extends StatefulWidget {
  const _LineRow({required this.line, required this.picture, required this.s, required this.currency, required this.onQty, required this.onNote});
  final CartLine line;
  final (String, String?)? picture;
  final Strings s;
  final String currency;
  final ValueChanged<int> onQty;
  final ValueChanged<String> onNote;

  @override
  State<_LineRow> createState() => _LineRowState();
}

class _LineRowState extends State<_LineRow> {
  bool _editing = false;
  late final _note = TextEditingController(text: widget.line.note);

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _saveNote() {
    setState(() => _editing = false);
    if (_note.text.trim() != widget.line.note) widget.onNote(_note.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final line = widget.line;
    final name = line.name?.of(s.lang) ?? '—';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DishThumb(illustration: widget.picture?.$1 ?? 'dish', imageUrl: widget.picture?.$2, size: 60),
        const SizedBox(width: Tokens.space3),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
            if (line.unitMinor != null)
              Text(formatMoney(line.unitMinor!, widget.currency), style: TextStyle(color: Tokens.textMuted, fontSize: 13)),
            if (line.soldOut) Text(s.soldOut, style: TextStyle(color: Tokens.danger, fontWeight: FontWeight.w600)),
          ]),
        ),
        const SizedBox(width: Tokens.space2),
        if (line.unitMinor != null)
          Text(formatMoney(line.unitMinor! * line.qty, widget.currency), style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()])),
      ]),
      const SizedBox(height: Tokens.space2),
      Row(children: [
        QtyStepper(qty: line.qty, label: name, removeLabel: '${s.remove} $name', compact: true, onChanged: widget.onQty),
        const SizedBox(width: Tokens.space2),
        if (!_editing)
          Expanded(
            child: Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
              onPressed: () => setState(() => _editing = true),
              icon: Icon(line.note.isEmpty ? LucideIcons.notebookPen : LucideIcons.pencil, size: 16),
              label: Text(line.note.isEmpty ? s.addNote : line.note, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ),
          ),
      ]),
      if (_editing)
        TextField(
          controller: _note,
          autofocus: true,
          maxLength: 200,
          decoration: InputDecoration(labelText: s.note, hintText: s.noteHint, isDense: true),
          onSubmitted: (_) => _saveNote(),
          onTapOutside: (_) => _saveNote(),
        ),
    ]);
  }
}

/// The bill: subtotal, fees, discount and total. Shared with checkout.
class BillCard extends StatelessWidget {
  const BillCard({super.key, required this.quote, required this.s, required this.currency});
  final Quote quote;
  final Strings s;
  final String currency;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: s.billDetails,
      icon: LucideIcons.receipt,
      child: Column(children: [
        BillRow(label: s.subtotal, amount: formatMoney(quote.subtotalMinor, currency)),
        if (quote.deliveryFeeMinor > 0) BillRow(label: s.deliveryFee, amount: formatMoney(quote.deliveryFeeMinor, currency)),
        if (quote.serviceFeeMinor > 0) BillRow(label: s.serviceFee, amount: formatMoney(quote.serviceFeeMinor, currency)),
        if (quote.discountMinor > 0) BillRow(label: s.discount, amount: '− ${formatMoney(quote.discountMinor, currency)}', positive: true),
        const Divider(height: Tokens.space4),
        BillRow(label: s.total, amount: formatMoney(quote.totalMinor, currency), strong: true),
        Align(alignment: AlignmentDirectional.centerStart, child: Text(s.includesTax(quote.taxLabel), style: TextStyle(color: Tokens.textMuted, fontSize: 12))),
      ]),
    );
  }
}

/// The offers and vouchers card: a code field, the applied code, and the reason when it does not apply.
class _OffersSection extends StatelessWidget {
  const _OffersSection({required this.code, required this.offer, required this.message, required this.s, required this.onApply, required this.onRemove});
  final TextEditingController code;
  final CartOffer? offer;
  final String? message;
  final Strings s;
  final VoidCallback onApply;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final o = offer;
    return SectionCard(
      title: s.offersAndVouchers,
      icon: LucideIcons.ticketPercent,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (o != null && o.applied)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: Tokens.space3, vertical: Tokens.space2),
            decoration: BoxDecoration(color: Tokens.palette.successSoft, borderRadius: BorderRadius.circular(Tokens.radiusMd)),
            child: Row(children: [
              Icon(LucideIcons.circleCheck, color: Tokens.success, size: 20),
              const SizedBox(width: Tokens.space2),
              Expanded(child: Text(s.offerApplied(o.label ?? ''), style: TextStyle(fontWeight: FontWeight.w700, color: Tokens.palette.successInk))),
              TextButton(onPressed: onRemove, style: TextButton.styleFrom(foregroundColor: Tokens.palette.successInk), child: Text(s.removeCode)),
            ]),
          )
        else ...[
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
            FilledButton(onPressed: onApply, style: FilledButton.styleFrom(minimumSize: const Size(88, 48)), child: Text(s.applyCode)),
          ]),
          if (o != null && o.reason != null) ...[
            const SizedBox(height: Tokens.space2),
            Row(children: [
              Expanded(child: Semantics(liveRegion: true, child: Text(o.reason!, style: TextStyle(color: Tokens.textMuted)))),
              TextButton(onPressed: onRemove, child: Text(s.removeCode)),
            ]),
          ],
        ],
        if (message != null) ...[
          const SizedBox(height: Tokens.space2),
          Semantics(liveRegion: true, child: Text(message!, style: TextStyle(color: Tokens.danger))),
        ],
      ]),
    );
  }
}
