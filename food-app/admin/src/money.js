// Money entry without floating point. "12.50" with 2 decimal places -> 1250. Shown the same way back.
export function parseMoney(text, digits) {
  const cleaned = String(text ?? '').trim().replace(/,/g, '');
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{0,${digits}})?$`);
  if (!pattern.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
}

export function formatMoney(minor, digits, code) {
  const sign = minor < 0 ? '-' : '';
  const raw = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = raw.slice(0, raw.length - digits);
  const fraction = raw.slice(raw.length - digits);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${code} ${digits ? `${grouped}.${fraction}` : grouped}`;
}
