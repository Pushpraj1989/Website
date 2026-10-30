import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'dish_thumb.dart';
import 'ui.dart';

/// Opens a dish: its photo, description and price, a quantity and an optional note for the kitchen, then one button
/// that adds it to the cart. Returns true when the dish was added.
Future<bool?> showDishSheet(BuildContext context, {required ApiClient api, required MenuItem item, required String illustration, required String currency, required Strings s}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: false,
    backgroundColor: Tokens.bg,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    clipBehavior: Clip.antiAlias,
    builder: (_) => _DishSheet(api: api, item: item, illustration: illustration, currency: currency, s: s),
  );
}

class _DishSheet extends StatefulWidget {
  const _DishSheet({required this.api, required this.item, required this.illustration, required this.currency, required this.s});
  final ApiClient api;
  final MenuItem item;
  final String illustration;
  final String currency;
  final Strings s;

  @override
  State<_DishSheet> createState() => _DishSheetState();
}

class _DishSheetState extends State<_DishSheet> {
  int _qty = 1;
  bool _noteOpen = false;
  final _note = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.addToCart(widget.item.id, qty: _qty, note: _note.text.trim());
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = widget.s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final item = widget.item;
    final name = item.name.of(s.lang);
    final description = item.description.of(s.lang);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Flexible(
          child: SingleChildScrollView(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Stack(children: [
                AspectRatio(
                  aspectRatio: 16 / 10,
                  child: DishImage(illustration: widget.illustration, imageUrl: item.imageUrl, cacheWidth: 900),
                ),
                PositionedDirectional(
                  top: Tokens.space3,
                  end: Tokens.space3,
                  child: Material(
                    color: Tokens.bg,
                    shape: const CircleBorder(),
                    elevation: 2,
                    child: IconButton(tooltip: s.close, onPressed: () => Navigator.of(context).pop(false), icon: const Icon(LucideIcons.x)),
                  ),
                ),
              ]),
              Padding(
                padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space4, Tokens.space4, Tokens.space2),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: Tokens.space2),
                  Text(formatMoney(item.priceMinor, widget.currency), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: Tokens.space3),
                    Text(description, style: const TextStyle(color: Tokens.textMuted, fontSize: 15, height: 1.4)),
                  ],
                  const SizedBox(height: Tokens.space4),
                  const Divider(height: 1),
                  const SizedBox(height: Tokens.space3),
                  if (!_noteOpen)
                    TextButton.icon(
                      onPressed: () => setState(() => _noteOpen = true),
                      icon: const Icon(LucideIcons.notebookPen, size: 18),
                      label: Text(s.addNote),
                    )
                  else
                    TextField(
                      controller: _note,
                      autofocus: true,
                      maxLength: 200,
                      maxLines: 2,
                      minLines: 1,
                      decoration: InputDecoration(labelText: s.note, hintText: s.noteHint),
                    ),
                  if (_error != null)
                    Semantics(liveRegion: true, child: Padding(padding: const EdgeInsets.only(top: Tokens.space2), child: Text(_error!, style: const TextStyle(color: Tokens.danger)))),
                ]),
              ),
            ]),
          ),
        ),
        BottomActionBar(
          child: Row(children: [
            QtyStepper(qty: _qty, label: name, onChanged: (q) => setState(() => _qty = q)),
            const SizedBox(width: Tokens.space3),
            Expanded(
              child: PrimaryAction(
                label: s.add,
                amount: formatMoney(item.priceMinor * _qty, widget.currency),
                busy: _busy,
                onPressed: item.soldOut ? null : _add,
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}
