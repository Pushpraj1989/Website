import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/art.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../core/brand.dart';
import '../widgets/app_button.dart';
import '../widgets/top_icons.dart';
import 'order_screen.dart';

// Chat with the restaurant assistant, about this restaurant only: its menu and the customer's own orders. When a
// question is unclear it asks "an order or the menu?" with two buttons. The answer is text; the cards under it are
// built by the app from the server's checked data, so a price or a status is never something the model wrote. A
// dish the customer asks for is offered as a card to confirm: nothing goes in the cart until they tap Add to cart.
// Replies can be read aloud on the phone, one at a time or all of them.
class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _Turn {
  _Turn.customer(this.text) : reply = null, failure = null;
  _Turn.assistant(this.reply) : text = null, failure = null;
  _Turn.problem(this.failure) : text = null, reply = null;
  final String? text;
  final AssistantReply? reply;
  final String? failure;
  /// What the customer did with the dishes offered to add: null (not yet), 'added' or 'declined'.
  String? proposalOutcome;
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _controller = TextEditingController();
  final _turns = <_Turn>[];
  bool _busy = false;
  // A dish from the restaurant's own menu, for the suggested question.
  Localised? _sampleDish;
  final _tts = FlutterTts();
  // The restaurant's currency, from its menu, for the cards' prices.
  String _currency = '';

  /// A price in the restaurant's currency; the bare amount until the menu (and so the currency) has loaded.
  String _price(int minor) => _currency.isEmpty ? (minor / 100).toStringAsFixed(2) : formatMoney(minor, _currency);
  bool _readAll = false;

  @override
  void initState() {
    super.initState();
    widget.api.menu().then((menu) {
      final dish = [for (final c in menu.categories) ...c.items].where((i) => !i.soldOut).firstOrNull;
      if (!mounted) return;
      setState(() {
        _currency = menu.currency;
        if (dish != null) _sampleDish = dish.name;
      });
    }).catchError((Object _) {});
  }

  @override
  void dispose() {
    _controller.dispose();
    _speakSafely(() => _tts.stop());
    super.dispose();
  }

  /// Text to speech is a phone feature; where it is missing (a test, an old browser) the app carries on silently.
  Future<void> _speakSafely(Future<dynamic> Function() action) async {
    try {
      await action();
    } catch (_) {}
  }

  Future<void> _speak(String text, Strings s) => _speakSafely(() async {
        await _tts.stop();
        await _tts.setLanguage(s.lang == 'ar' ? 'ar' : 'en-GB');
        await _tts.speak(text);
      });

  /// The earlier turns, so a follow-up ("an order", "add two of those") makes sense to the assistant.
  List<({String role, String text})> _history() => [
        for (final t in _turns)
          if (t.text != null) (role: 'customer', text: t.text!) else if (t.reply != null) (role: 'assistant', text: t.reply!.answer),
      ].reversed.take(6).toList().reversed.toList();

  Future<void> _addProposals(_Turn turn, Strings s) async {
    try {
      for (final p in turn.reply!.proposals) {
        await widget.api.addToCart(p.itemId, qty: p.qty);
      }
      if (mounted) setState(() => turn.proposalOutcome = 'added');
    } on ApiException catch (e) {
      if (mounted) setState(() => _turns.add(_Turn.problem(e.message)));
    } catch (_) {
      if (mounted) setState(() => _turns.add(_Turn.problem(s.genericError)));
    }
  }

