import { cookies } from 'next/headers';
import { t, type Locale } from '@/lib/i18n.ts';
import { AdminLogin } from '@/components/AdminLogin';

export default async function AdminLoginPage() {
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  return (
    <>
      <h1>{t(locale).adminLogin}</h1>
      <AdminLogin locale={locale} />
    </>
  );
}
