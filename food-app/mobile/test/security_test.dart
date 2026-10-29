import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/security.dart';

void main() {
  test('a release build accepts HTTPS and refuses plain HTTP, even on localhost', () {
    expect(() => requireSecureTransport('https://api.example.com', releaseMode: true), returnsNormally);
    expect(() => requireSecureTransport('http://api.example.com', releaseMode: true), throwsArgumentError);
    expect(() => requireSecureTransport('http://localhost:3100', releaseMode: true), throwsArgumentError);
  });

  test('a debug build may use plain HTTP only to a local address', () {
    expect(() => requireSecureTransport('http://localhost:3100', releaseMode: false), returnsNormally);
    expect(() => requireSecureTransport('http://10.0.2.2:3100', releaseMode: false), returnsNormally);
    expect(() => requireSecureTransport('http://staging.example.com', releaseMode: false), throwsArgumentError);
  });

  test('a malformed address is refused', () {
    expect(() => requireSecureTransport('not a url', releaseMode: false), throwsArgumentError);
    expect(() => requireSecureTransport('', releaseMode: true), throwsArgumentError);
  });
}