  Future<void> _send(Strings s, {String? preset}) async {
    final text = (preset ?? _controller.text).trim();
    if (text.isEmpty || _busy) return;
    if (preset == null) _controller.clear();
    final history = _history();
    setState(() {
      _turns.add(_Turn.customer(text));
      _busy = true;
    });
    try {
      final reply = await widget.api.ask(text, locale: s.lang, history: history);
      if (mounted) {
        setState(() {
          if (reply.currency.isNotEmpty) _currency = reply.currency;
          _turns.add(_Turn.assistant(reply));
        });
      }
      if (_readAll) _speak(reply.answer, s);
    } on ApiException catch (e) {
      final off = e.code == 'assistant_off';
      if (mounted) setState(() => _turns.add(_Turn.problem(off ? s.assistantOff : e.message)));
    } catch (_) {
      if (mounted) setState(() => _turns.add(_Turn.problem(s.genericError)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        appBar: AppBar(title: Text(s.askTitle), actions: [
          Semantics(
            toggled: _readAll,
            child: IconButton(
              tooltip: s.readAllAloud,
              isSelected: _readAll,
              onPressed: () {
                setState(() => _readAll = !_readAll);
                if (!_readAll) _speakSafely(() => _tts.stop());
              },
              icon: const Icon(LucideIcons.volumeOff),
              selectedIcon: Icon(LucideIcons.volume2, color: context.accentFg),
            ),
          ),
          LanguageIcon(language: widget.language, s: s),
        ]),
        body: Column(children: [
          Expanded(
            child: _turns.isEmpty
                ? _EmptyAsk(s: s, dish: _sampleDish?.of(s.lang), restaurant: BrandScope.of(context)?.name.of(s.lang) ?? '', onPick: (text) => _controller.text = text, onChoice: (text) => _send(s, preset: text))
                : ListView(
                    padding: const EdgeInsets.all(Tokens.space4),
                    children: [for (final t in _turns) _bubble(context, s, t)],
                  ),
          ),
          if (_busy) const LinearProgressIndicator(minHeight: 2),
          Padding(
            padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space2, Tokens.space4, 0),
            child: Text(s.assistantScope, textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted, fontSize: 12)),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space2, Tokens.space4, Tokens.space3),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    maxLength: 500,
                    minLines: 1,
                    maxLines: 3,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(s),
                    decoration: InputDecoration(hintText: s.askPlaceholder, counterText: ''),
                  ),
                ),
                const SizedBox(width: Tokens.space2),
                AppButton(label: s.send, loading: _busy, onPressed: _busy ? null : () => _send(s)),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  /// The dishes the customer asked for, to confirm. The price is the menu's, worked out by the server.
  Widget _proposals(BuildContext context, Strings s, _Turn t) {
    final reply = t.reply!;
    if (t.proposalOutcome != null) {
      final added = t.proposalOutcome == 'added';
      return Padding(
        padding: const EdgeInsets.only(bottom: Tokens.space2),
        child: Row(children: [
          Icon(added ? LucideIcons.circleCheck : LucideIcons.circleX, color: added ? Tokens.palette.successInk : Tokens.textMuted, size: 18),
          const SizedBox(width: Tokens.space2),
          Text(added ? s.addedToYourCart : s.nothingAdded, style: TextStyle(color: added ? Tokens.palette.successInk : Tokens.textMuted, fontWeight: FontWeight.w600)),
        ]),
      );
    }
    final total = reply.proposals.fold<int>(0, (sum, p) => sum + p.priceMinor * p.qty);
    final first = reply.proposals.first;
    return Container(
      margin: const EdgeInsets.only(bottom: Tokens.space2),
      padding: const EdgeInsets.all(Tokens.space3),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(Tokens.radiusMd), border: Border.all(color: context.accentFg)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(s.confirmAdd(first.qty, first.name.of(s.lang), _price(total))),
        for (final p in reply.proposals.skip(1)) Text('${p.qty} × ${p.name.of(s.lang)}', style: TextStyle(color: Tokens.textMuted)),
        const SizedBox(height: Tokens.space2),
        Row(children: [
          FilledButton(onPressed: () => _addProposals(t, s), child: Text(s.addToCartAction)),
          const SizedBox(width: Tokens.space2),
          TextButton(onPressed: () => setState(() => t.proposalOutcome = 'declined'), child: Text(s.notNow)),
        ]),
      ]),
    );
  }

