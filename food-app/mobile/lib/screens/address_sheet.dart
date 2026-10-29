import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/geo.dart';
import '../core/models.dart';
import '../core/money.dart';
import '../core/strings.dart';
import '../core/theme.dart';
import 'address_pin_screen.dart';

// Adds a delivery address from the checkout. The customer picks the delivery area from the zones the restaurant
// draws in the admin, so an address is never accepted for a place the restaurant does not serve.
class AddressSheet extends StatefulWidget {
  const AddressSheet({super.key, required this.api, required this.language, required this.s, required this.currency, required this.isFirst});
  final ApiClient api;
  final ValueNotifier<String> language;
  final Strings s;
  final String currency;
  final bool isFirst;

  @override
  State<AddressSheet> createState() => _AddressSheetState();
}

class _AddressSheetState extends State<AddressSheet> {
  final _label = TextEditingController(text: 'Home');
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  final _notes = TextEditingController();
  List<DeliveryZone>? _zones;
  String? _zoneId;
  PinnedLocation? _pin;
  late bool _isDefault = widget.isFirst;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadZones();
  }

  @override
  void dispose() {
    _label.dispose();
    _line1.dispose();
    _line2.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _loadZones() async {
    try {
      final zones = await widget.api.deliveryZones();
      if (!mounted) return;
      setState(() {
        _zones = zones;
        _zoneId = zones.length == 1 ? zones.first.id : null;
      });
    } catch (_) {
      if (mounted) setState(() => _zones = []);
    }
  }

  /// The map opens on the first zone that has a centre, so the customer starts where the restaurant serves.
  GeoPoint? get _mapStart {
    if (_pin != null) return _pin!.point;
    for (final z in _zones ?? const <DeliveryZone>[]) {
      if (z.centre != null) return z.centre;
    }
    return null;
  }

  Future<void> _pinOnMap() async {
    final pinned = await Navigator.of(context).push<PinnedLocation>(
      MaterialPageRoute(builder: (_) => AddressPinScreen(api: widget.api, language: widget.language, start: _mapStart)),
    );
    if (pinned == null || !mounted) return;
    setState(() {
      _pin = pinned;
      if (_line1.text.trim().isEmpty && pinned.label.isNotEmpty) _line1.text = pinned.label.split(',').first.trim();
    });
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final pin = _pin;
      final saved = await widget.api.saveAddress({
        'label': _label.text.trim(),
        'line1': _line1.text.trim(),
        'line2': _line2.text.trim(),
        'notes': _notes.text.trim(),
        'zoneId': _zoneId ?? '',
        'isDefault': _isDefault,
        // A pin is checked against the zones on the server. Without one, the chosen area is used.
        if (pin != null) 'lat': pin.point.lat,
        if (pin != null) 'lng': pin.point.lng,
      });
      if (mounted) Navigator.of(context).pop(saved);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = widget.s.genericError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final lang = s.lang;
    final zones = _zones;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(Tokens.space4),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(controller: _label, maxLength: 30, decoration: InputDecoration(labelText: s.addressLabel)),
          TextField(controller: _line1, maxLength: 200, decoration: InputDecoration(labelText: s.addressLine1)),
          TextField(controller: _line2, maxLength: 200, decoration: InputDecoration(labelText: s.addressLine2)),
          TextField(controller: _notes, maxLength: 200, maxLines: 2, decoration: InputDecoration(labelText: s.addressNotes)),
          const SizedBox(height: Tokens.space2),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: _pinOnMap,
            icon: const Icon(Icons.pin_drop_outlined),
            label: Text(_pin == null ? s.pinOnMap : s.pinnedAt),
          ),
          const SizedBox(height: Tokens.space2),
          if (zones == null)
            const Center(child: Padding(padding: EdgeInsets.all(Tokens.space3), child: CircularProgressIndicator()))
          else if (zones.isEmpty && _pin == null)
            Text(s.noZones, style: const TextStyle(color: Tokens.danger))
          else if (_pin == null)
            DropdownButtonFormField<String>(
              initialValue: _zoneId,
              decoration: InputDecoration(labelText: s.deliveryArea),
              items: [
                for (final z in zones)
                  DropdownMenuItem(value: z.id, child: Text('${z.name.of(lang)} · ${formatMoney(z.feeMinor, widget.currency)}')),
              ],
              onChanged: (v) => setState(() => _zoneId = v),
            ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(s.useAsDefault),
            value: _isDefault,
            onChanged: widget.isFirst ? null : (v) => setState(() => _isDefault = v),
          ),
          if (_error != null)
            Semantics(liveRegion: true, child: Padding(padding: const EdgeInsets.only(bottom: Tokens.space2), child: Text(_error!, style: const TextStyle(color: Tokens.danger)))),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: _busy || zones == null || (_pin == null && _zoneId == null) || _line1.text.trim().length < 3 ? null : _save,
            child: Text(s.saveAddress),
          ),
        ]),
      ),
    );
  }
}
