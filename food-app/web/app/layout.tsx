import type { Metadata } from 'next';
import { getRestaurant } from '@/lib/data.ts';
import { cookies } from 'next/headers';
import { preload } from 'react-dom';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CartBar } from '@/components/CartBar';
import { BottomDock } from '@/components/SiteNav';
import type { Locale } from '@/lib/i18n.ts';
import { getSettings } from '@/lib/restaurant-settings.ts';
import { themeStyle } from '@/lib/theme.ts';

// The page title is the restaurant's own name, from its settings.
export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await getRestaurant();
  return { title: restaurant.name.en, description: `Order from ${restaurant.name.en}` };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  // The restaurant's own theme and colour, from its settings in the admin.
  const settings = await getSettings();
  // The text and heading fonts load first, so the page draws in them from the start.
  for (const font of locale === 'ar' ? ['NotoSansArabic-Variable'] : ['Roboto-Regular', 'Fraunces-Variable']) {
    preload(`/fonts/${font}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  }
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-theme={settings.theme} data-glass={String(settings.theme.startsWith('glass'))} style={themeStyle(settings.theme, settings.brandColor, settings.buttonStyle) as React.CSSProperties}>
      <body>
        <a className="skip" href="#main">{locale === 'ar' ? 'تخطي إلى المحتوى' : 'Skip to content'}</a>
        <Header locale={locale} />
        <main id="main" className="shell">{children}</main>
        <Footer locale={locale} />
        <CartBar locale={locale} />
        <BottomDock locale={locale} kind={settings.businessType} />
      </body>
    </html>
  );
}
