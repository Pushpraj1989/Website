import 'package:flutter/material.dart';

import '../core/strings.dart';
import '../widgets/app_button.dart';
import 'auth_api.dart';
import 'biometrics.dart';
import 'session_store.dart';

/// Asks once, after a sign-in, whether to use Face ID next time. Saying yes sets it up there and then (a Face ID check
/// in the phone app, a passkey in the browser); saying no keeps the email code as the way in.
///
/// In a browser the passkey is made inside the "Turn on" tap, with the server's challenge fetched before the question
/// shows: Safari shows Face ID only when asked straight from a tap.
Future<void> offerFaceId(BuildContext context, Strings s, SessionStore sessions, {required BiometricGate gate, required AuthApi auth, String reason = ''}) async {
  await gate.prepare(auth, register: true);
  if (!context.mounted) return;
  Future<bool>? enrolling;
  Future<bool> enroll() async {
    try {
      return await gate.enroll(auth, reason.isEmpty ? s.faceIdTitle : reason);
    } catch (_) {
      return false;
    }
  }
  final yes = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(s.faceIdTitle),
      content: Text(s.faceIdBody),
      actions: [
        AppButton(label: s.notNow, variant: ButtonVariant.secondary, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(false)),
        AppButton(label: s.turnOn, size: ButtonSize.sm, onPressed: () {
          enrolling = enroll();
          Navigator.of(dialogContext).pop(true);
        }),
      ],
    ),
  );
  if (yes != true) return;
  final on = await (enrolling ?? enroll());
  if (on) await sessions.setFaceIdEnabled(true);
  if (context.mounted) ScaffoldMessenger.maybeOf(context)?.showSnackBar(SnackBar(content: Text(on ? s.faceIdOn : s.faceIdNotOn)));
}
