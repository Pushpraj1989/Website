import 'dart:convert';

import 'package:http/testing.dart';
import 'package:sample_kitchen/auth/auth_api.dart';
import 'package:sample_kitchen/auth/session_store.dart';

import 'helpers.dart';

/// Answers the auth endpoints the way the server does. The only accepted code is 123456.
/// Setting [phoneRegistered] to false makes sign-in say "no account".
class AuthServer {
  AuthServer({this.phoneRegistered = true, this.emailVerified = false});
  bool phoneRegistered;
  bool emailVerified;
  final List<String> calls = [];
  String? email;

  MockClient client() => MockClient((request) async {
        final path = request.url.path;
        calls.add('${request.method} $path');
        final body = request.body.isEmpty ? <String, dynamic>{} : jsonDecode(request.body) as Map<String, dynamic>;
        switch (path) {
          case '/v1/auth/signup/phone':
            return respond(jsonEncode({'challengeId': 'c-signup', 'sentTo': '+971 •••4567', 'resendInSeconds': 30}), 200);
          case '/v1/auth/signup/phone/verify':
          case '/v1/auth/login/phone/verify':
            if (body['code'] != '123456') {
              return respond(jsonEncode({'error': {'code': 'wrong_code', 'message': 'That code is wrong. 4 tries left.'}}), 422);
            }
            return respond(jsonEncode({'token': 'tok-1', 'account': _account()}), 201);
          case '/v1/auth/login/phone':
            if (!phoneRegistered) {
              return respond(jsonEncode({'error': {'code': 'no_account', 'message': 'No account uses this number. Create one first.'}}), 404);
            }
            return respond(jsonEncode({'challengeId': 'c-login', 'sentTo': '+971 •••4567', 'resendInSeconds': 30}), 200);
          case '/v1/auth/email/start':
            email = body['email'] as String;
            return respond(jsonEncode({'challengeId': 'c-email', 'sentTo': 'sa••@example.com', 'resendInSeconds': 30}), 200);
          case '/v1/auth/email/verify':
            if (body['code'] != '123456') {
              return respond(jsonEncode({'error': {'code': 'wrong_code', 'message': 'That code is wrong. 4 tries left.'}}), 422);
            }
            emailVerified = true;
            return respond(jsonEncode({'account': _account()}), 200);
          case '/v1/auth/me':
            return respond(jsonEncode({'account': _account()}), 200);
          case '/v1/cart':
            return respond(jsonEncode({'currency': 'AED', 'lines': [], 'quote': null, 'problem': null}), 200);
          case '/v1/auth/logout':
            return respond(jsonEncode({'ok': true}), 200);
          default:
            return respond(jsonEncode(menuPayload()), 200);
        }
      });

  Map<String, dynamic> _account() => {
        'id': 'acc-1',
        'name': 'Sara Tester',
        'phone': '+971501234567',
        'email': emailVerified ? (email ?? 'sara@example.com') : null,
        'emailVerified': emailVerified,
      };
}

/// A store that already holds a session, as after a previous sign-in.
MemorySessionStore signedInStore({bool faceId = false}) => MemorySessionStore()
  ..token = 'tok-1'
  ..face = faceId;

AuthApi authWith(AuthServer server) => AuthApi(baseUrl: 'http://api.test', client: server.client());
