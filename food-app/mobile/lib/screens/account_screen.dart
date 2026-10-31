import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/biometrics.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/brand.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../core/version.dart';
import '../widgets/app_button.dart';
import '../widgets/top_icons.dart';
import 'about_screen.dart';
import 'address_sheet.dart';
import 'assistant_screen.dart';
import 'membership_screen.dart';
import 'sign_in_screen.dart';
import 'vouchers_screen.dart';

// The Account tab: who the customer is (tap the name or the gear for Settings), what they have saved and their
// membership, then everything else as a plain list: membership, orders, vouchers, help, About, becoming a partner.
// The restaurant's copyright and the app version sit at the foot, out of the way of ordering.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, required this.api, required this.language, this.auth, this.sessions, this.biometrics, this.onSelectTab});
  final ApiClient api;
  final ValueNotifier<String> language;
  final AuthApi? auth;
  final SessionStore? sessions;
  final BiometricGate? biometrics;
  /// Switches to another tab of the signed-in shell (2 is Orders).
  final void Function(int index)? onSelectTab;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  Account? _account;
  int? _savedMinor;
  String? _plan;
  int? _vouchers;
  String _currency = '';
  // The restaurant's name from the menu, for when the brand has not arrived yet.
  Localised? _restaurant;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Each part loads on its own; one that fails is simply left out.
  Future<void> _load() async {
    // A guest has no account to ask about.
    if (!_guest) {
      try {
        _account = await widget.auth?.me();
      } catch (_) {}
    }
    try {
      final menu = await widget.api.menu();
      _currency = menu.currency;
      _restaurant = menu.restaurant;
      _savedMinor = await widget.api.savings();
    } catch (_) {}
    try {
      final m = await widget.api.membership();
      _plan = m.plans.where((p) => p.id == m.membershipPlanId).firstOrNull?.name.of(widget.language.value);
    } catch (_) {}
    try {
      _vouchers = (await widget.api.wallet()).available.length;
    } catch (_) {}
    if (mounted) setState(() {});
  }

  /// Browsing without an account: no sign-in on this device.
  bool get _guest => widget.auth?.token == null;

  void _push(Widget screen) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  void _signIn() => _push(SignInScreen(auth: widget.auth!, sessions: widget.sessions!, biometrics: widget.biometrics ?? defaultBiometricGate(), api: widget.api, language: widget.language));

  void _openSettings() => _push(SettingsScreen(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions, account: _account));

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final brand = BrandScope.of(context);
        final restaurant = brand?.name.of(s.lang) ?? _restaurant?.of(s.lang) ?? '';
        final name = _account?.name ?? '';
        final bottom = MediaQuery.paddingOf(context).bottom + Tokens.dockHeight + Tokens.dockGap + Tokens.space4;
        return Scaffold(
          backgroundColor: Tokens.surface,
          body: SafeArea(
            bottom: false,
            child: ListView(
              padding: EdgeInsets.only(bottom: bottom),
              children: [
                // Who the customer is. The name and the gear both open Settings.
                Padding(
                  padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space4, Tokens.space2, Tokens.space3),
                  child: Row(children: [
                    Expanded(
                      child: Semantics(
                        button: true,
                        label: name.isEmpty ? s.settings : '$name, ${s.settings}',
                        excludeSemantics: true,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(Tokens.radiusLg),
                          onTap: _guest ? null : _openSettings,
                          child: Row(children: [
                            CircleAvatar(
                              radius: 28,
                              backgroundColor: context.accentSoft,
                              child: Text(name.isEmpty ? '' : name.characters.first.toUpperCase(), style: TextStyle(color: context.accentInk, fontWeight: FontWeight.w700, fontSize: 22)),
                            ),
                            const SizedBox(width: Tokens.space3),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(name.isEmpty ? s.account : name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleLarge),
                                if (_account != null) Text(_account!.phone, style: TextStyle(color: Tokens.textMuted)),
                              ]),
                            ),
                          ]),
                        ),
                      ),
                    ),
                    if (!_guest) IconButton(onPressed: _openSettings, tooltip: s.settings, icon: const Icon(LucideIcons.settings), style: IconButton.styleFrom(minimumSize: const Size(48, 48))),
                  ]),
                ),
                // A guest is invited to sign in or make an account; ordering works without one.
                if (_guest)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space4, Tokens.space3),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text(s.guestTitle, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: Tokens.space1),
                      Text(s.signInForAccount, style: TextStyle(color: Tokens.textMuted)),
                      const SizedBox(height: Tokens.space3),
                      AppButton(label: s.signInOrCreate, expand: true, onPressed: widget.auth == null || widget.sessions == null ? null : _signIn),
                    ]),
                  ),
                // Savings and membership, in one clean card.
                if (_savedMinor != null || _plan != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
                    child: _SavingsCard(
                      saved: _savedMinor == null || _currency.isEmpty ? null : formatMoney(_savedMinor!, _currency),
                      plan: _plan,
                      s: s,
                      onPlans: () => _push(MembershipScreen(api: widget.api, language: widget.language)),
                    ),
                  ),
                const SizedBox(height: Tokens.space4),
                Container(
                  color: Tokens.bg,
                  child: Column(children: [
                    _Row(icon: LucideIcons.crown, label: s.membership, value: _plan, onTap: () => _push(MembershipScreen(api: widget.api, language: widget.language))),
                    _Row(icon: LucideIcons.receiptText, label: s.yourOrders, onTap: () => widget.onSelectTab?.call(2)),
                    if (!_guest) _Row(icon: LucideIcons.ticket, label: s.myVouchers, value: _vouchers?.toString(), onTap: () => _push(VouchersScreen(api: widget.api, language: widget.language))),
                    _Row(icon: LucideIcons.circleQuestionMark, label: s.getHelp, onTap: () => _push(AssistantScreen(api: widget.api, language: widget.language))),
                    _Row(icon: LucideIcons.info, label: s.aboutApp, onTap: () => openAbout(context, widget.language)),
                    _Row(icon: LucideIcons.handshake, label: s.becomePartner, onTap: () => _showPartner(context, s, restaurant, brand?.phone ?? '')),
                    if (!_guest) _Row(icon: LucideIcons.settings, label: s.settings, onTap: _openSettings),
                  ]),
                ),
                const SizedBox(height: Tokens.space5),
                Text(s.copyright(DateTime.now().year, restaurant), textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted, fontSize: 12)),
                Text(s.appVersionLine(appVersion, appBuild), textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted, fontSize: 12)),
              ],
            ),
          ),
        );
      },
    );
  }

  /// How to become a partner: the restaurant's own contact, from its settings.
  void _showPartner(BuildContext context, Strings s, String restaurant, String phone) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Tokens.space4, 0, Tokens.space4, Tokens.space5),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s.becomePartner, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: Tokens.space2),
            Text(s.partnerBody(restaurant)),
            const SizedBox(height: Tokens.space3),
            if (phone.isNotEmpty) SelectableText(phone, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          ]),
        ),
      ),
    );
  }
}

