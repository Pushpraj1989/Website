import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:sample_kitchen/core/geo.dart';
import 'package:sample_kitchen/core/models.dart';

import 'helpers.dart';

void main() {
  group('coordinates', () {
    test('a point inside the world is valid; a point outside it is not', () {
      expect(const GeoPoint(25.08, 55.14).isValid, isTrue);
      expect(const GeoPoint(91, 0).isValid, isFalse);
      expect(const GeoPoint(0, 181).isValid, isFalse);
      expect(const GeoPoint(double.nan, 0).isValid, isFalse);
    });

    test('the nearest zone centre is chosen, and none is chosen when there are no centres', () {
      const here = GeoPoint(25.1, 55.2);
      expect(nearestCentre(here, const [GeoPoint(24.5, 54.4), GeoPoint(25.09, 55.19)]), const GeoPoint(25.09, 55.19));
      expect(nearestCentre(here, const []), isNull);
    });

    test('the map picture source can be set at build time, and has a default', () {
      expect(MapConfig.styleUrl, startsWith('https://'));
    });
  });

  group('debouncer', () {
    test('a burst of calls runs the action once, after the last one', () async {
      final debouncer = Debouncer(const Duration(milliseconds: 50));
      var runs = 0;
      for (var i = 0; i < 5; i++) {
        debouncer.run(() => runs++);
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      expect(runs, 0, reason: 'still waiting while the calls keep coming');
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(runs, 1);
    });

    test('a cancelled action never runs', () async {
      final debouncer = Debouncer(const Duration(milliseconds: 20));
      var ran = false;
      debouncer.run(() => ran = true);
      debouncer.cancel();
      await Future<void>.delayed(const Duration(milliseconds: 40));
      expect(ran, isFalse);
    });
  });

  group('places through the server', () {
    testWidgets('a search returns labels and coordinates, and asks the server, not a map provider', (tester) async {
      final requested = <String>[];
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final api = ApiClient(
        baseUrl: 'http://api.test',
        prefs: prefs,
        client: MockClient((request) async {
          requested.add(request.url.toString());
          return respond(jsonEncode({'places': [{'label': 'Dubai Marina', 'lat': 25.08, 'lng': 55.14}]}), 200);
        }),
      );
      final places = await api.placeSearch('dubai marina');
      expect(places.single.label, 'Dubai Marina');
      expect(places.single.point, const GeoPoint(25.08, 55.14));
      expect(requested.single, startsWith('http://api.test/v1/places/search'));
      expect(requested.single, isNot(contains('nominatim')));
    });

    testWidgets('a label lookup returns null when the server has no name for the point', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final api = ApiClient(
        baseUrl: 'http://api.test',
        prefs: prefs,
        client: MockClient((request) async => respond(jsonEncode({'place': null}), 200)),
      );
      expect(await api.placeAt(const GeoPoint(25.08, 55.14)), isNull);
    });

    test('a zone carries its centre for the map to open on', () {
      final zone = DeliveryZone.fromJson({
        'id': 'z1',
        'name': {'en': 'Central', 'ar': 'الوسط'},
        'feeMinor': 1000,
        'minOrderMinor': 0,
        'centre': {'lat': 25.1, 'lng': 55.3},
      });
      expect(zone.centre, const GeoPoint(25.1, 55.3));
      final bare = DeliveryZone.fromJson({'id': 'z2', 'name': {'en': 'x', 'ar': 'x'}, 'feeMinor': 0, 'minOrderMinor': 0});
      expect(bare.centre, isNull);
    });
  });
}
