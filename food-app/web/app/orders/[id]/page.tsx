import { cookies } from 'next/headers';
import { t, type Locale } from '@/lib/i18n.ts';
import { OrderView } from '@/components/OrderView';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  return (
    <>
      <h1>{t(locale).orderStatus}</h1>
      <OrderView id={id} locale={locale} />
    </>
  );
}
