import 'package:flutter/material.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/art.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../core/brand.dart';
import '../widgets/app_button.dart';
import 'order_screen.dart';

// Chat with the restaurant assistant. The answer is text; the cards under it are built by the app from its own
// data, so a price or a status is never something the model wrote.
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
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _controller = TextEditingController();
  final _turns = <_Turn>[];
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(Strings s) async {
    final text = _controller.text.trim();
    if (text.isEmpty || _busy) return;
    _controller.clear();
    setState(() {
      _turns.add(_Turn.customer(text));
      _busy = true;
    });
    try {
      final reply = await widget.api.ask(text, locale: s.lang);
      if (mounted) setState(() => _turns.add(_Turn.assistant(reply)));
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
        appBar: AppBar(title: Text(s.askTitle), actions: [TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language))]),
        body: Column(children: [
          Expanded(
            child: _turns.isEmpty
                ? _EmptyAsk(s: s, onPick: (text) => _controller.text = text)
                : ListView(
                    padding: const EdgeInsets.all(Tokens.space4),
                    children: [for (final t in _turns) _bubble(context, s, t)],
                  ),
          ),
          if (_busy) const LinearProgressIndicator(minHeight: 2),
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
        child: Semantics(liveRegion: true, child: Text(t.failure!, style: const TextStyle(color: Tokens.danger))),
      );
    }
    final reply = t.reply!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: Tokens.space2),
          padding: const EdgeInsets.all(Tokens.space3),
          decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
          child: Semantics(liveRegion: true, child: Text(reply.answer)),
        ),
        for (final item in reply.items)
          _Card(
            title: item.name.of(s.lang),
            subtitle: formatMoney(item.priceMinor, 'AED'),
            trailing: item.soldOut
                ? Text(s.soldOut, style: const TextStyle(color: Tokens.danger))
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
            Text(subtitle, style: const TextStyle(color: Tokens.textMuted)),
          ]),
        ),
        trailing,
      ]),
    );
  }
}

/// What to do before the first question: a picture, what the assistant can answer, and three questions to tap.
class _EmptyAsk extends StatelessWidget {
  const _EmptyAsk({required this.s, required this.onPick});
  final Strings s;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final questions = [s.askSuggestionDish, s.askSuggestionOrder, s.askSuggestionPrice];
    return ListView(
      padding: const EdgeInsets.all(Tokens.space4),
      children: [
        Center(child: Image.asset(Art.assistant, width: 180, semanticLabel: '')),
        const SizedBox(height: Tokens.space3),
        Text(s.askHint, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: Tokens.space5),
        Text(s.askSuggestionsTitle, style: const TextStyle(color: Tokens.textMuted, fontWeight: FontWeight.w600)),
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
