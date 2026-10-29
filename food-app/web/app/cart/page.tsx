import { cookies } from 'next/headers';
import { t, type Locale } from '@/lib/i18n.ts';
import { CartEditor } from '@/components/CartEditor';

export default async function CartPage() {
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  return (
    <>
      <h1>{t(locale).cart}</h1>
      <CartEditor locale={locale} />
    </>
  );
}
