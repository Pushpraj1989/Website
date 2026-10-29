import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { isStaff } from '@/lib/http.ts';
import { t, type Locale } from '@/lib/i18n.ts';
import { AdminBoard } from '@/components/AdminBoard';

export default async function AdminPage() {
  if (!(await isStaff())) redirect('/admin/login');
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  return (
    <>
      <h1>{t(locale).adminBoard}</h1>
      <AdminBoard locale={locale} />
    </>
  );
}
