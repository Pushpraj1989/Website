import 'dart:js_interop';

import 'passkeys.dart';

@JS('foodPasskey')
external _Shim? get _shim;

extension type _Shim(JSObject _) implements JSObject {
  external JSBoolean supported();
  external JSPromise<JSBoolean> platformAvailable();
  external JSPromise<JSString> create(JSString optionsJson);
  external JSPromise<JSString> get(JSString optionsJson);
}

/// The browser's passkeys, through web/passkey.js.
class Passkeys {
  static bool get supported => _shim?.supported().toDart ?? false;

  static Future<bool> platformAvailable() async {
    final shim = _shim;
    if (shim == null) return false;
    return (await shim.platformAvailable().toDart).toDart;
  }

  static Future<String> create(String optionsJson) => _call((shim) => shim.create(optionsJson.toJS));

  static Future<String> get(String optionsJson) => _call((shim) => shim.get(optionsJson.toJS));

  static Future<String> _call(JSPromise<JSString> Function(_Shim shim) run) async {
    final shim = _shim;
    if (shim == null) throw const PasskeyError('NotSupportedError');
    try {
      return (await run(shim).toDart).toDart;
    } catch (error) {
      // The shim rejects with an Error whose message is the browser's error name.
      final text = error.toString();
      final name = RegExp(r'([A-Za-z]+Error)').firstMatch(text)?.group(1) ?? 'Error';
      throw PasskeyError(name);
    }
  }
}
