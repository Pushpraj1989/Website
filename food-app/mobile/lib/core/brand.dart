import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';
import 'theme.dart';

/// The restaurant's own identity, set by its staff in the admin: name, tagline, logo, colour and contact. The app has
/// no restaurant built in; it shows whichever restaurant its server belongs to.
class Brand {
  const Brand({required this.name, required this.tagline, required this.logoUrl, required this.color, required this.phone, required this.address, this.theme = AppTheme.classic});
  final Localised name;
  final Localised tagline;
  /// Absolute address of the logo, or null when the restaurant has none.
  final String? logoUrl;
  final Color color;
  /// The look the restaurant chose in the admin.
  final AppTheme theme;
  final String phone;
  final Localised address;

  static Color _parse(Object? hex) {
    final value = hex is String ? hex.replaceFirst('#', '') : '';
    final n = int.tryParse(value, radix: 16);
    return value.length == 6 && n != null ? Color(0xFF000000 | n) : Tokens.accent;
  }

  /// [base] turns the server's relative media paths into full addresses.
  factory Brand.fromJson(Map<String, dynamic> json, {String base = ''}) {
    final logo = json['logoUrl'] as String?;
    return Brand(
      name: Localised.fromJson(json['name'] as Map<String, dynamic>),
      tagline: json['tagline'] == null ? const Localised('', '') : Localised.fromJson(json['tagline'] as Map<String, dynamic>),
      logoUrl: logo == null || logo.isEmpty ? null : (logo.startsWith('http') ? logo : '$base$logo'),
      color: _parse(json['color']),
      theme: AppTheme.fromId(json['theme'] as String?),
      phone: json['phone'] as String? ?? '',
      address: json['address'] == null ? const Localised('', '') : Localised.fromJson(json['address'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() => {
        'name': {'en': name.en, 'ar': name.ar},
        'tagline': {'en': tagline.en, 'ar': tagline.ar},
        'logoUrl': logoUrl,
        'color': '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}',
        'theme': theme.id,
        'phone': phone,
        'address': {'en': address.en, 'ar': address.ar},
      };
}

/// Holds the brand for the whole app. The last brand seen is kept on the device, so the app opens in the restaurant's
/// colours straight away; it is refreshed from the server on every launch.
class BrandController extends ValueNotifier<Brand?> {
  BrandController() : super(null);
  static const _key = 'brand_v1';

  Future<void> restore(SharedPreferences? prefs) async {
    final cached = prefs?.getString(_key);
    if (cached == null || value != null) return;
    try {
      value = Brand.fromJson(jsonDecode(cached) as Map<String, dynamic>);
    } catch (_) {
      await prefs?.remove(_key);
    }
  }

  Future<void> update(Brand brand, SharedPreferences? prefs) async {
    value = brand;
    await prefs?.setString(_key, jsonEncode(brand.toJson()));
  }
}

/// The brand colours for the screen being built, worked out for the restaurant's theme (see [BrandPalette]). Use
/// these instead of fixed colours, so every restaurant's own colour shows through and stays readable.
extension BrandColors on BuildContext {
  BrandPalette get _brand => Theme.of(this).extension<BrandPalette>() ?? BrandPalette.of(Theme.of(this).colorScheme.primary, Tokens.palette);
  /// Fills: buttons, badges, the status card. White text on it reaches 4.5:1.
  Color get accent => _brand.accent;
  Color get onAccent => _brand.onAccent;
  /// Text, icons and outlines in the brand colour, on the page or on a card.
  Color get accentFg => _brand.accentFg;
  /// A tint of the brand colour, for selected chips and soft backgrounds.
  Color get accentSoft => _brand.accentSoft;
  /// Text and icons on [accentSoft].
  Color get accentInk => _brand.accentInk;
}

/// Makes the restaurant's brand available to every screen: `BrandScope.of(context)`.
class BrandScope extends InheritedWidget {
  const BrandScope({super.key, required this.brand, required super.child});
  final Brand? brand;

  static Brand? of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<BrandScope>()?.brand;

  @override
  bool updateShouldNotify(BrandScope oldWidget) => oldWidget.brand != brand;
}
