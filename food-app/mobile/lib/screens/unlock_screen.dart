import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/biometrics.dart';
import '../auth/face_sign_in.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/brand.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../widgets/app_button.dart';
import '../widgets/brand_intro.dart';
import '../widgets/top_icons.dart';
import 'main_shell.dart';
import 'sign_in_screen.dart';

/// Where a returning customer with Face ID turned on lands: the restaurant's name and colour, with Face ID asked for
/// straight away. They can also use an email code instead, or carry on as a guest.
class UnlockScreen extends StatefulWidget {
  const UnlockScreen({super.key, required this.api, required this.auth, required this.sessions, required this.biometrics, required this.language});
  final ApiClient api;
  final AuthApi auth;
  final SessionStore sessions;
  final BiometricGate biometrics;
  final ValueNotifier<String> language;

  @override
  State<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends State<UnlockScreen> {
  bool _busy = false;
  String? _note;

  /// Whether Face ID is on here, known before the tap (null until read), so a browser can ask for it at once.
  bool? _faceOn;

  Future<void> _getReady() async {
    final on = await widget.sessions.faceIdEnabled();
    if (mounted) _faceOn = on;
    if (on && widget.biometrics.signsIn) await widget.biometrics.prepare(widget.auth);
  }

  @override
  void initState() {
    super.initState();
    _getReady();
    // Face ID is asked for once, as the screen opens. A browser needs a tap first, so there it waits for the button.
    if (!widget.biometrics.signsIn) WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  void _enter() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => MainShell(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics)),
      (_) => false,
    );
  }

  Future<void> _unlock() async {
    if (_busy || !mounted) return;
    final s = Strings(widget.language.value);
    final name = BrandScope.of(context)?.name.of(s.lang) ?? '';
    setState(() {
      _busy = true;
      _note = null;
    });
    final result = await faceIdSignIn(gate: widget.biometrics, auth: widget.auth, api: widget.api, sessions: widget.sessions, reason: s.unlockReason(name), enabled: _faceOn);
    if (!mounted) return;
    if (result == FaceIdResult.signedIn) return _enter();
    setState(() {
      _busy = false;
      _note = result == FaceIdResult.unavailable ? s.faceIdNotHere : result == FaceIdResult.notSetUp ? s.faceIdSignInFirst : s.faceIdDidNotWork;
    });
  }

  void _useEmail() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => SignInScreen(auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics, api: widget.api, language: widget.language)));
  }

  Future<void> _asGuest() async {
    // The kept sign-in stays for next time; this visit is as a guest.
    widget.auth.token = null;
    widget.api.accessToken = null;
    _enter();
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        body: BrandIntro(
          brand: BrandScope.of(context),
          lang: s.lang,
          play: false,
          child: SafeArea(
            child: Column(children: [
              Align(alignment: AlignmentDirectional.topEnd, child: Padding(padding: const EdgeInsets.all(Tokens.space2), child: LanguageIcon(language: widget.language, s: s, onPhoto: true))),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.all(Tokens.space4),
                child: Container(
                  padding: const EdgeInsets.all(Tokens.space4),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.28), borderRadius: BorderRadius.circular(Tokens.radiusLg)),
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text(s.welcomeBack, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                    const SizedBox(height: Tokens.space4),
                    AppButton(label: s.unlockWithFaceId, icon: LucideIcons.scanFace, size: ButtonSize.lg, expand: true, loading: _busy, onPressed: _busy ? null : _unlock),
                    if (_note != null) ...[
                      const SizedBox(height: Tokens.space3),
                      Semantics(liveRegion: true, child: Text(_note!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white))),
                    ],
                    const SizedBox(height: Tokens.space2),
                    TextButton(onPressed: _busy ? null : _useEmail, style: TextButton.styleFrom(foregroundColor: Colors.white, minimumSize: const Size(48, 48)), child: Text(s.useEmailInstead)),
                    TextButton(onPressed: _busy ? null : _asGuest, style: TextButton.styleFrom(foregroundColor: Colors.white, minimumSize: const Size(48, 48)), child: Text(s.continueAsGuest)),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
