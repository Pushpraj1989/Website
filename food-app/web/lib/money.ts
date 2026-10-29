// Money is an integer count of the currency's smallest unit (fils for AED).
// The number of decimal places comes from the currency table, never from code.

export type CurrencyRow = { code: string; minorDigits: number };

// Mirrors the `currencies` table in replica/schema.sql. Add a row here when a currency is added there.
export const CURRENCIES: Record<string, CurrencyRow> = {
  AED: { code: 'AED', minorDigits: 2 },
  SAR: { code: 'SAR', minorDigits: 2 },
  QAR: { code: 'QAR', minorDigits: 2 },
  OMR: { code: 'OMR', minorDigits: 3 },
  BHD: { code: 'BHD', minorDigits: 3 },
  KWD: { code: 'KWD', minorDigits: 3 },
  USD: { code: 'USD', minorDigits: 2 },
};

export function minorDigitsOf(code: string): number {
  const row = CURRENCIES[code];
  if (!row) throw new Error(`Unknown currency: ${code}`);
  return row.minorDigits;
}

/**
 * Formats an integer amount in minor units, e.g. formatMoney(1250, 'AED', 'en') -> "AED 12.50".
 * No floating point: the digits are split from the integer string.
 * Digits stay western (0-9) in both languages. The currency code is LTR; components isolate it with <bdi>.
 */
export function formatMoney(minor: number, code: string, _locale: 'en' | 'ar'): string {
  if (!Number.isInteger(minor)) throw new Error(`Money must be an integer count of minor units: ${minor}`);
  const digits = minorDigitsOf(code);
  const sign = minor < 0 ? '-' : '';
  const raw = Math.abs(minor).toString().padStart(digits + 1, '0');
  const whole = raw.slice(0, raw.length - digits);
  const fraction = raw.slice(raw.length - digits);
  const grouped = new Intl.NumberFormat('en-US', { useGrouping: true }).format(Number(whole));
  const amount = digits > 0 ? `${grouped}.${fraction}` : grouped;
  return `${sign}${code} ${amount}`;
}
