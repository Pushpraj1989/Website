import 'package:flutter/material.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/dish_thumb.dart';
import 'cart_screen.dart';

// S02: menu by category. Add puts one of the item in the cart on the server.
class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  late Future<Menu> _menu = widget.api.menu();
  String? _message;

  Future<void> _add(MenuItem item) async {
    setState(() => _message = null);
    try {
      await widget.api.addOne(item.id);
      if (mounted) setState(() => _message = '✓ ${item.name.en}');
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = 'Something went wrong. Please try again.');
    }
  }

  void _openCart() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => CartScreen(api: widget.api, language: widget.language)));
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        return FutureBuilder<Menu>(
          future: _menu,
          builder: (context, snapshot) {
            final menu = snapshot.data;
            return Scaffold(
              appBar: AppBar(
                title: Text(menu?.restaurant.of(s.lang) ?? s.restaurantFallback),
                actions: [
                  TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language)),
                  IconButton(tooltip: s.cart, icon: const Icon(Icons.shopping_bag_outlined), onPressed: _openCart),
                ],
              ),
              body: _body(context, s, snapshot),
            );
          },
        );
      },
    );
  }

  Widget _body(BuildContext context, Strings s, AsyncSnapshot<Menu> snapshot) {
    if (snapshot.hasError) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(s.genericError, style: const TextStyle(color: Tokens.danger)),
          const SizedBox(height: Tokens.space3),
          FilledButton(onPressed: () => setState(() => _menu = widget.api.menu()), child: Text(s.retry)),
        ]),
      );
    }
    if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
    final menu = snapshot.data!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space2, Tokens.space4, Tokens.space5),
      children: [
        if (_message != null)
          Semantics(
            liveRegion: true,
            child: Padding(
              padding: const EdgeInsets.only(bottom: Tokens.space3),
              child: Text(_message!, style: const TextStyle(color: Tokens.textMuted)),
            ),
          ),
        for (final category in menu.categories) ...[
          Padding(
            padding: const EdgeInsets.only(top: Tokens.space4, bottom: Tokens.space2),
            child: Text(category.name.of(s.lang), style: Theme.of(context).textTheme.titleLarge),
          ),
          for (final item in category.items) _ItemRow(item: item, illustration: category.illustration, s: s, currency: menu.currency, onAdd: () => _add(item)),
        ],
      ],
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item, required this.illustration, required this.s, required this.currency, required this.onAdd});
  final MenuItem item;
  final String illustration;
  final Strings s;
  final String currency;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final name = item.name.of(s.lang);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Tokens.space3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          DishThumb(illustration: illustration),
          const SizedBox(width: Tokens.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (item.description.of(s.lang).isNotEmpty) ...[
                  const SizedBox(height: Tokens.space1),
                  Text(item.description.of(s.lang), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Tokens.textMuted, fontSize: 14)),
                ],
                const SizedBox(height: Tokens.space1),
                Text(formatMoney(item.priceMinor, currency), style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()], fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(width: Tokens.space2),
          if (item.soldOut)
            Chip(label: Text(s.soldOut, style: const TextStyle(color: Tokens.danger)), backgroundColor: Tokens.surface)
          else
            // A round button with the dish named for screen readers. The tap target is 48 px.
            Tooltip(
              message: s.addDish(name),
              child: IconButton.filledTonal(
                onPressed: onAdd,
                style: IconButton.styleFrom(minimumSize: const Size(48, 48), backgroundColor: Tokens.accentSoft, foregroundColor: Tokens.accent),
                icon: const Icon(Icons.add),
                tooltip: s.addDish(name),
              ),
            ),
        ],
      ),
    );
  }
}
