// Map and location helpers that do not depend on the map provider, so they can be tested without a map.
import 'dart:async';

/// A latitude and longitude pair. Checked before use; a value outside the world is never sent to the server.
class GeoPoint {
  const GeoPoint(this.lat, this.lng);
  final double lat;
  final double lng;

  bool get isValid => lat.isFinite && lng.isFinite && lat.abs() <= 90 && lng.abs() <= 180;

  @override
  bool operator ==(Object other) => other is GeoPoint && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);
}

/// Where the map's pictures come from. Set at build time with --dart-define=MAP_STYLE_URL=... so the provider can
/// change without touching the screens. The default is an OpenStreetMap-based style with no key.
class MapConfig {
  const MapConfig._();
  static const styleUrl = String.fromEnvironment('MAP_STYLE_URL', defaultValue: 'https://tiles.openfreemap.org/styles/liberty');
}

/// Runs an action once, after the calls stop for [delay]. Used so a moving map does not ask for an address per frame.
class Debouncer {
  Debouncer(this.delay);
  final Duration delay;
  Timer? _timer;

  void run(void Function() action) {
    _timer?.cancel();
    _timer = Timer(delay, action);
  }

  void cancel() => _timer?.cancel();
}

/// The centre of the zone nearest to a point, used to open the map where the restaurant serves. Null when there
/// are no zones with a centre.
GeoPoint? nearestCentre(GeoPoint from, Iterable<GeoPoint> centres) {
  GeoPoint? best;
  var bestDistance = double.infinity;
  for (final c in centres) {
    final d = _squaredDistance(from, c);
    if (d < bestDistance) {
      bestDistance = d;
      best = c;
    }
  }
  return best;
}

// Good enough to choose between a few nearby centres; this is not used for delivery checks, which happen on the server.
double _squaredDistance(GeoPoint a, GeoPoint b) {
  final dLat = a.lat - b.lat;
  final dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}
