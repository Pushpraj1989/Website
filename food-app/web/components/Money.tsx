import { formatMoney } from '@/lib/money.ts';
import type { Locale } from '@/lib/i18n.ts';

// Renders an amount with the currency code isolated, so an LTR code keeps its place inside Arabic text.
export function Money({ minor, currency, locale }: { minor: number; currency: string; locale: Locale }) {
  const text = formatMoney(minor, currency, locale);
  const code = currency;
  const rest = text.slice(text.indexOf(' ') + 1);
  const sign = text.startsWith('-') ? '-' : '';
  return (
    <span className="price">
      {sign}
      <bdi>{code}</bdi> {rest}
    </span>
  );
}
