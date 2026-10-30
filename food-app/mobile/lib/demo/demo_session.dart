import '../auth/session_store.dart';

/// The demo keeps the sign-in session in memory only. It starts signed out: the person trying the demo signs up
/// with their own name and number, and the one-time code arrives in the demo inbox.
class DemoSessionStore implements SessionStore {
  String? _token;
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
