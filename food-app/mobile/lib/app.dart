import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'auth/auth_api.dart';
import 'auth/biometrics.dart';
import 'auth/session_store.dart';
import 'core/api.dart';
import 'core/brand.dart';
import 'core/models.dart';
import 'core/strings.dart';
import 'core/theme.dart';
import 'screens/auth_gate.dart';

class SampleKitchenApp extends StatefulWidget {
  const SampleKitchenApp({super.key, required this.apiBase, this.api, this.auth, this.sessions, this.biometrics});
  final String apiBase;
  final ApiClient? api;
  final AuthApi? auth;
  final SessionStore? sessions;
  final BiometricGate? biometrics;

  @override
  State<SampleKitchenApp> createState() => _SampleKitchenAppState();
}

class _SampleKitchenAppState extends State<SampleKitchenApp> {
  late final ApiClient _api = widget.api ?? ApiClient(baseUrl: widget.apiBase);
  late final AuthApi _auth = widget.auth ?? AuthApi(baseUrl: widget.apiBase);
  late final SessionStore _sessions = widget.sessions ?? defaultSessionStore();
  late final BiometricGate _biometrics = widget.biometrics ?? LocalAuthGate();
  final ValueNotifier<String> _language = ValueNotifier('en');
  final BrandController _brand = BrandController();

  @override
  void initState() {
    super.initState();
    _start();
  }

  /// Opens in the restaurant's last known colours, then asks the server for its current name, logo and colour.
  Future<void> _start() async {
    await _api.init();
    await _brand.restore(_api.prefs);
    try {
      final menu = await _api.menu();
      final json = menu.brandJson;
      if (json != null) await _brand.update(Brand.fromJson(json, base: MediaUrls.base), _api.prefs);
    } catch (_) {
      // Offline or the server is unavailable: the screens say so when they load; the last brand stays.
    }
  }

  @override
  void dispose() {
    _language.dispose();
    _brand.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<Brand?>(
      valueListenable: _brand,
      builder: (context, brand, _) => ValueListenableBuilder<String>(
      valueListenable: _language,
      builder: (context, lang, _) {
        return BrandScope(
          brand: brand,
          child: MaterialApp(
          // A new theme rebuilds every screen, so nothing keeps the old theme's colours.
          key: ValueKey(brand?.theme ?? AppTheme.classic),
          debugShowCheckedModeBanner: false,
          title: brand?.name.of(lang) ?? '',
          theme: buildTheme(accent: brand?.color ?? Tokens.accent, theme: brand?.theme ?? AppTheme.classic, buttonStyle: brand?.buttonStyle ?? 'light', iconStyle: brand?.iconStyle ?? 'brand'),
          // The whole layout flips to right-to-left for Arabic: Material's widgets mirror themselves.
          locale: Locale(lang),
          supportedLocales: const [Locale('en'), Locale('ar')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: AuthGate(api: _api, auth: _auth, sessions: _sessions, biometrics: _biometrics, language: _language),
          ),
        );
      },
      ),
    );
  }
}

/// Switches the app language between English and Arabic.
void toggleLanguage(ValueNotifier<String> language) => language.value = language.value == 'ar' ? 'en' : 'ar';

/// Rebuilds a screen whenever the language changes, so every sentence on it is in the current language.
class LanguageScope extends StatelessWidget {
  const LanguageScope({super.key, required this.language, required this.builder});
  final ValueNotifier<String> language;
  final Widget Function(BuildContext context, Strings s) builder;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<String>(
        valueListenable: language,
        builder: (context, lang, _) => builder(context, Strings(lang)),
      );
}
