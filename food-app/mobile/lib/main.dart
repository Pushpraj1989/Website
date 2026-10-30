import 'package:flutter/material.dart';

import 'app.dart';
import 'auth/auth_api.dart';
import 'core/api.dart';
import 'core/security.dart';
import 'demo/demo_server.dart';
import 'demo/demo_session.dart';
import 'package:flutter/foundation.dart';

void main() {
  // Demo mode runs on sample data inside the app, with no server: flutter build apk --dart-define=DEMO=true
  const demo = bool.fromEnvironment('DEMO');
  if (demo) {
    const base = 'https://demo.invalid';
    final server = DemoServer();
    runApp(Directionality(
      textDirection: TextDirection.ltr,
      // A corner ribbon, so a demo build is never mistaken for the live app.
      child: Banner(
        message: 'DEMO',
        location: BannerLocation.topEnd,
        child: SampleKitchenApp(
          apiBase: base,
          api: ApiClient(baseUrl: base, client: server.client),
          auth: AuthApi(baseUrl: base, client: server.client),
          sessions: DemoSessionStore(),
        ),
      ),
    ));
    return;
  }
  // The API base is set at build time: flutter run --dart-define=API_BASE=http://10.0.2.2:3100 (Android emulator).
  const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:3100');
  // Refuse to start with a plain-text API address in a release build.
  requireSecureTransport(apiBase, releaseMode: kReleaseMode);
  runApp(const SampleKitchenApp(apiBase: apiBase));
}
