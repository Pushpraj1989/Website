import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

// The dashboard is a list of widget ids, in the order the user chose. The catalogue is fixed in code; the
// choice is saved on the device. Limits come from tokens.json ("dashboard": min 1, max 6).

const dashboardMin = 1;
const dashboardMax = 6;

class DashboardWidgetDef {
  const DashboardWidgetDef(this.id, this.titleEn, this.titleAr, this.descEn, this.descAr);
  final String id;
  final String titleEn;
  final String titleAr;
  final String descEn;
  final String descAr;

  String title(String lang) => lang == 'ar' ? titleAr : titleEn;
  String desc(String lang) => lang == 'ar' ? descAr : descEn;
}

const dashboardCatalogue = <DashboardWidgetDef>[
  DashboardWidgetDef('quick_actions', 'Quick actions', 'إجراءات سريعة', 'Menu, cart and tracking in one row', 'القائمة والسلة والتتبع في صف واحد'),
  DashboardWidgetDef('cart_summary', 'Your cart', 'سلتك', 'Items and total waiting for checkout', 'الأصناف والإجمالي قبل الدفع'),
  DashboardWidgetDef('active_order', 'Active order', 'الطلب الحالي', 'Status of your latest order', 'حالة آخر طلب لك'),
  DashboardWidgetDef('popular', 'Popular on the menu', 'الأكثر طلباً', 'Three dishes you can add in one tap', 'ثلاثة أطباق تضيفها بضغطة واحدة'),
  DashboardWidgetDef('last_order', 'Order again', 'اطلب مرة أخرى', 'Your last order, with one tap to reorder', 'آخر طلب لك مع زر لإعادة الطلب'),
  DashboardWidgetDef('frequent', 'Ordered most', 'الأكثر طلبك', 'The dishes you order most often', 'الأطباق التي تطلبها غالباً'),
  DashboardWidgetDef('favourites', 'Favourites', 'المفضلة', 'Dishes you saved', 'الأطباق التي حفظتها'),
];

const defaultDashboard = ['quick_actions', 'cart_summary', 'popular'];

DashboardWidgetDef? defFor(String id) {
  for (final def in dashboardCatalogue) {
    if (def.id == id) return def;
  }
  return null;
}

/// Pure layout rules, so the customise sheet and the tests use the same logic.
class DashboardLayout {
  const DashboardLayout(this.ids);
  final List<String> ids;

  bool canAdd() => ids.length < dashboardMax;
  bool canRemove() => ids.length > dashboardMin;

  DashboardLayout add(String id) {
    if (!canAdd() || ids.contains(id) || defFor(id) == null) return this;
    return DashboardLayout([...ids, id]);
  }

  DashboardLayout remove(String id) {
    if (!canRemove() || !ids.contains(id)) return this;
    return DashboardLayout(ids.where((x) => x != id).toList());
  }

  DashboardLayout moveUp(int index) {
    if (index <= 0 || index >= ids.length) return this;
    final next = [...ids];
    final tmp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = tmp;
    return DashboardLayout(next);
  }

  DashboardLayout moveDown(int index) {
    if (index < 0 || index >= ids.length - 1) return this;
    return moveUp(index + 1);
  }

  List<String> get available => [
        for (final def in dashboardCatalogue)
          if (!ids.contains(def.id)) def.id,
      ];

  /// Saved data from an older version can contain widgets that no longer exist. They are dropped, and the
  /// count is kept within the limits.
  static DashboardLayout sanitise(List<dynamic> raw) {
    final seen = <String>{};
    final ids = <String>[];
    for (final item in raw) {
      if (item is String && defFor(item) != null && seen.add(item)) ids.add(item);
    }
    if (ids.length > dashboardMax) return DashboardLayout(ids.take(dashboardMax).toList());
    if (ids.length < dashboardMin) return const DashboardLayout(defaultDashboard);
    return DashboardLayout(ids);
  }
}

class DashboardStore {
  DashboardStore(this.prefs);
  final SharedPreferences prefs;
  static const _key = 'dashboard_layout';

  DashboardLayout load() {
    final raw = prefs.getString(_key);
    if (raw == null) return const DashboardLayout(defaultDashboard);
    try {
      return DashboardLayout.sanitise(jsonDecode(raw) as List<dynamic>);
    } catch (_) {
      return const DashboardLayout(defaultDashboard);
    }
  }

  Future<void> save(DashboardLayout layout) => prefs.setString(_key, jsonEncode(layout.ids));
}
