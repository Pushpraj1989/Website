import '../core/api.dart';
import '../core/models.dart';
import 'auth_api.dart';
import 'biometrics.dart';
import 'passkeys.dart';
import 'session_store.dart';

/// How a Face ID sign-in ended.
enum FaceIdResult {
  signedIn,
  /// Face ID was never turned on here: the customer signs in with an email code first, then turns it on.
  notSetUp,
  /// This device has no Face ID (or the browser no passkeys).
  unavailable,
  /// Cancelled, or the face was not recognised.
  failed,
}

/// Signs in with Face ID. In the phone app it unlocks the sign-in kept on the device; in a browser it signs in with a
/// passkey. Either way it only works once Face ID was turned on after an email sign-in on this device.
Future<FaceIdResult> faceIdSignIn({required BiometricGate gate, required AuthApi auth, required ApiClient api, required SessionStore sessions, required String reason}) async {
  if (!await sessions.faceIdEnabled()) return FaceIdResult.notSetUp;
  if (!await gate.faceIdAvailable()) return FaceIdResult.unavailable;
  if (gate.signsIn) {
    try {
      final session = await gate.passkeySignIn(auth);
      if (session == null) return FaceIdResult.failed;
      await sessions.writeToken(session.token);
      api.accessToken = session.token;
    } on PasskeyError {
      return FaceIdResult.failed;
    } on ApiException catch (e) {
      return e.code == 'passkey_unknown' ? FaceIdResult.notSetUp : FaceIdResult.failed;
    }
  } else {
    final token = await sessions.readToken();
    if (token == null) return FaceIdResult.notSetUp;
    if (!await gate.authenticate(reason)) return FaceIdResult.failed;
    auth.token = token;
    api.accessToken = token;
  }
  await GuestMode.set(false);
  return FaceIdResult.signedIn;
}
