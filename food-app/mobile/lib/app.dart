import 'dart:async';

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
import 'widgets/brand_intro.dart';
import 'screens/auth_gate.dart';

class SampleKitchenApp extends StatefulWidget {
  const SampleKitchenApp({super.key, required this.apiBase, this.api, this.auth, this.sessions, this.biometrics, this.openingTime = const Duration(milliseconds: 2600)});
  final String apiBase;
  /// Whether the opening animation plays: it stays until it has played through. Tests set it to zero to skip it.
  final Duration openingTime;
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
  late final BiometricGate _biometrics = widget.biometrics ?? defaultBiometricGate();
  final ValueNotifier<String> _language = ValueNotifier('en');
  final BrandController _brand = BrandController();
  // The opening animation in the restaurant's name and colour (widgets/brand_intro.dart), shown while the app starts,
  // long enough to play through. Once it has faded it leaves the screen.
  bool _opening = true;
  bool _openingGone = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  /// Opens in the restaurant's last known colours, then asks the server for its current name, logo and colour. The
  /// opening animation leaves once it has played through with the name (at most a few seconds on a slow device).
  Future<void> _start() async {
    await _api.init();
    await _brand.restore(_api.prefs);
    // From here the opening screen has the restaurant's colour and name; the rest loads behind it.
    if (mounted) setState(() {});
    try {
      final menu = await _api.menu();
      final json = menu.brandJson;
      if (json != null) await _brand.update(Brand.fromJson(json, base: MediaUrls.base), _api.prefs);
      _warmHome();
    } catch (_) {
      // Offline or the server is unavailable: the screens say so when they load; the last brand stays.
    }
    if (widget.openingTime > Duration.zero) {
      await _introDone.future.timeout(const Duration(seconds: 6), onTimeout: () {});
    }
    if (mounted) setState(() => _opening = false);
  }

  /// While the opening plays: loads the home's promotions and the first top picture (a video's still), so the home
  /// shows them the moment it appears instead of an empty dark box.
  void _warmHome() {
    _api.prefetchHomePromotions().then((home) {
      final first = home.hero.isEmpty ? null : home.hero.first;
      final picture = first == null ? null : first.kind == 'video' ? first.posterUrl : first.kind == 'image' ? first.url : null;
      if (picture != null && mounted) precacheImage(NetworkImage(picture), context).ignore();
    }).ignore();
  }

  // Completes when the opening animation has played through with the restaurant's name in it.
  final Completer<void> _introDone = Completer<void>();
  void _onIntroDone() {
    if ((_brand.value?.name.of(_language.value) ?? '').isNotEmpty && !_introDone.isCompleted) _introDone.complete();
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
      builder: (context, brand, _) {
        // Retail mode: the business's words (shop and products, or menu and dishes) follow its settings.
        Strings.shop = brand?.isShop ?? false;
        return ValueListenableBuilder<String>(
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
          builder: (context, child) => Stack(children: [
            child!,
            if (!_openingGone)
              IgnorePointer(
                ignoring: !_opening,
                child: AnimatedOpacity(
                  opacity: _opening ? 1 : 0,
                  duration: const Duration(milliseconds: 350),
                  onEnd: () { if (!_opening && mounted) setState(() => _openingGone = true); },
                  child: BrandSplash(brand: brand, lang: lang, animate: widget.openingTime > Duration.zero, onDone: _onIntroDone),
                ),
              ),
          ]),
          ),
        );
      },
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

/// The opening screen: the restaurant's logo, or its name, on its own colour (white words on the brand colour reach
/// 4.5:1, which the admin enforces). Before the first brand is known it is the plain default colour.
/// The opening screen: the restaurant's name and colour, animated (see BrandIntro). Tests turn [animate] off.
class BrandSplash extends StatelessWidget {
  const BrandSplash({super.key, required this.brand, required this.lang, this.animate = false, this.onDone});
  final Brand? brand;
  final String lang;
  final bool animate;
  final VoidCallback? onDone;

  @override
  Widget build(BuildContext context) => BrandIntro(brand: brand, lang: lang, play: animate, onDone: onDone);
}
