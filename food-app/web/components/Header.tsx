import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n.ts';
import { RESTAURANT } from '@/lib/seed.ts';

export function Header({ locale }: { locale: Locale }) {
  const s = t(locale);
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  return (
    <header className="header">
      <Link className="brand" href="/menu">{RESTAURANT.name[locale]}</Link>
      <nav aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main'}>
        <Link href="/menu">{s.menu}</Link>
        <Link href="/cart">{s.cart}</Link>
        <Link href="/admin">{s.admin}</Link>
        <form action="/set-locale" method="post" style={{ display: 'inline' }}>
          <input type="hidden" name="lang" value={other} />
          <input type="hidden" name="next" value="/menu" />
          <button type="submit" className="linkish" lang={other}>{s.switchLanguage}</button>
        </form>
      </nav>
    </header>
  );
}
