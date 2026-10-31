import 'passkeys.dart';

/// Outside a browser there are no passkeys; the phone's own Face ID is used instead.
class Passkeys {
  static bool get supported => false;
  static Future<bool> platformAvailable() async => false;
  static Future<String> create(String optionsJson) async => throw const PasskeyError('NotSupportedError');
  static Future<String> get(String optionsJson) async => throw const PasskeyError('NotSupportedError');
}
