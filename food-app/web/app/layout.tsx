import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Header } from '@/components/Header';
import type { Locale } from '@/lib/i18n.ts';

export const metadata: Metadata = { title: 'Sample Kitchen', description: 'Order from Sample Kitchen' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <a className="skip" href="#main">{locale === 'ar' ? 'تخطي إلى المحتوى' : 'Skip to content'}</a>
        <Header locale={locale} />
        <main id="main" className="shell">{children}</main>
      </body>
    </html>
  );
}
