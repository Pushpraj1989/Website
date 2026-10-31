import Link from 'next/link';
import * as data from '@/lib/data.ts';
import { currentGuestId } from '@/lib/http.ts';
import { t, type Locale } from '@/lib/i18n.ts';
import { getSettings } from '@/lib/restaurant-settings.ts';
import { Icon } from '@/components/Icon';
import { CartIcon, LanguageButton } from '@/components/SiteNav';

// The top bar: the restaurant (back to the home page), then icons for the menu, the cart (with how many items are in
// it, kept up to date as dishes are added) and the other language, which returns to the same page. Each icon has a
// spoken name and a tooltip. Staff sign-in is in the footer, away from customers' path.
export async function Header({ locale }: { locale: Locale }) {
  const settings = await getSettings();
  const s = t(locale, settings.businessType);
  const shop = settings.businessType === 'shop';
  const guestId = await currentGuestId();
  const count = guestId ? (await data.getCart(guestId)).reduce((n, l) => n + l.qty, 0) : 0;
  const name = settings.name[locale];
  return (
    <header className="header">
      <Link className="brand" href="/">
        {settings.logoUrl ? <img className="brand-logo" src={settings.logoUrl} alt="" /> : <span className="brand-mark" aria-hidden="true">{name.slice(0, 1)}</span>}
        <span>{name}</span>
      </Link>
      <nav className="icon-nav" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main'}>
        <Link className="icon-btn" href="/menu" aria-label={s.menu} title={s.menu}><Icon name={shop ? 'shop' : 'menu'} /></Link>
        <CartIcon locale={locale} initial={count} />
        <LanguageButton locale={locale} />
      </nav>
    </header>
  );
}
