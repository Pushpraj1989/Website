import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../app.dart';
import '../core/api.dart';
import '../core/geo.dart';
import '../core/models.dart';
import '../core/strings.dart';
import '../core/theme.dart';

/// Returned to the address sheet when the customer confirms a pin.
class PinnedLocation {
  const PinnedLocation({required this.point, required this.label});
  final GeoPoint point;
  final String label;
}

// The address pin. The map pictures come from MapConfig; the label for the pin comes from the server (reverse
// lookup), which is called only after the map stops moving, so a drag costs one lookup.
class AddressPinScreen extends StatefulWidget {
  const AddressPinScreen({super.key, required this.api, required this.language, this.start});
  final ApiClient api;
  final ValueNotifier<String> language;
  /// Where the map opens: the chosen zone's centre, or a saved address. Null when nothing is known yet.
  final GeoPoint? start;

  @override
  State<AddressPinScreen> createState() => _AddressPinScreenState();
}

class _AddressPinScreenState extends State<AddressPinScreen> {
  MapLibreMapController? _map;
  GeoPoint? _centre;
  String? _label;
  bool _looking = false;
  String? _message;
  List<Place> _results = [];
  final _search = TextEditingController();
  final _labelDebounce = Debouncer(const Duration(milliseconds: 600));
  final _searchDebounce = Debouncer(const Duration(milliseconds: 500));

  @override
  void dispose() {
    _labelDebounce.cancel();
    _searchDebounce.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onCameraIdle() {
    final c = _map?.cameraPosition?.target;
    if (c == null) return;
    _centre = GeoPoint(c.latitude, c.longitude);
    setState(() {
      _looking = true;
      _label = null;
    });
    _labelDebounce.run(_lookUpLabel);
  }

  Future<void> _lookUpLabel() async {
    final point = _centre;
    if (point == null || !point.isValid) return;
    try {
      final place = await widget.api.placeAt(point);
      if (!mounted || _centre != point) return;
      setState(() => _label = place?.label);
    } catch (_) {
      if (mounted) setState(() => _label = null);
    } finally {
      if (mounted) setState(() => _looking = false);
    }
  }

  void _onSearchChanged(String text, Strings s) {
    _searchDebounce.run(() async {
      if (text.trim().length < 3) {
        if (mounted) setState(() => _results = []);
        return;
      }
      try {
        final results = await widget.api.placeSearch(text.trim());
        if (mounted) setState(() => _results = results);
      } on ApiException catch (e) {
        if (mounted) setState(() => _message = e.message);
      } catch (_) {
        if (mounted) setState(() => _message = s.searchFailed);
      }
    });
  }

  Future<void> _goTo(GeoPoint point, {double zoom = 16}) async {
    await _map?.animateCamera(CameraUpdate.newLatLngZoom(LatLng(point.lat, point.lng), zoom));
  }

  Future<void> _useMyLocation(Strings s) async {
    setState(() => _message = null);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) throw StateError('off');
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) throw StateError('denied');
      final position = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      await _goTo(GeoPoint(position.latitude, position.longitude));
    } catch (_) {
      if (mounted) setState(() => _message = s.locationOff);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      language: widget.language,
      builder: (context, s) {
        final start = widget.start ?? const GeoPoint(0, 0);
        final label = _label;
        final canConfirm = _centre != null && _centre!.isValid && !_looking;
        return Scaffold(
          appBar: AppBar(title: Text(s.pinOnMap)),
          body: Column(children: [
            Padding(
              padding: const EdgeInsets.all(Tokens.space3),
              child: TextField(
                controller: _search,
                decoration: InputDecoration(hintText: s.pinSearchHint, prefixIcon: const Icon(Icons.search)),
                onChanged: (text) => _onSearchChanged(text, s),
              ),
            ),
            if (_results.isNotEmpty)
              SizedBox(
                height: 180,
                child: ListView(children: [
                  for (final place in _results)
                    ListTile(
                      title: Text(place.label, maxLines: 2, overflow: TextOverflow.ellipsis),
                      onTap: () {
                        setState(() => _results = []);
                        _goTo(place.point);
                      },
                    ),
                ]),
              ),
            Expanded(
              child: Stack(alignment: Alignment.center, children: [
                MapLibreMap(
                  styleString: MapConfig.styleUrl,
                  initialCameraPosition: CameraPosition(target: LatLng(start.lat, start.lng), zoom: widget.start == null ? 4 : 15),
                  onMapCreated: (controller) => _map = controller,
                  onCameraIdle: _onCameraIdle,
                ),
                IgnorePointer(child: Icon(Icons.location_pin, size: 44, color: Tokens.danger)),
                Positioned(
                  right: Tokens.space3,
                  top: Tokens.space3,
                  child: FloatingActionButton.small(
                    heroTag: 'locate',
                    tooltip: s.useMyLocation,
                    onPressed: () => _useMyLocation(s),
                    child: const Icon(Icons.my_location),
                  ),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(Tokens.space4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(_looking ? s.pinLoading : (label ?? s.pinHint), maxLines: 2, overflow: TextOverflow.ellipsis),
                if (_message != null)
                  Padding(padding: const EdgeInsets.only(top: Tokens.space2), child: Text(_message!, style: TextStyle(color: Tokens.danger))),
                const SizedBox(height: Tokens.space3),
                FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                  onPressed: canConfirm
                      ? () => Navigator.of(context).pop(PinnedLocation(point: _centre!, label: label ?? ''))
                      : null,
                  child: Text(s.pinConfirm),
                ),
              ]),
            ),
          ]),
        );
      },
    );
  }
}
