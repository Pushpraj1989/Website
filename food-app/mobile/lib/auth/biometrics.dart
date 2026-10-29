import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

/// Face ID on an iPhone. Anywhere else (Android, desktop, a phone without Face ID) the gate reports "not available"
/// and the app falls back to the one-time code, so nothing depends on this being present.
abstract class BiometricGate {
  Future<bool> faceIdAvailable();
  Future<bool> authenticate(String reason);
}

class LocalAuthGate implements BiometricGate {
  LocalAuthGate({LocalAuthentication? auth}) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> faceIdAvailable() async {
    if (defaultTargetPlatform != TargetPlatform.iOS) return false;
    try {
      if (!await _auth.isDeviceSupported()) return false;
      return (await _auth.getAvailableBiometrics()).contains(BiometricType.face);
    } on PlatformException {
      return false;
    }
  }

  @override
  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(localizedReason: reason, biometricOnly: true);
    } on PlatformException {
      return false;
    }
  }
}

/// Test double: available or not, and the answer to the prompt.
class FakeBiometricGate implements BiometricGate {
  FakeBiometricGate({this.available = true, this.passes = true});
  final bool available;
  final bool passes;
  int prompts = 0;

  @override
  Future<bool> faceIdAvailable() async => available;

  @override
  Future<bool> authenticate(String reason) async {
    prompts += 1;
    return passes;
  }
}
