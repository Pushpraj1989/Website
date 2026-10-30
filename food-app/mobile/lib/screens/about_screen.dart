import 'package:flutter/material.dart';

import '../app.dart';
import '../core/brand.dart';
import '../core/theme.dart';
import '../core/version.dart';
import '../widgets/top_icons.dart';
import '../widgets/ui.dart';

/// The restaurant and the app: name, tagline, contact, the app version and the copyright, all from the restaurant's
/// settings and this build, so every restaurant's app shows its own.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key, required this.language});
  final ValueNotifier<String> language;

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: language,
      builder: (context, s) {
        final brand = BrandScope.of(context);
        final name = brand?.name.of(s.lang) ?? '';
        return Scaffold(
          backgroundColor: Tokens.surface,
          appBar: AppBar(backgroundColor: Tokens.bg, title: Text(s.about), actions: [LanguageIcon(language: language, s: s)]),
          body: ListView(
            padding: const EdgeInsets.all(Tokens.space4),
            children: [
              Center(
                child: Container(
                  width: 84,
                  height: 84,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: context.accent, borderRadius: BorderRadius.circular(24)),
                  alignment: Alignment.center,
                  child: brand?.logoUrl != null
                      ? Image.network(brand!.logoUrl!, fit: BoxFit.cover, semanticLabel: name)
                      : Text(name.isEmpty ? '' : name.characters.first, style: TextStyle(color: context.onAccent, fontFamily: Tokens.headingFont, fontSize: 40, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: Tokens.space3),
              Text(name, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
              if ((brand?.tagline.of(s.lang) ?? '').isNotEmpty)
                Text(brand!.tagline.of(s.lang), textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted)),
              const SizedBox(height: Tokens.space4),
              SectionCard(
                child: Column(children: [
                  _Row(label: s.versionLabel, value: '$appVersion ($appBuild)'),
                  if ((brand?.phone ?? '').isNotEmpty) _Row(label: s.phoneLabel, value: brand!.phone),
                  if ((brand?.address.of(s.lang) ?? '').isNotEmpty) _Row(label: s.addressTitle, value: brand!.address.of(s.lang)),
                ]),
              ),
              const SizedBox(height: Tokens.space3),
              Center(
                child: TextButton(
                  onPressed: () => showLicensePage(context: context, applicationName: name, applicationVersion: '$appVersion ($appBuild)', applicationLegalese: s.copyright(DateTime.now().year, name)),
                  child: Text(s.openSourceNotices),
                ),
              ),
              Text(s.copyright(DateTime.now().year, name), textAlign: TextAlign.center, style: TextStyle(color: Tokens.textMuted, fontSize: 12)),
            ],
          ),
        );
      },
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: Tokens.textMuted)),
        const SizedBox(width: Tokens.space3),
        Expanded(child: Text(value, textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w600))),
      ]),
    );
  }
}

/// Opens About from anywhere: the home footer and the More menu.
void openAbout(BuildContext context, ValueNotifier<String> language) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => AboutScreen(language: language)));

