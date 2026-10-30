import 'package:flutter/material.dart';

import '../app.dart';
import '../auth/auth_api.dart';
import '../auth/biometrics.dart';
import '../auth/face_id_prompt.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import '../core/brand.dart';
import '../widgets/app_button.dart';
import '../widgets/otp_sheet.dart';
import '../widgets/top_icons.dart';
import 'main_shell.dart';

// Sign-up in three steps: name and mobile (code by SMS), then email (code by email), then done.
// A user who stopped after the mobile step comes back to the email step.
class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key, required this.auth, required this.sessions, required this.biometrics, required this.api, required this.language, this.resumeAtEmail = false});
  final AuthApi auth;
  final SessionStore sessions;
  final BiometricGate biometrics;
  final ApiClient api;
  final ValueNotifier<String> language;
  final bool resumeAtEmail;

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController(text: '+971 ');
  final _email = TextEditingController();
  late int _step = widget.resumeAtEmail ? 1 : 0; // 0 = name and phone, 1 = email, 2 = done
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _sendPhoneCode(Strings s) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final name = _name.text.trim();
      final phone = _phone.text.trim();
      final challenge = await widget.auth.signUpPhone(name: name, phone: phone);
      if (!mounted) return;
      setState(() => _busy = false);
      final ok = await showOtpSheet(
        context,
        s: s,
        sentTo: challenge.sentTo,
        purposeLabel: s.phoneCodeTitle,
        resendSeconds: challenge.resendInSeconds,
        resend: () => widget.auth.signUpPhone(name: name, phone: phone),
        verify: (code) async {
          final session = await widget.auth.verifySignUpPhone(challengeId: challenge.challengeId, code: code);
          await widget.sessions.writeToken(session.token);
          widget.api.accessToken = session.token;
        },
      );
      if (ok && mounted) setState(() => _step = 1);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// The "Verify email" button: sends the code, then opens the code sheet that slides up.
  Future<void> _verifyEmail(Strings s) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      final challenge = await widget.auth.startEmailVerification(email: email);
      if (!mounted) return;
      setState(() => _busy = false);
      final ok = await showOtpSheet(
        context,
        s: s,
        sentTo: challenge.sentTo,
        purposeLabel: s.emailCodeTitle,
        resendSeconds: challenge.resendInSeconds,
        resend: () => widget.auth.startEmailVerification(email: email),
        verify: (code) async => widget.auth.verifyEmail(challengeId: challenge.challengeId, code: code),
      );
      if (ok && mounted) await _finish(s);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finish(Strings s) async {
    setState(() => _step = 2);
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
        appBar: AppBar(actions: [LanguageIcon(language: widget.language, s: s)]),
        body: ListView(
          padding: const EdgeInsets.all(Tokens.space5),
          children: [
            _StepDots(step: _step),
            const SizedBox(height: Tokens.space4),
            if (_step == 0) ..._nameAndPhone(context, s),
            if (_step == 1) ..._emailStep(context, s),
            if (_step == 2) Center(child: Text(s.allSet, style: Theme.of(context).textTheme.titleLarge)),
            if (_error != null) ...[
              const SizedBox(height: Tokens.space3),
              Semantics(liveRegion: true, child: Text(_error!, style: TextStyle(color: Tokens.danger))),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _nameAndPhone(BuildContext context, Strings s) => [
        Text(s.signUpTitle, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: Tokens.space2),
        Text(s.signUpHint, style: TextStyle(color: Tokens.textMuted)),
        const SizedBox(height: Tokens.space5),
        TextField(controller: _name, textCapitalization: TextCapitalization.words, autofillHints: const [AutofillHints.name], decoration: InputDecoration(labelText: s.nameLabel)),
        const SizedBox(height: Tokens.space3),
        TextField(controller: _phone, keyboardType: TextInputType.phone, autofillHints: const [AutofillHints.telephoneNumber], decoration: InputDecoration(labelText: s.mobileLabel, hintText: s.mobileHint)),
        const SizedBox(height: Tokens.space5),
        AppButton(label: s.sendCode, size: ButtonSize.lg, expand: true, loading: _busy, onPressed: _busy ? null : () => _sendPhoneCode(s)),
        const SizedBox(height: Tokens.space3),
        Center(
          child: AppButton(label: s.haveAccount, variant: ButtonVariant.ghost, onPressed: () => Navigator.of(context).pop()),
        ),
      ];

  List<Widget> _emailStep(BuildContext context, Strings s) => [
        Text(s.emailTitle, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: Tokens.space2),
        Text(s.emailHint, style: TextStyle(color: Tokens.textMuted)),
        const SizedBox(height: Tokens.space5),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          autocorrect: false,
          decoration: InputDecoration(labelText: s.emailLabel),
        ),
        const SizedBox(height: Tokens.space5),
        AppButton(label: s.verifyEmail, size: ButtonSize.lg, expand: true, loading: _busy, onPressed: _busy ? null : () => _verifyEmail(s)),
      ];
}

/// Three dots for the three steps. The current one is marked by shape and colour, not colour alone.
class _StepDots extends StatelessWidget {
  const _StepDots({required this.step});
  final int step;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Step ${step + 1} of 3',
      child: Row(
        children: [
          for (var i = 0; i < 3; i++) ...[
            Expanded(
              child: Container(
                height: 6,
                decoration: BoxDecoration(
                  color: i <= step ? context.accentFg : Tokens.border,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            if (i < 2) const SizedBox(width: 6),
          ],
        ],
      ),
    );
  }
}
