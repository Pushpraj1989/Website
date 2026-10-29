import 'package:flutter/material.dart';

import '../auth/auth_api.dart';
import '../auth/biometrics.dart';
import '../auth/session_store.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/app_button.dart';
import 'main_shell.dart';
import 'sign_in_screen.dart';
import 'sign_up_screen.dart';

// The first screen on every launch. Decides where the user goes: sign in, finish sign-up, or straight in.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.api, required this.auth, required this.sessions, required this.biometrics, required this.language});
  final ApiClient api;
  final AuthApi auth;
  final SessionStore sessions;
  final BiometricGate biometrics;
  final ValueNotifier<String> language;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  String? _problem;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  void _go(Widget screen) {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => screen));
  }

  Widget _signIn() => SignInScreen(auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics, api: widget.api, language: widget.language);

  Future<void> _resolve() async {
    setState(() => _problem = null);
    final String? token;
    try {
      token = await widget.sessions.readToken();
    } catch (_) {
      // Secure storage can be locked or unavailable. Say so, rather than leave the spinner running.
      return setState(() => _problem = 'We could not open your saved session. Try again.');
    }
    if (token == null) return _go(_signIn());
    widget.auth.token = token;
    widget.api.accessToken = token;
    try {
      final account = await widget.auth.me();
      if (!account.emailVerified) {
        return _go(SignUpScreen(auth: widget.auth, sessions: widget.sessions, biometrics: widget.biometrics, api: widget.api, language: widget.language, resumeAtEmail: true));
      }
      if (await widget.sessions.faceIdEnabled() && await widget.biometrics.faceIdAvailable()) {
        final unlocked = await widget.biometrics.authenticate('Unlock Sample Kitchen');
        if (!unlocked) return _go(_signIn());
      }
      return _go(MainShell(api: widget.api, language: widget.language, auth: widget.auth, sessions: widget.sessions));
    } on ApiException catch (e) {
      // The session was refused (expired or signed out elsewhere): start again from sign-in.
      if (e.code == 'unauthorised') {
        await widget.sessions.clear();
        return _go(_signIn());
      }
      setState(() => _problem = e.message);
    } catch (_) {
      setState(() => _problem = 'Check your connection and try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(Tokens.space5),
          child: _problem == null
              ? const CircularProgressIndicator()
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(_problem!, textAlign: TextAlign.center, style: const TextStyle(color: Tokens.danger)),
                  const SizedBox(height: Tokens.space3),
                  AppButton(label: 'Try again', onPressed: _resolve),
                ]),
        ),
      ),
    );
  }
}
