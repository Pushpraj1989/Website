import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/app_button.dart';

// The customer's wallet: save a voucher by its code, see what is still usable, what was used and what expired.
// Saving never uses a voucher; it is applied at checkout.
class VouchersScreen extends StatefulWidget {
  const VouchersScreen({super.key, required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<VouchersScreen> createState() => _VouchersScreenState();
}

class _VouchersScreenState extends State<VouchersScreen> {
  Wallet? _wallet;
  bool _failed = false;
  final _code = TextEditingController();
  String? _message;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final wallet = await widget.api.wallet();
      if (mounted) {
        setState(() {
          _wallet = wallet;
          _failed = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _save(Strings s) async {
    final code = _code.text.trim();
    if (code.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      await widget.api.saveVoucher(code);
      _code.clear();
      await _load();
      if (mounted) setState(() => _message = s.savedVoucher);
    } on ApiException catch (e) {
      if (mounted) setState(() => _message = e.message);
    } catch (_) {
      if (mounted) setState(() => _message = s.genericError);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove(WalletVoucher v, Strings s) async {
    try {
      await widget.api.removeVoucher(v.voucherId);
      await _load();
    } catch (_) {
      if (mounted) setState(() => _message = s.genericError);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => DefaultTabController(
        length: 3,
        child: Scaffold(
          appBar: AppBar(
            title: Text(s.myVouchers),
            bottom: TabBar(tabs: [Tab(text: s.tabAvailable), Tab(text: s.tabUsed), Tab(text: s.tabExpired)]),
          ),
          body: Column(children: [
            Padding(
              padding: const EdgeInsets.all(Tokens.space4),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _code,
                    textCapitalization: TextCapitalization.characters,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _save(s),
                    decoration: InputDecoration(labelText: s.enterVoucherCode, border: const OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: Tokens.space2),
                AppButton(label: s.saveToWallet, size: ButtonSize.md, loading: _saving, onPressed: _saving ? null : () => _save(s)),
              ]),
            ),
            if (_message != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
                child: Semantics(liveRegion: true, child: Text(_message!, style: const TextStyle(color: Tokens.textMuted))),
              ),
            Expanded(
              child: _failed
                  ? Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Text(s.genericError, style: const TextStyle(color: Tokens.danger)),
                        const SizedBox(height: Tokens.space3),
                        FilledButton(onPressed: _load, child: Text(s.retry)),
                      ]),
                    )
                  : _wallet == null
                      ? const Center(child: CircularProgressIndicator())
                      : TabBarView(children: [
                          _list(_wallet!.available, s, removable: true),
                          _list(_wallet!.used, s),
                          _list(_wallet!.expired, s),
                        ]),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _list(List<WalletVoucher> items, Strings s, {bool removable = false}) {
    if (items.isEmpty) {
      return Center(child: Padding(padding: const EdgeInsets.all(Tokens.space4), child: Text(s.noVouchersYet, textAlign: TextAlign.center, style: const TextStyle(color: Tokens.textMuted))));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(Tokens.space4),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: Tokens.space3),
      itemBuilder: (context, i) {
        final v = items[i];
        final expires = MaterialLocalizations.of(context).formatMediumDate(v.expiresAt);
        return Container(
          padding: const EdgeInsets.all(Tokens.space4),
          decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
          child: Row(children: [
            const Icon(LucideIcons.ticket, color: Tokens.accent),
            const SizedBox(width: Tokens.space3),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(v.discount, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 2),
                Text(v.campaign, style: const TextStyle(color: Tokens.textMuted)),
                const SizedBox(height: 2),
                Text(
                  [
                    if (v.minOrderMinor > 0) s.minOrder(formatMoney(v.minOrderMinor, v.currency)),
                    if (v.state == 'available') s.expiresOn(expires),
                  ].join(' · '),
                  style: const TextStyle(color: Tokens.textMuted, fontSize: 13),
                ),
              ]),
            ),
            if (removable)
              IconButton(
                tooltip: s.removeVoucher,
                onPressed: () => _remove(v, s),
                icon: const Icon(LucideIcons.x),
              ),
          ]),
        );
      },
    );
  }
}
