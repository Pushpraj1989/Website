import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// Talks to the same /v1 API as the web app. The guest cookie is kept on the device and sent back on every call,
/// the way a browser does. The server only ever stores its hash.
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client, this.prefs}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  SharedPreferences? prefs;
  String? _guestCookie;

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

  Future<Map<String, dynamic>> saveCart(List<CartLine> lines, {String channel = 'delivery'}) => _send(() => _client.put(
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

  Future<Quote> quote(String channel) async {
    final body = await _send(() => _client.post(_uri('/v1/checkout/quote'), headers: _headers(json: true), body: jsonEncode({'channel': channel})));
    return Quote.fromJson(body['quote'] as Map<String, dynamic>);
  }

  Future<PlacedOrder> placeOrder({required String channel, required String method, String? address, required String idempotencyKey}) async {
    final body = await _send(() => _client.post(
          _uri('/v1/orders'),
          headers: _headers(json: true),
          body: jsonEncode({'channel': channel, 'method': method, 'address': address, 'idempotencyKey': idempotencyKey}),
        ));
    final placed = PlacedOrder.fromJson(body['order'] as Map<String, dynamic>);
    await prefs?.setString('last_order_id', placed.id);
    return placed;
  }

  /// The most recent order placed from this device, for the dashboard's tracking widget.
  String? get lastOrderId => prefs?.getString('last_order_id');

  Future<PlacedOrder> order(String id) async {
    final body = await _send(() => _client.get(_uri('/v1/orders/$id'), headers: _headers()));
    return PlacedOrder.fromJson(body['order'] as Map<String, dynamic>);
  }

  /// Adds one of an item, the same way the web app does: read the cart, change it, write it back.
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
