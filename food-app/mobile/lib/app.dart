import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'auth/auth_api.dart';
import 'auth/biometrics.dart';
import 'auth/session_store.dart';
import 'core/api.dart';
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

  @override
  void initState() {
    super.initState();
    _api.init();
  }

  @override
  void dispose() {
    _language.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: _language,
      builder: (context, lang, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          // The whole layout flips to right-to-left for Arabic: Material's widgets mirror themselves.
          locale: Locale(lang),
          supportedLocales: const [Locale('en'), Locale('ar')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: AuthGate(api: _api, auth: _auth, sessions: _sessions, biometrics: _biometrics, language: _language),
        );
      },
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
