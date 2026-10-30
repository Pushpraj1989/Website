import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'auth/auth_api.dart';
import 'core/api.dart';
import 'core/security.dart';
import 'demo/demo_inbox_banner.dart';
import 'demo/demo_server.dart';
import 'demo/demo_session.dart';

Future<void> main() async {
  // Demo mode runs the API's rules inside the app on data exported from a database (assets/demo/snapshot.json):
  //   flutter run --profile --dart-define=DEMO=true
  const demo = bool.fromEnvironment('DEMO');
  if (demo) {
    // A demo build must never reach customers: it sends no orders anywhere. Release builds refuse to start in demo mode.
    if (kReleaseMode) throw StateError('Demo mode is for debug and profile builds only. Build the release app without DEMO=true.');
    WidgetsFlutterBinding.ensureInitialized();
    const base = 'https://demo.invalid';
    final server = DemoServer(snapshot: DemoServer.parse(await rootBundle.loadString('assets/demo/snapshot.json')));
    runApp(DemoFrame(
      inbox: server.inbox,
      child: SampleKitchenApp(
        apiBase: base,
        api: ApiClient(baseUrl: base, client: server.client),
        auth: AuthApi(baseUrl: base, client: server.client),
        sessions: DemoSessionStore(),
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