class _SavingsCard extends StatelessWidget {
  const _SavingsCard({required this.saved, required this.plan, required this.s, required this.onPlans});
  final String? saved;
  final String? plan;
  final Strings s;
  final VoidCallback onPlans;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(Tokens.radiusLg)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.all(Tokens.space4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (saved != null) ...[
              Text(s.lifetimeSavings, style: TextStyle(color: context.accentInk)),
              Text(saved!, style: TextStyle(color: context.accentInk, fontSize: 30, fontWeight: FontWeight.w800)),
            ],
            if (plan != null) ...[
              const SizedBox(height: Tokens.space2),
              Row(children: [
                Icon(LucideIcons.crown, size: 18, color: context.accentInk),
                const SizedBox(width: Tokens.space2),
                Expanded(child: Text(s.memberOf(plan!), style: TextStyle(color: context.accentInk, fontWeight: FontWeight.w600))),
              ]),
            ],
          ]),
        ),
        Material(
          color: context.accent,
          child: InkWell(
            onTap: onPlans,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
                child: Row(children: [
                  Expanded(child: Text(plan == null ? s.membershipBenefits : s.membership, style: TextStyle(color: context.onAccent, fontWeight: FontWeight.w700))),
                  Text(s.viewPlans, style: TextStyle(color: context.onAccent, fontWeight: FontWeight.w700, decoration: TextDecoration.underline, decorationColor: context.onAccent)),
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, required this.onTap, this.value});
  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: value == null ? label : '$label, $value',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 60),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
            child: Row(children: [
              Icon(icon, color: context.iconTint, size: 22),
              const SizedBox(width: Tokens.space4),
              Expanded(child: Text(label, style: const TextStyle(fontSize: 16))),
              if (value != null) Text(value!, style: TextStyle(color: Tokens.textMuted, fontSize: 15)),
              const SizedBox(width: Tokens.space2),
              Icon(LucideIcons.chevronRight, color: Tokens.textMuted, size: 18),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Settings: account info, saved addresses, language, log out.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.api, required this.language, this.auth, this.sessions, this.account});
  final ApiClient api;
  final ValueNotifier<String> language;
  final AuthApi? auth;
  final SessionStore? sessions;
  final Account? account;

  Future<void> _logOut(BuildContext context) async {
    try {
      await auth?.logout();
    } catch (_) {
      // Logging out must work even without a network; the session on this phone is removed either way.
    }
    await sessions?.clear();
    api.accessToken = null;
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => SignInScreen(auth: auth ?? AuthApi(baseUrl: ''), sessions: sessions ?? defaultSessionStore(), biometrics: LocalAuthGate(), api: api, language: language)),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: language,
      builder: (context, s) => Scaffold(
        backgroundColor: Tokens.surface,
        appBar: AppBar(backgroundColor: Tokens.bg, title: Text(s.settings), actions: [LanguageIcon(language: language, s: s), const SizedBox(width: Tokens.space2)]),
        body: ListView(children: [
          Container(
            color: Tokens.bg,
            child: Column(children: [
              _SettingRow(label: s.accountInfo, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => _AccountInfo(account: account, language: language)))),
              _SettingRow(label: s.savedAddresses, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => _Addresses(api: api, language: language)))),
              _SettingRow(label: s.languageSetting, value: s.currentLanguageName, onTap: () => toggleLanguage(language)),
              _SettingRow(label: s.logOut, onTap: () => _logOut(context), danger: true),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _SettingRow extends StatelessWidget {
  const _SettingRow({required this.label, required this.onTap, this.value, this.danger = false});
  final String label;
  final String? value;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: value == null ? label : '$label, $value',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 60),
          padding: const EdgeInsets.symmetric(horizontal: Tokens.space4),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Tokens.border))),
          child: Row(children: [
            Expanded(child: Text(label, style: TextStyle(fontSize: 16, color: danger ? Tokens.danger : Tokens.text))),
            if (value != null) Text(value!, style: TextStyle(color: Tokens.text, decoration: TextDecoration.underline, decorationColor: Tokens.text)),
            const SizedBox(width: Tokens.space2),
            Icon(LucideIcons.chevronRight, color: Tokens.textMuted, size: 18),
          ]),
        ),
      ),
    );
  }
}

