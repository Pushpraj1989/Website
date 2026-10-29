import 'package:flutter/material.dart';

import 'app.dart';
import 'core/security.dart';
import 'package:flutter/foundation.dart';

void main() {
  // The API base is set at build time: flutter run --dart-define=API_BASE=http://10.0.2.2:3100 (Android emulator).
  const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:3100');
  // Refuse to start with a plain-text API address in a release build.
  requireSecureTransport(apiBase, releaseMode: kReleaseMode);
  runApp(const SampleKitchenApp(apiBase: apiBase));
}
