import type { Metadata } from 'next';
import { getRestaurant } from '@/lib/data.ts';
import { cookies } from 'next/headers';
import './globals.css';
import { Header } from '@/components/Header';
import type { Locale } from '@/lib/i18n.ts';

// The page title is the restaurant's own name, from its settings.
export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await getRestaurant();
  return { title: restaurant.name.en, description: `Order from ${restaurant.name.en}` };
}

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
