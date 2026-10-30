import Link from 'next/link';
import * as data from '@/lib/data.ts';
import { currentGuestId } from '@/lib/http.ts';
import { t, type Locale } from '@/lib/i18n.ts';
import { getSettings } from '@/lib/restaurant-settings.ts';
import { Icon } from '@/components/Icon';

// The top bar: the restaurant, then icons for the menu, the cart (with how many items are in it) and the other
// language. Each icon has a spoken name and a tooltip. Staff sign-in is in the footer, away from customers' path.
export async function Header({ locale }: { locale: Locale }) {
  const s = t(locale);
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  const settings = await getSettings();
  const guestId = await currentGuestId();
  const count = guestId ? (await data.getCart(guestId)).reduce((n, l) => n + l.qty, 0) : 0;
  const name = settings.name[locale];
  return (
    <header className="header">
      <Link className="brand" href="/menu">
        {settings.logoUrl ? <img className="brand-logo" src={settings.logoUrl} alt="" /> : <span className="brand-mark" aria-hidden="true">{name.slice(0, 1)}</span>}
        <span>{name}</span>
      </Link>
      <nav className="icon-nav" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main'}>
        <Link className="icon-btn" href="/menu" aria-label={s.menu} title={s.menu}><Icon name="menu" /></Link>
        <Link className="icon-btn" href="/cart" aria-label={count ? `${s.cart}, ${count}` : s.cart} title={s.cart}>
          <Icon name="bag" />
          {count ? <span className="count" aria-hidden="true">{count}</span> : null}
        </Link>
        <form action="/set-locale" method="post">
          <input type="hidden" name="lang" value={other} />
          <input type="hidden" name="next" value="/menu" />
          <button type="submit" className="icon-btn" lang={other} aria-label={s.switchLanguage} title={s.switchLanguage}><Icon name="globe" /></button>
        </form>
      </nav>
    </header>
  );
}
