import 'package:flutter/material.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/biometrics.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/strings.dart';
import '../auth/face_id_prompt.dart';
import '../core/theme.dart';
import '../widgets/app_button.dart';
import '../widgets/otp_sheet.dart';
import 'main_shell.dart';
import 'sign_up_screen.dart';

// Sign-in by mobile number and a code. A new user is sent to create an account.
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
  final _phone = TextEditingController(text: '+971 ');
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _continue(Strings s) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final phone = _phone.text.trim();
      final challenge = await widget.auth.signInPhone(phone: phone);
      if (!mounted) return;
      setState(() => _busy = false);
      final ok = await showOtpSheet(
        context,
        s: s,
        sentTo: challenge.sentTo,
        purposeLabel: s.phoneCodeTitle,
        resendSeconds: challenge.resendInSeconds,
        resend: () => widget.auth.signInPhone(phone: phone),
        verify: (code) async {
          final session = await widget.auth.verifySignInPhone(challengeId: challenge.challengeId, code: code);
          await widget.sessions.writeToken(session.token);
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

  Future<void> _enterApp(Strings s) async {
    // Offer Face ID once, after the first sign-in on a device that has it.
    if (await widget.biometrics.faceIdAvailable() && !await widget.sessions.faceIdEnabled() && mounted) {
      await offerFaceId(context, s, widget.sessions);
    }
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => MainShell(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions)),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) => Scaffold(
        appBar: AppBar(actions: [TextButton(onPressed: () => toggleLanguage(widget.language), child: Text(s.language))]),
        body: ListView(
          padding: const EdgeInsets.all(Tokens.space5),
          children: [
            Text(s.signInTitle, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: Tokens.space2),
            Text(s.signInHint, style: const TextStyle(color: Tokens.textMuted)),
            const SizedBox(height: Tokens.space5),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              decoration: InputDecoration(labelText: s.mobileLabel, hintText: s.mobileHint),
            ),
            if (_error != null) ...[
              const SizedBox(height: Tokens.space3),
              Semantics(liveRegion: true, child: Text(_error!, style: const TextStyle(color: Tokens.danger))),
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
            const SizedBox(height: Tokens.space4),
            Center(
              child: Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(s.newHere, style: const TextStyle(color: Tokens.textMuted)),
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
