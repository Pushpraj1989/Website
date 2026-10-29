import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/models.dart';

class Account {
  const Account({required this.id, required this.name, required this.phone, required this.email, required this.emailVerified});
  final String id;
  final String name;
  final String phone;
  final String? email;
  final bool emailVerified;

  factory Account.fromJson(Map<String, dynamic> json) => Account(
        id: json['id'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String,
        email: json['email'] as String?,
        emailVerified: json['emailVerified'] as bool? ?? false,
      );
}

/// A code was sent. [sentTo] is already masked by the server, so the screen can show it without exposing it.
class Challenge {
  const Challenge({required this.challengeId, required this.sentTo, required this.resendInSeconds});
  final String challengeId;
  final String sentTo;
  final int resendInSeconds;

  factory Challenge.fromJson(Map<String, dynamic> json) => Challenge(
        challengeId: json['challengeId'] as String,
        sentTo: json['sentTo'] as String,
        resendInSeconds: json['resendInSeconds'] as int? ?? 30,
      );
}

class Session {
  const Session({required this.token, required this.account});
  final String token;
  final Account account;
}

/// The sign-up and sign-in calls. Every call that needs a user sends the session token as a bearer token.
class AuthApi {
  AuthApi({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String? token;

  Future<Map<String, dynamic>> _send(String method, String path, {Map<String, dynamic>? body}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (token != null) headers['Authorization'] = 'Bearer $token';
    final uri = Uri.parse('$baseUrl$path');
    final request = http.Request(method, uri)..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(await _client.send(request));
    final text = utf8.decode(response.bodyBytes);
    final json = text.isEmpty ? <String, dynamic>{} : jsonDecode(text) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      final error = (json['error'] as Map<String, dynamic>?) ?? {};
      throw ApiException(error['code'] as String? ?? 'http_${response.statusCode}', error['message'] as String? ?? 'Something went wrong.');
    }
    return json;
  }

  Future<Challenge> signUpPhone({required String name, required String phone}) async =>
      Challenge.fromJson(await _send('POST', '/v1/auth/signup/phone', body: {'name': name, 'phone': phone}));

  Future<Session> verifySignUpPhone({required String challengeId, required String code}) async {
    final json = await _send('POST', '/v1/auth/signup/phone/verify', body: {'challengeId': challengeId, 'code': code});
    return _session(json);
  }

  Future<Challenge> signInPhone({required String phone}) async =>
      Challenge.fromJson(await _send('POST', '/v1/auth/login/phone', body: {'phone': phone}));

  Future<Session> verifySignInPhone({required String challengeId, required String code}) async {
    final json = await _send('POST', '/v1/auth/login/phone/verify', body: {'challengeId': challengeId, 'code': code});
    return _session(json);
  }

  /// Sends the code to the typed address. Needs the signed-in token from the sign-up step.
  Future<Challenge> startEmailVerification({required String email}) async =>
      Challenge.fromJson(await _send('POST', '/v1/auth/email/start', body: {'email': email}));

  Future<Account> verifyEmail({required String challengeId, required String code}) async {
    final json = await _send('POST', '/v1/auth/email/verify', body: {'challengeId': challengeId, 'code': code});
    return Account.fromJson(json['account'] as Map<String, dynamic>);
  }

  Future<Account> me() async => Account.fromJson((await _send('GET', '/v1/auth/me'))['account'] as Map<String, dynamic>);

  Future<void> logout() async {
    await _send('POST', '/v1/auth/logout');
    token = null;
  }

  Session _session(Map<String, dynamic> json) {
    final session = Session(token: json['token'] as String, account: Account.fromJson(json['account'] as Map<String, dynamic>));
    token = session.token;
    return session;
  }
}