  Widget _bubble(BuildContext context, Strings s, _Turn t) {
    if (t.text != null) {
      return Align(
        alignment: AlignmentDirectional.centerEnd,
        child: Container(
          margin: const EdgeInsets.only(bottom: Tokens.space2),
          padding: const EdgeInsets.all(Tokens.space3),
          decoration: BoxDecoration(color: context.accent, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
          child: Text(t.text!, style: TextStyle(color: context.onAccent)),
        ),
      );
    }
    if (t.failure != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: Tokens.space3),
        child: Semantics(liveRegion: true, child: Text(t.failure!, style: TextStyle(color: Tokens.danger))),
      );
    }
    final reply = t.reply!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: Tokens.space2),
          padding: const EdgeInsets.all(Tokens.space3),
          decoration: BoxDecoration(color: Tokens.fill, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Semantics(liveRegion: true, child: Text(reply.answer)),
            TextButton.icon(
              onPressed: () => _speak(reply.answer, s),
              style: TextButton.styleFrom(foregroundColor: context.accentFg, padding: EdgeInsets.zero, minimumSize: const Size(48, 40)),
              icon: const Icon(LucideIcons.volume2, size: 16),
              label: Text(s.readAloud),
            ),
          ]),
        ),
        if (reply.choices.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: Tokens.space2),
            child: Wrap(spacing: Tokens.space2, runSpacing: Tokens.space2, children: [
              for (final c in reply.choices)
                OutlinedButton(
                  onPressed: _busy ? null : () => _send(s, preset: c),
                  style: OutlinedButton.styleFrom(foregroundColor: context.accentFg, side: BorderSide(color: context.accentFg), minimumSize: const Size(48, 44), shape: const StadiumBorder()),
                  child: Text(c),
                ),
            ]),
          ),
        if (reply.proposals.isNotEmpty) _proposals(context, s, t),
        for (final item in reply.items)
          _Card(
            title: item.name.of(s.lang),
            subtitle: _price(item.priceMinor),
            trailing: item.soldOut
                ? Text(s.soldOut, style: TextStyle(color: Tokens.danger))
                : AppButton(label: s.add, size: ButtonSize.sm, onPressed: () => widget.api.addOne(item.id)),
          ),
        for (final order in reply.orders)
          _Card(
            title: '#${order.number} · ${s.statusLabel(order.status)}',
            subtitle: order.etaMinutes == null ? formatMoney(order.totalMinor, order.currency) : s.etaLabel(order.etaMinutes!),
            trailing: AppButton(
              label: s.orderTrackingLabel,
              variant: ButtonVariant.secondary,
              size: ButtonSize.sm,
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(api: widget.api, language: widget.language, orderId: order.id))),
            ),
          ),
        const SizedBox(height: Tokens.space3),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.subtitle, required this.trailing});
  final String title;
  final String subtitle;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: Tokens.space2),
      padding: const EdgeInsets.all(Tokens.space3),
      decoration: BoxDecoration(color: Tokens.bg, border: Border.all(color: Tokens.border), borderRadius: BorderRadius.circular(Tokens.radiusMd)),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            Text(subtitle, style: TextStyle(color: Tokens.textMuted)),
          ]),
        ),
        trailing,
      ]),
    );
  }
}

/// What to do before the first question: a picture, what the assistant can answer, and three questions to tap.
class _EmptyAsk extends StatelessWidget {
  const _EmptyAsk({required this.s, required this.onPick, required this.onChoice, required this.restaurant, this.dish});
  final Strings s;
  final String? dish;
  final String restaurant;
  final ValueChanged<String> onPick;
  /// Sends one of the two starting choices straight away.
  final ValueChanged<String> onChoice;

  @override
  Widget build(BuildContext context) {
    final questions = [s.askSuggestionDish(dish), s.askSuggestionOrder, s.askSuggestionPrice];
    return ListView(
      padding: const EdgeInsets.all(Tokens.space4),
      children: [
        Center(child: Image.asset(Art.assistant, width: 180, semanticLabel: '')),
        const SizedBox(height: Tokens.space3),
        Text(s.assistantGreeting(restaurant), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: Tokens.space3),
        Wrap(alignment: WrapAlignment.center, spacing: Tokens.space2, runSpacing: Tokens.space2, children: [
          for (final c in [s.askAboutOrder, s.askAboutMenu])
            FilledButton.tonal(
              onPressed: () => onChoice(c),
              style: FilledButton.styleFrom(minimumSize: const Size(48, 48), backgroundColor: context.accentSoft, foregroundColor: context.accentInk, shape: const StadiumBorder()),
              child: Text(c),
            ),
        ]),
        const SizedBox(height: Tokens.space5),
        Text(s.askSuggestionsTitle, style: TextStyle(color: Tokens.textMuted, fontWeight: FontWeight.w600)),
        const SizedBox(height: Tokens.space2),
        for (final question in questions)
          Padding(
            padding: const EdgeInsets.only(bottom: Tokens.space2),
            child: Semantics(
              button: true,
              label: question,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), alignment: AlignmentDirectional.centerStart, foregroundColor: Tokens.text),
                onPressed: () => onPick(question),
                child: Text(question, textAlign: TextAlign.start),
              ),
            ),
          ),
      ],
    );
  }
}