class _AccountInfo extends StatelessWidget {
  const _AccountInfo({required this.account, required this.language});
  final Account? account;
  final ValueNotifier<String> language;

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: language,
      builder: (context, s) {
        Widget row(String label, String value) => ListTile(title: Text(label, style: TextStyle(color: Tokens.textMuted, fontSize: 13)), subtitle: Text(value, style: TextStyle(color: Tokens.text, fontSize: 16)));
        return Scaffold(
          backgroundColor: Tokens.surface,
          appBar: AppBar(backgroundColor: Tokens.bg, title: Text(s.accountInfo)),
          body: ListView(children: [
            Container(
              color: Tokens.bg,
              child: Column(children: [
                row(s.nameLabel, account?.name ?? ''),
                row(s.mobileLabel, account?.phone ?? ''),
                row(s.emailLabel, account?.email ?? s.emailNotAdded),
              ]),
            ),
          ]),
        );
      },
    );
  }
}

class _Addresses extends StatefulWidget {
  const _Addresses({required this.api, required this.language});
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<_Addresses> createState() => _AddressesState();
}

class _AddressesState extends State<_Addresses> {
  List<SavedAddress>? _addresses;
  String _currency = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await widget.api.addresses();
      final menu = await widget.api.menu();
      if (mounted) {
        setState(() {
          _addresses = list;
          _currency = menu.currency;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _addresses = const []);
    }
  }

  Future<void> _add(Strings s) async {
    await showModalBottomSheet<SavedAddress>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => AddressSheet(api: widget.api, language: widget.language, s: s, currency: _currency, isFirst: (_addresses ?? const []).isEmpty),
    );
    await _load();
  }

  Future<void> _delete(SavedAddress a) async {
    try {
      await widget.api.deleteAddress(a.id);
    } catch (_) {}
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        backgroundColor: Tokens.surface,
        appBar: AppBar(backgroundColor: Tokens.bg, title: Text(s.savedAddresses)),
        body: _addresses == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(Tokens.space4), children: [
                if (_addresses!.isEmpty) Text(s.noAddressYet, style: TextStyle(color: Tokens.textMuted)),
                for (final a in _addresses!)
                  Card(
                    child: ListTile(
                      leading: Icon(a.isDefault ? LucideIcons.house : LucideIcons.mapPin, color: context.iconTint),
                      title: Text(a.isDefault ? '${a.label} · ${s.defaultAddress}' : a.label),
                      subtitle: Text([a.line1, a.line2].where((t) => t.isNotEmpty).join(', ')),
                      trailing: IconButton(onPressed: () => _delete(a), tooltip: s.deleteAddress, icon: const Icon(LucideIcons.trash2)),
                    ),
                  ),
                const SizedBox(height: Tokens.space3),
                OutlinedButton.icon(onPressed: () => _add(s), icon: const Icon(LucideIcons.plus), label: Text(s.addNewAddress), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48))),
              ]),
      ),
    );
  }
}
