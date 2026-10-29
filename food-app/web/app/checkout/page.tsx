import { cookies } from 'next/headers';
import { t, type Locale } from '@/lib/i18n.ts';
import { CheckoutForm } from '@/components/CheckoutForm';

export default async function CheckoutPage() {
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  return (
    <>
      <h1>{t(locale).checkout}</h1>
      <CheckoutForm locale={locale} />
    </>
  );
}
