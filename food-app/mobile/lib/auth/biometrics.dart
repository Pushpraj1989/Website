import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

import 'auth_api.dart';
import 'passkeys.dart';

/// Face ID. In the phone app it is the device's own Face ID, which unlocks the sign-in kept on the device. In a browser
/// (even Safari on an iPhone) it is a passkey: the browser asks for Face ID and signs the customer in afresh. Either
/// way it is turned on after a first sign-in with an email code, and until then the customer is told to sign in first.
abstract class BiometricGate {
  /// Whether this device can use Face ID at all.
  Future<bool> faceIdAvailable();

  /// Phone app: asks for Face ID to unlock the kept sign-in.
  Future<bool> authenticate(String reason);

  /// True in the browser, where Face ID signs in through [passkeySignIn] instead of unlocking a kept sign-in.
  bool get signsIn => false;

  /// Turns Face ID on for the signed-in customer. Phone app: one Face ID check. Browser: adds a passkey.
  Future<bool> enroll(AuthApi auth, String reason) => authenticate(reason);

  /// Browser only: signs in with a passkey and returns the new session, or null when it did not happen.
  Future<Session?> passkeySignIn(AuthApi auth) async => null;
}

class LocalAuthGate extends BiometricGate {
  LocalAuthGate({LocalAuthentication? auth}) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> faceIdAvailable() async {
    // In a browser the platform reads as iOS on an iPhone, but the browser offers no Face ID to the app this way.
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return false;
    try {
      if (!await _auth.isDeviceSupported()) return false;
      return (await _auth.getAvailableBiometrics()).contains(BiometricType.face);
    } on PlatformException {
      return false;
    }
  }

  @override
  Future<bool> authenticate(String reason) async {
    if (kIsWeb) return false;
    try {
      return await _auth.authenticate(localizedReason: reason, biometricOnly: true);
    } on PlatformException {
      return false;
    }
  }
}

/// Face ID in the browser, through passkeys (web/passkey.js).
class PasskeyGate extends BiometricGate {
  @override
  bool get signsIn => true;

  @override
  Future<bool> faceIdAvailable() async => Passkeys.supported && await Passkeys.platformAvailable();

  @override
  Future<bool> authenticate(String reason) async => false;

  @override
  Future<bool> enroll(AuthApi auth, String reason) async {
    final start = await auth.passkeyRegisterOptions();
    final made = await Passkeys.create(jsonEncode(start['options']));
    await auth.passkeyRegister(challengeId: start['challengeId'] as String, response: jsonDecode(made) as Map<String, dynamic>);
    return true;
  }

  @override
  Future<Session?> passkeySignIn(AuthApi auth) async {
    final start = await auth.passkeyLoginOptions();
    final signed = await Passkeys.get(jsonEncode(start['options']));
    return auth.passkeyLogin(challengeId: start['challengeId'] as String, response: jsonDecode(signed) as Map<String, dynamic>);
  }
}

/// The right Face ID for where the app runs.
BiometricGate defaultBiometricGate() => kIsWeb ? PasskeyGate() : LocalAuthGate();

/// Test double: available or not, and the answer to the prompt. [webSession] makes it behave like the browser.
class FakeBiometricGate extends BiometricGate {
  FakeBiometricGate({this.available = true, this.passes = true, this.webSession});
  final bool available;
  final bool passes;
  final Session? webSession;
  int prompts = 0;
  int enrolments = 0;

  @override
  bool get signsIn => webSession != null;

  @override
  Future<bool> faceIdAvailable() async => available;

  @override
  Future<bool> authenticate(String reason) async {
    prompts += 1;
    return passes;
  }

  @override
  Future<bool> enroll(AuthApi auth, String reason) async {
    enrolments += 1;
    return passes;
  }

  @override
  Future<Session?> passkeySignIn(AuthApi auth) async {
    prompts += 1;
    if (passes && webSession != null) {
      auth.token = webSession!.token;
      return webSession;
    }
    return null;
  }
}
