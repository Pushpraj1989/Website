import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/app.dart';
import 'package:sample_kitchen/auth/biometrics.dart';
import 'package:sample_kitchen/auth/session_store.dart';
import 'package:sample_kitchen/core/api.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_fakes.dart';
import 'helpers.dart';

double openingOpacity(WidgetTester tester) {
  final splash = find.byType(BrandSplash);
  if (splash.evaluate().isEmpty) return 0;
  return tester.widget<AnimatedOpacity>(find.ancestor(of: splash, matching: find.byType(AnimatedOpacity)).first).opacity;
}

void main() {
  testWidgets('the opening plays through before the first screen shows', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final server = AuthServer();
    await tester.pumpWidget(SampleKitchenApp(
      apiBase: 'http://api.test',
      api: ApiClient(baseUrl: 'http://api.test', client: MockClient((request) async {
        if (request.url.path.endsWith('/menu')) {
          return http.Response(jsonEncode({...menuPayload(), 'brand': {'name': {'en': 'Vikashan', 'ar': 'Vikashan'}, 'color': '#B45309'}}), 200, headers: {'content-type': 'application/json'});
        }
        return server.client().send(request).then(http.Response.fromStream);
      })),
      auth: authWith(server),
      sessions: MemorySessionStore(),
      biometrics: FakeBiometricGate(available: false),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    // Mid-way (knife, halves closing): still fully showing.
    for (final ms in [400, 800, 1200, 1600, 2000]) {
      await tester.pump(const Duration(milliseconds: 400));
      expect(openingOpacity(tester), 1, reason: 'at about ${ms + 100}ms');
    }
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(find.byType(BrandSplash), findsNothing);
    expect(find.text('Sign in'), findsWidgets);
  });
}
