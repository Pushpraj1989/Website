import 'dart:convert';

import 'package:http/http.dart' as http;

/// A UTF-8 JSON response, the way the server sends it. Arabic text needs UTF-8 bytes, not the Latin-1 default.
http.Response respond(String body, int status, {Map<String, String>? headers}) => http.Response.bytes(
      utf8.encode(body),
      status,
      headers: {'content-type': 'application/json; charset=utf-8', ...?headers},
    );
