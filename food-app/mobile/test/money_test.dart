import 'package:flutter_test/flutter_test.dart';
import 'package:sample_kitchen/core/money.dart';

void main() {
  test('money uses the decimal places from the currency table', () {
    expect(formatMoney(1250, 'AED'), 'AED 12.50');
    expect(formatMoney(12345, 'OMR'), 'OMR 12.345');
    expect(formatMoney(5, 'AED'), 'AED 0.05');
    expect(formatMoney(-1250, 'AED'), '-AED 12.50');
    expect(formatMoney(123456789, 'AED'), 'AED 1,234,567.89');
  });

  test('money refuses unknown currencies', () {
    expect(() => formatMoney(100, 'XYZ'), throwsArgumentError);
  });
}
