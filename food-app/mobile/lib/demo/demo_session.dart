import '../auth/session_store.dart';

/// The demo starts signed in as a demo customer, and keeps the session in memory only.
class DemoSessionStore implements SessionStore {
  String? _token = 'demo-token';
  bool _faceId = false;

  @override
  Future<String?> readToken() async => _token;

  @override
  Future<void> writeToken(String token) async => _token = token;

  @override
  Future<void> clear() async => _token = null;

  @override
  Future<bool> faceIdEnabled() async => _faceId;

  @override
  Future<void> setFaceIdEnabled(bool enabled) async => _faceId = enabled;
}
