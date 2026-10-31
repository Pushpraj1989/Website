import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Keeps the session token. On a phone it lives in the Keychain (iOS) or the Keystore (Android), never in plain prefs.
abstract class SessionStore {
  Future<String?> readToken();
  Future<void> writeToken(String token);
  Future<void> clear();
  Future<bool> faceIdEnabled();
  Future<void> setFaceIdEnabled(bool enabled);
}

class SecureSessionStore implements SessionStore {
  SecureSessionStore({FlutterSecureStorage? secure}) : _secure = secure ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secure;
  static const _tokenKey = 'session_token';
  static const _faceKey = 'face_id_enabled';

  @override
  Future<String?> readToken() => _secure.read(key: _tokenKey);

  @override
  Future<void> writeToken(String token) => _secure.write(key: _tokenKey, value: token);

  @override
  Future<void> clear() async {
    await _secure.delete(key: _tokenKey);
    await setFaceIdEnabled(false);
  }

  // The switch is not a secret, so it is kept with the other preferences.
  @override
  Future<bool> faceIdEnabled() async => (await SharedPreferences.getInstance()).getBool(_faceKey) ?? false;

  @override
  Future<void> setFaceIdEnabled(bool enabled) async => (await SharedPreferences.getInstance()).setBool(_faceKey, enabled);
}

/// In-memory store for tests and for previews.
class MemorySessionStore implements SessionStore {
  String? token;
  bool face = false;

  @override
  Future<String?> readToken() async => token;

  @override
  Future<void> writeToken(String value) async => token = value;

  @override
  Future<void> clear() async {
    token = null;
    face = false;
  }

  @override
  Future<bool> faceIdEnabled() async => face;

  @override
  Future<void> setFaceIdEnabled(bool enabled) async => face = enabled;
}

/// Development-only store for desktop builds, which have no Keychain. It keeps the token in ordinary preferences.
/// Phones never use it: [defaultSessionStore] returns the secure store on iOS and Android.
class DesktopDevSessionStore extends SessionStore {
  DesktopDevSessionStore() : _inner = _PrefsFaceFlag();
  final SessionStore _inner;

  @override
  Future<String?> readToken() async => (await SharedPreferences.getInstance()).getString('dev_session_token');

  @override
  Future<void> writeToken(String token) async => (await SharedPreferences.getInstance()).setString('dev_session_token', token);

  @override
  Future<void> clear() async {
    await (await SharedPreferences.getInstance()).remove('dev_session_token');
    await _inner.setFaceIdEnabled(false);
  }

  @override
  Future<bool> faceIdEnabled() => _inner.faceIdEnabled();

  @override
  Future<void> setFaceIdEnabled(bool enabled) => _inner.setFaceIdEnabled(enabled);
}

SessionStore defaultSessionStore() {
  final mobile = defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.android;
  return mobile ? SecureSessionStore() : DesktopDevSessionStore();
}

/// Holds only the Face ID switch for the desktop store; the token itself is handled above.
class _PrefsFaceFlag extends SessionStore {
  @override
  Future<String?> readToken() async => null;
  @override
  Future<void> writeToken(String token) async {}
  @override
  Future<void> clear() async {}
  @override
  Future<bool> faceIdEnabled() async => (await SharedPreferences.getInstance()).getBool('face_id_enabled') ?? false;
  @override
  Future<void> setFaceIdEnabled(bool enabled) async => (await SharedPreferences.getInstance()).setBool('face_id_enabled', enabled);
}

/// Browsing and ordering as a guest, without an account. Remembered, so the app opens straight onto the menu next
/// time; signing in turns it off.
class GuestMode {
  static const _key = 'guest_mode';
  static Future<bool> isOn() async => (await SharedPreferences.getInstance()).getBool(_key) ?? false;
  static Future<void> set(bool on) async => (await SharedPreferences.getInstance()).setBool(_key, on);
}
