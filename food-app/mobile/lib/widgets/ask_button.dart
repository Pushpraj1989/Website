import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/api.dart';
import '../core/strings.dart';
import '../screens/assistant_screen.dart';
import 'top_icons.dart';

/// The assistant's entry point: an icon in the app bar of the tabs where a customer may have a question.
/// It sits in the app bar, not over the list, so it never covers a dish's Add button.
class AskButton extends StatelessWidget {
  const AskButton({super.key, required this.api, required this.language, required this.s});
  final ApiClient api;
  final ValueNotifier<String> language;
  final Strings s;

  @override
  Widget build(BuildContext context) {
    return TopIcon(
      icon: LucideIcons.sparkles,
      label: s.askTitle,
      highlight: true,
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AssistantScreen(api: api, language: language))),
    );
  }
}
