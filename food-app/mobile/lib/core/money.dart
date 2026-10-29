// Money is an integer count of the currency's smallest unit. Decimal places come from the currency table,
// mirroring food-app/web/lib/money.ts. Digits stay western (0-9) in both languages.

const Map<String, int> currencyDigits = {
  'AED': 2,
  'SAR': 2,
  'QAR': 2,
  'OMR': 3,
  'BHD': 3,
  'KWD': 3,
  'USD': 2,
};

int minorDigitsOf(String code) {
  final digits = currencyDigits[code];
  if (digits == null) throw ArgumentError('Unknown currency: $code');
  return digits;
}

/// formatMoney(1250, 'AED') -> 'AED 12.50'. No floating point: the digits are split from the integer.
String formatMoney(int minor, String code) {
  final digits = minorDigitsOf(code);
  final sign = minor < 0 ? '-' : '';
  final raw = minor.abs().toString().padLeft(digits + 1, '0');
  final whole = raw.substring(0, raw.length - digits);
  final fraction = raw.substring(raw.length - digits);
  final grouped = _group(whole);
  final amount = digits > 0 ? '$grouped.$fraction' : grouped;
  return '$sign$code $amount';
}

String _group(String digits) {
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}
