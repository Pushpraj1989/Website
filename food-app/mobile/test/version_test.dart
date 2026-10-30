import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/version.dart';

void main() {
  test('the version shown in the app is the version in pubspec.yaml', () {
    final line = File('pubspec.yaml').readAsLinesSync().firstWhere((l) => l.startsWith('version:'));
    expect(line.trim(), 'version: $appVersion+$appBuild');
  });
}
