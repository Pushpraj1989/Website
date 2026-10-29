import 'package:flutter/material.dart';

import '../core/strings.dart';
import '../widgets/app_button.dart';
import 'session_store.dart';

/// Asks once whether to use Face ID next time. Saying no keeps the code sign-in as the only way in.
Future<void> offerFaceId(BuildContext context, Strings s, SessionStore sessions) async {
  final yes = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(s.faceIdTitle),
      content: Text(s.faceIdBody),
      actions: [
        AppButton(label: s.notNow, variant: ButtonVariant.secondary, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(false)),
        AppButton(label: s.turnOn, size: ButtonSize.sm, onPressed: () => Navigator.of(dialogContext).pop(true)),
      ],
    ),
  );
  if (yes == true) await sessions.setFaceIdEnabled(true);
}
