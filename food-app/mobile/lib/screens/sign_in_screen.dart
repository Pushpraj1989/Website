import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/biometrics.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/brand.dart';
import '../core/models.dart';
import '../core/strings.dart';
import '../auth/face_id_prompt.dart';
import '../auth/face_sign_in.dart';
import '../core/theme.dart';
import '../widgets/app_button.dart';
import '../widgets/brand_intro.dart';
import '../widgets/otp_sheet.dart';
import '../widgets/top_icons.dart';
import 'main_shell.dart';
import 'sign_up_screen.dart';

// The first screen for someone not signed in: sign in by email and a code sent to it, sign in with Face ID once it is
// turned on, create an account, or carry on as a guest (ordering needs no account).
// The email field reads left to right in both languages, like the address itself.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key, required this.auth, required this.sessions, required this.biometrics, required this.api, required this.language});
  final AuthApi auth;
  final SessionStore sessions;
  final BiometricGate biometrics;
  final ApiClient api;
  final ValueNotifier<String> language;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController();
  String? _error;
  /// A note that is not an error, such as "sign in first, then turn on Face ID".
  String? _note;
  bool _busy = false;

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
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _continue(Strings s) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      final challenge = await widget.auth.signInEmail(email: email);
      if (!mounted) return;
      setState(() => _busy = false);
      final ok = await showOtpSheet(
        context,
        s: s,
        sentTo: challenge.sentTo,
        purposeLabel: s.emailCodeTitle,
        resendSeconds: challenge.resendInSeconds,
        resend: () => widget.auth.signInEmail(email: email),
        verify: (code) async {
          final session = await widget.auth.verifySignInEmail(challengeId: challenge.challengeId, code: code);
          await widget.sessions.writeToken(session.token);
          widget.api.accessToken = session.token;
        },
      );
      if (ok && mounted) await _enterApp(s);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _enterApp(Strings s, {bool offer = true}) async {
    await GuestMode.set(false);
    // Offer Face ID once, after the first sign-in on a device that has it.
    if (offer && await widget.biometrics.faceIdAvailable() && !await widget.sessions.faceIdEnabled() && mounted) {
      await offerFaceId(context, s, widget.sessions, gate: widget.biometrics, auth: widget.auth);
    }
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => MainShell(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics)),
      (_) => false,
    );
  }

  /// Face ID works once it was turned on after an email sign-in here; before that the customer is told to sign in first.
  Future<void> _faceId(Strings s) async {
    setState(() {
      _busy = true;
      _error = null;
      _note = null;
    });
    final result = await faceIdSignIn(gate: widget.biometrics, auth: widget.auth, api: widget.api, sessions: widget.sessions, reason: s.signInWithFaceId, enabled: _faceOn);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _note = switch (result) {
        FaceIdResult.notSetUp => s.faceIdSignInFirst,
        FaceIdResult.unavailable => s.faceIdNotHere,
        FaceIdResult.failed => s.faceIdDidNotWork,
        FaceIdResult.signedIn => null,
      };
    });
    if (result == FaceIdResult.signedIn) await _enterApp(s, offer: false);
  }

  /// Browsing and ordering without an account. The app remembers it and opens on the menu next time.
  Future<void> _asGuest() async {
    await GuestMode.set(true);
    widget.auth.token = null;
    widget.api.accessToken = null;
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => MainShell(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics)),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        appBar: AppBar(actions: [LanguageIcon(language: widget.language, s: s)]),
        body: ListView(
          padding: const EdgeInsets.all(Tokens.space5),
          children: [
            // The restaurant's name and colour at the top, as at the end of the opening animation.
            SizedBox(
              height: 180,
              child: ClipRRect(borderRadius: BorderRadius.circular(Tokens.radiusLg), child: BrandIntro(brand: BrandScope.of(context), lang: s.lang, play: false)),
            ),
            const SizedBox(height: Tokens.space5),
            Text(s.signInTitle, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: Tokens.space2),
            Text(s.signInHint, style: TextStyle(color: Tokens.textMuted)),
            const SizedBox(height: Tokens.space5),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textDirection: TextDirection.ltr,
              autofillHints: const [AutofillHints.email],
              autocorrect: false,
              decoration: InputDecoration(labelText: s.emailLabel),
            ),
            if (_error != null) ...[
              const SizedBox(height: Tokens.space3),
              Semantics(liveRegion: true, child: Text(_error!, style: TextStyle(color: Tokens.danger))),
              if (_error!.contains('No account')) ...[
                const SizedBox(height: Tokens.space2),
                AppButton(
                  label: s.createAccount,
                  variant: ButtonVariant.secondary,
                  expand: true,
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => SignUpScreen(auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics, api: widget.api, language: widget.language),
                  )),
                ),
              ],
            ],
            const SizedBox(height: Tokens.space5),
            AppButton(label: s.continueLabel, size: ButtonSize.lg, expand: true, loading: _busy, onPressed: _busy ? null : () => _continue(s)),
            const SizedBox(height: Tokens.space3),
            Row(children: [
              const Expanded(child: Divider()),
              Padding(padding: const EdgeInsets.symmetric(horizontal: Tokens.space3), child: Text(s.orWord, style: TextStyle(color: Tokens.textMuted))),
              const Expanded(child: Divider()),
            ]),
            const SizedBox(height: Tokens.space3),
            AppButton(label: s.signInWithFaceId, icon: LucideIcons.scanFace, variant: ButtonVariant.secondary, size: ButtonSize.lg, expand: true, onPressed: _busy ? null : () => _faceId(s)),
            if (_note != null) ...[
              const SizedBox(height: Tokens.space2),
              Semantics(
                liveRegion: true,
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(LucideIcons.info, size: 18, color: Tokens.textMuted),
                  const SizedBox(width: Tokens.space2),
                  Expanded(child: Text(_note!, style: TextStyle(color: Tokens.textMuted))),
                ]),
              ),
            ],
            const SizedBox(height: Tokens.space3),
            AppButton(label: s.continueAsGuest, icon: LucideIcons.shoppingBag, variant: ButtonVariant.secondary, size: ButtonSize.lg, expand: true, onPressed: _busy ? null : _asGuest),
            const SizedBox(height: Tokens.space4),
            Center(
              child: Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(s.newHere, style: TextStyle(color: Tokens.textMuted)),
                  AppButton(
                    label: s.createAccount,
                    variant: ButtonVariant.ghost,
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => SignUpScreen(auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics, api: widget.api, language: widget.language),
                    )),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
