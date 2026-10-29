import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/dashboard.dart';

void main() {
  test('add and remove keep the count within the limits', () {
    var layout = const DashboardLayout(['popular']);
    expect(layout.canRemove(), isFalse, reason: 'the last widget cannot be removed');
    expect(layout.remove('popular').ids, ['popular']);

    layout = layout.add('quick_actions').add('cart_summary').add('active_order');
    expect(layout.ids.length, 4);
    layout = layout.add('popular');
    expect(layout.ids, ['popular', 'quick_actions', 'cart_summary', 'active_order']);
  });

  test('the dashboard holds at most six widgets, and each widget only once', () {
    const full = DashboardLayout(['quick_actions', 'cart_summary', 'active_order', 'popular']);
    expect(full.add('quick_actions').ids.length, 4, reason: 'a widget already shown is not added twice');
    expect(const DashboardLayout(['popular']).canAdd(), isTrue);
    const five = DashboardLayout(['popular', 'quick_actions', 'cart_summary', 'active_order', 'a']);
    expect(five.canAdd(), isTrue);
  });

  test('reordering swaps neighbours and ignores moves off the ends', () {
    const layout = DashboardLayout(['a', 'b', 'c']);
    expect(layout.moveUp(1).ids, ['b', 'a', 'c']);
    expect(layout.moveDown(1).ids, ['a', 'c', 'b']);
    expect(layout.moveUp(0).ids, ['a', 'b', 'c']);
    expect(layout.moveDown(2).ids, ['a', 'b', 'c']);
  });

  test('saved layouts drop unknown and duplicate widgets, and fall back when empty', () {
    expect(DashboardLayout.sanitise(['popular', 'gone', 'popular', 'cart_summary']).ids, ['popular', 'cart_summary']);
    expect(DashboardLayout.sanitise(['gone']).ids, defaultDashboard);
    expect(DashboardLayout.sanitise(['quick_actions', 'cart_summary', 'active_order', 'popular', 'quick_actions', 'cart_summary']).ids.length, lessThanOrEqualTo(dashboardMax));
  });

  test('the layout is saved on the device and loaded back after a restart', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final store = DashboardStore(prefs);
    expect(store.load().ids, defaultDashboard);
    await store.save(const DashboardLayout(['active_order', 'popular']));
    expect(DashboardStore(await SharedPreferences.getInstance()).load().ids, ['active_order', 'popular']);
  });
}
