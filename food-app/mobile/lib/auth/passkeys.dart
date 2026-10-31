// Passkeys: sign-in with Face ID or Touch ID when the app runs in a browser. On a phone app the device's own Face ID is
// used instead (biometrics.dart), so outside the browser these report "not supported".
export 'passkeys_stub.dart' if (dart.library.js_interop) 'passkeys_web.dart';

/// Why a passkey step stopped: the browser's error name, such as NotAllowedError when the person cancels or the
/// device holds no passkey for this site.
class PasskeyError implements Exception {
  const PasskeyError(this.name);
  final String name;
  bool get cancelled => name == 'NotAllowedError' || name == 'AbortError';
  @override
  String toString() => 'PasskeyError($name)';
}
