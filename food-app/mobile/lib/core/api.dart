import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'geo.dart';
import 'models.dart';

/// Talks to the same /v1 API as the web app. The guest cookie is kept on the device and sent back on every call,
/// the way a browser does. The server only ever stores its hash.
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client, this.prefs}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  SharedPreferences? prefs;
  String? _guestCookie;

  /// Goes up by one each time the cart changes, so a screen that shows the cart can reload it.
  final ValueNotifier<int> cartChanges = ValueNotifier<int>(0);

  static const _cookieKey = 'guest_cookie';

  Future<void> init() async {
    prefs ??= await SharedPreferences.getInstance();
    _guestCookie = prefs!.getString(_cookieKey);
  }

  Map<String, String> _headers({bool json = false}) {
    final headers = <String, String>{'Accept': 'application/json'};
    if (json) headers['Content-Type'] = 'application/json';
    if (_guestCookie != null) headers['Cookie'] = 'guest=$_guestCookie';
    return headers;
  }

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() call) async {
    final response = await call();
    final setCookie = response.headers['set-cookie'];
    if (setCookie != null) {
      final match = RegExp(r'guest=([^;]+)').firstMatch(setCookie);
      if (match != null) {
        _guestCookie = match.group(1);
        await prefs?.setString(_cookieKey, _guestCookie!);
      }
    }
    // Always UTF-8: menus and orders carry Arabic text, and a missing charset must not turn it into mojibake.
    final text = utf8.decode(response.bodyBytes);
    final body = text.isEmpty ? <String, dynamic>{} : jsonDecode(text) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      final error = (body['error'] as Map<String, dynamic>?) ?? {};
      throw ApiException(error['code'] as String? ?? 'http_${response.statusCode}', error['message'] as String? ?? 'Something went wrong.');
    }
    return body;
  }

  Uri _uri(String path, [Map<String, String>? query]) => Uri.parse('$baseUrl$path').replace(queryParameters: query);

  Future<Menu> menu() async {
    final body = await _send(() => _client.get(_uri('/v1/menu'), headers: _headers()));
    return Menu.fromJson(body);
  }

  Future<Map<String, dynamic>> cart({String channel = 'delivery'}) =>
      _send(() => _client.get(_uri('/v1/cart', {'channel': channel}), headers: _headers()));

  Future<Map<String, dynamic>> saveCart(List<CartLine> lines, {String channel = 'delivery'}) => _sendCart(() => _client.put(
        _uri('/v1/cart'),
        headers: _headers(json: true),
        body: jsonEncode({
          'channel': channel,
          'items': lines.map((l) => {'itemId': l.itemId, 'qty': l.qty, 'note': l.note}).toList(),
        }),
      ));

  Future<List<CartLine>> cartLines() async {
    final body = await cart();
    return (body['lines'] as List<dynamic>).map((l) => CartLine.fromJson(l as Map<String, dynamic>)).toList();
  }

  Future<QuoteResult> quote(String channel, {String? addressId}) async {
    final body = await _send(() => _client.post(
          _uri('/v1/checkout/quote'),
          headers: _headers(json: true),
          body: jsonEncode({'channel': channel, 'addressId': addressId}),
        ));
    return QuoteResult(
      quote: Quote.fromJson(body['quote'] as Map<String, dynamic>),
      delivery: body['delivery'] == null ? null : DeliveryQuote.fromJson(body['delivery'] as Map<String, dynamic>),
    );
  }

  Future<PlacedOrder> placeOrder({required String channel, required String method, String? addressId, required String idempotencyKey}) async {
    final body = await _send(() => _client.post(
          _uri('/v1/orders'),
          headers: _headers(json: true),
          body: jsonEncode({'channel': channel, 'method': method, 'addressId': addressId, 'idempotencyKey': idempotencyKey}),
        ));
    final placed = PlacedOrder.fromJson(body['order'] as Map<String, dynamic>);
    await prefs?.setString('last_order_id', placed.id);
    return placed;
  }

  /// The most recent order placed from this device, for the dashboard's tracking widget.
  String? get lastOrderId => prefs?.getString('last_order_id');

  /// Address search through the server. Results are labels with coordinates; the provider is not called from the app.
  Future<List<Place>> placeSearch(String query, {String locale = 'en'}) async {
    final body = await _send(() => _client.get(_uri('/v1/places/search', {'q': query}), headers: _headers()));
    return (body['places'] as List<dynamic>).map((p) => Place.fromJson(p as Map<String, dynamic>)).toList();
  }

  /// The label for a pinned point, or null when the map has no name for it.
  Future<Place?> placeAt(GeoPoint point) async {
    final body = await _send(() => _client.get(_uri('/v1/places/reverse', {'lat': '${point.lat}', 'lng': '${point.lng}'}), headers: _headers()));
    return body['place'] == null ? null : Place.fromJson(body['place'] as Map<String, dynamic>);
  }

  Future<List<SavedAddress>> addresses() async {
    final body = await _send(() => _client.get(_uri('/v1/addresses'), headers: _headers()));
    return (body['addresses'] as List<dynamic>).map((a) => SavedAddress.fromJson(a as Map<String, dynamic>)).toList();
  }

  Future<SavedAddress> saveAddress(Map<String, dynamic> fields) async {
    final body = await _send(() => _client.post(_uri('/v1/addresses'), headers: _headers(json: true), body: jsonEncode(fields)));
    return SavedAddress.fromJson(body['address'] as Map<String, dynamic>);
  }

  Future<void> deleteAddress(String id) => _send(() => _client.delete(_uri('/v1/addresses/$id'), headers: _headers()));

  Future<List<DeliveryZone>> deliveryZones() async {
    final body = await _send(() => _client.get(_uri('/v1/delivery-zones'), headers: _headers()));
    return (body['zones'] as List<dynamic>).map((z) => DeliveryZone.fromJson(z as Map<String, dynamic>)).toList();
  }

  Future<MembershipState> membership() async {
    final body = await _send(() => _client.get(_uri('/v1/membership'), headers: _headers()));
    return MembershipState.fromJson(body);
  }

  Future<List<OrderHistory>> orderHistory() async {
    final body = await _send(() => _client.get(_uri('/v1/orders'), headers: _headers()));
    return (body['orders'] as List<dynamic>).map((o) => OrderHistory.fromJson(o as Map<String, dynamic>)).toList();
  }

  Future<HomeShortcuts> homeShortcuts() async {
    final body = await _send(() => _client.get(_uri('/v1/customer/home'), headers: _headers()));
    return HomeShortcuts.fromJson(body);
  }

  Future<void> setFavourite(String itemId, bool on) => _send(() => on
      ? _client.put(_uri('/v1/favourites/$itemId'), headers: _headers())
      : _client.delete(_uri('/v1/favourites/$itemId'), headers: _headers()));

  Future<ReorderResult> reorder(String orderId) async {
    final body = await _send(() => _client.post(_uri('/v1/orders/$orderId/reorder'), headers: _headers()));
    cartChanges.value++;
    return ReorderResult.fromJson(body);
  }

  Future<PlacedOrder> order(String id) async {
    final body = await _send(() => _client.get(_uri('/v1/orders/$id'), headers: _headers()));
    return PlacedOrder.fromJson(body['order'] as Map<String, dynamic>);
  }

  /// Asks the restaurant assistant. Sends the question only; the reply's cards are data the server checked.
  Future<AssistantReply> ask(String message, {String locale = 'en'}) async {
    final body = await _send(() => _client.post(_uri('/v1/ai/ask'), headers: _headers(json: true), body: jsonEncode({'message': message, 'locale': locale})));
    return AssistantReply.fromJson(body);
  }

  /// Adds one of an item, the same way the web app does: read the cart, change it, write it back.
  /// Sends a cart change and tells the screens that show the cart.
  Future<Map<String, dynamic>> _sendCart(Future<http.Response> Function() call) async {
    final body = await _send(call);
    cartChanges.value++;
    return body;
  }

  Future<void> addOne(String itemId) async {
    final lines = await cartLines();
    final updated = <CartLine>[];
    var found = false;
    for (final line in lines) {
      if (line.itemId == itemId) {
        updated.add(line.copyWith(qty: line.qty + 1));
        found = true;
      } else {
        updated.add(line);
      }
    }
    if (!found) updated.add(CartLine(itemId: itemId, qty: 1, note: '', name: null, unitMinor: null, soldOut: false));
    await saveCart(updated);
  }
}

/// A random key per checkout visit. A double tap reuses it, so the server returns the same order.
String newIdempotencyKey() {
  final random = Random.secure();
  return List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
}
