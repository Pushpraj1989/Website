import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/art.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/rating.dart';
import '../widgets/ui.dart';
import '../core/brand.dart';
import 'cart_screen.dart';
import 'order_screen.dart';

// The customer's past orders, newest first. Each one can be opened or put back in the cart.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<OrderHistory>? _orders;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final orders = await widget.api.orderHistory();
      if (mounted) setState(() => _orders = orders);
    } catch (_) {
      if (mounted) setState(() => _error = 'orders');
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final orders = _orders;
        return Scaffold(
          backgroundColor: Tokens.surface,
          appBar: AppBar(backgroundColor: Tokens.bg, title: Text(s.orderHistory)),
          body: _error != null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(s.genericError, style: TextStyle(color: Tokens.danger)),
                    const SizedBox(height: Tokens.space3),
                    FilledButton(onPressed: () { setState(() => _error = null); _load(); }, child: Text(s.retry)),
                  ]),
                )
              : orders == null
                  ? const Center(child: CircularProgressIndicator())
                  : orders.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(Tokens.space4),
                            child: Column(mainAxisSize: MainAxisSize.min, children: [
                              Image.asset(Art.ordersEmpty, width: 200, semanticLabel: ''),
                              const SizedBox(height: Tokens.space3),
                              Text(s.noOrdersYet, style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: Tokens.space1),
                              Text(s.ordersEmptyBody, textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted)),
                            ]),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(Tokens.space4),
                          itemCount: orders.length,
                          separatorBuilder: (context, index) => const SizedBox(height: Tokens.space3),
                          itemBuilder: (context, i) => _OrderTile(order: orders[i], api: widget.api, s: s, language: widget.language),
                        ),
        );
      },
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order, required this.api, required this.s, required this.language});
  final OrderHistory order;
  final ApiClient api;
  final Strings s;
  final ValueNotifier<String> language;

  Future<void> _reorder(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      final result = await api.reorder(order.id);
      if (result.added.isNotEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(s.reorderAdded(result.added.length))));
        navigator.push(MaterialPageRoute(builder: (_) => CartScreen(api: api, language: language)));
      }
      if (result.skipped.isNotEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(s.reorderSkipped(result.skipped.join(', ')))));
      }
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(s.genericError)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = s.lang;
    final summary = order.items.map((i) => '${i.qty} × ${i.name.of(lang)}').join(', ');
    final date = MaterialLocalizations.of(context).formatMediumDate(order.placedAt.toLocal());
    void open() => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(api: api, language: language, orderId: order.id)));
    return SectionCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(Tokens.radiusMd)),
            child: Icon(order.channel == 'pickup' ? LucideIcons.store : LucideIcons.bike, color: context.accentInk, size: 20),
          ),
          const SizedBox(width: Tokens.space3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.orderNumber(order.number), style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(date, style: TextStyle(color: Tokens.textMuted, fontSize: 13)),
            ]),
          ),
          StatusChip(status: order.status, s: s),
        ]),
        const SizedBox(height: Tokens.space3),
        Text(summary, maxLines: 2, overflow: TextOverflow.ellipsis),
        const SizedBox(height: Tokens.space2),
        Text(formatMoney(order.totalMinor, order.currency), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, fontFeatures: [FontFeature.tabularFigures()])),
        const SizedBox(height: Tokens.space3),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: open, style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)), child: Text(s.viewOrder))),
          const SizedBox(width: Tokens.space2),
          Expanded(child: FilledButton.icon(onPressed: () => _reorder(context), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)), icon: const Icon(LucideIcons.rotateCcw, size: 18), label: Text(s.orderAgain))),
        ]),
        if (order.status == 'delivered' || order.status == 'collected') ...[
          const SizedBox(height: Tokens.space2),
          OrderRating(api: api, orderId: order.id, initial: order.ratingStars, s: s),
        ],
      ]),
    );
  }
}

/// "Rate" and five stars under a finished order. A tap saves the rating at once; tapping again changes it.
class OrderRating extends StatefulWidget {
  const OrderRating({super.key, required this.api, required this.orderId, required this.initial, required this.s});
  final ApiClient api;
  final String orderId;
  final int? initial;
  final Strings s;

  @override
  State<OrderRating> createState() => _OrderRatingState();
}

class _OrderRatingState extends State<OrderRating> {
  late int? _stars = widget.initial;

  Future<void> _rate(int stars) async {
    final previous = _stars;
    setState(() => _stars = stars);
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      await widget.api.rateOrder(widget.orderId, stars);
      messenger?.showSnackBar(SnackBar(content: Text(widget.s.thanksForRating)));
    } on ApiException catch (e) {
      if (mounted) setState(() => _stars = previous);
      messenger?.showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (mounted) setState(() => _stars = previous);
      messenger?.showSnackBar(SnackBar(content: Text(widget.s.genericError)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.only(start: Tokens.space3),
      decoration: BoxDecoration(color: Tokens.fill, borderRadius: BorderRadius.circular(Tokens.radiusMd)),
      child: Row(children: [
        Expanded(child: Text(_stars == null ? widget.s.rateOrder : widget.s.thanksForRating, style: const TextStyle(fontWeight: FontWeight.w600))),
        RateStars(value: _stars, onRate: _rate, s: widget.s),
      ]),
    );
  }
}
