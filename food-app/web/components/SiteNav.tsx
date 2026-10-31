'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import { Icon } from '@/components/Icon';
import { CART_CHANGED } from '@/components/AddToCart';

/** The language button. It returns to the page the visitor is on, not to the menu. */
export function LanguageButton({ locale }: { locale: Locale }) {
  const s = t(locale);
  const pathname = usePathname();
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  const [next, setNext] = useState(pathname ?? '/');
  useEffect(() => setNext(`${window.location.pathname}${window.location.search}`), [pathname]);
  return (
    <form action="/set-locale" method="post">
      <input type="hidden" name="lang" value={other} />
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="icon-btn" lang={other} aria-label={s.switchLanguage} title={s.switchLanguage}><Icon name="globe" /></button>
    </form>
  );
}

/** The cart icon in the header. Its count follows the cart as dishes are added, without reloading the page. */
export function CartIcon({ locale, initial }: { locale: Locale; initial: number }) {
  const s = t(locale);
  const [count, setCount] = useState(initial);
  useEffect(() => {
    const onChange = (e: Event) => {
      const lines = (e as CustomEvent<{ lines?: { qty: number }[] }>).detail?.lines;
      if (lines) setCount(lines.reduce((n, l) => n + l.qty, 0));
    };
    window.addEventListener(CART_CHANGED, onChange);
    return () => window.removeEventListener(CART_CHANGED, onChange);
  }, []);
  return (
    <Link className="icon-btn" href="/cart" aria-label={count ? `${s.cart}, ${count}` : s.cart} title={s.cart}>
      <Icon name="bag" />
      {count ? <span className="count" aria-hidden="true">{count}</span> : null}
    </Link>
  );
}

/** On phones, as in the app: a floating rounded dock. The open page's item shows its name on a tinted pill; the
 *  others show the icon, with the name kept for screen readers. (The app's Orders and Account need an app account.) */
export function BottomDock({ locale }: { locale: Locale }) {
  const s = t(locale);
  const pathname = usePathname() ?? '/';
  if (/^\/(admin|checkout|orders)/.test(pathname)) return null;
  const items = [
    { href: '/', label: s.home, icon: 'home', on: pathname === '/' },
    { href: '/menu', label: s.menu, icon: 'menu', on: pathname.startsWith('/menu') },
    { href: '/cart', label: s.cart, icon: 'bag', on: pathname.startsWith('/cart') },
  ];
  return (
    <nav className="dock" aria-label={locale === 'ar' ? 'التنقل السفلي' : 'Bottom'}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.on ? 'dock-item on' : 'dock-item'} aria-current={i.on ? 'page' : undefined}>
          {i.on ? (
            <span className="dock-pill"><Icon name={i.icon} size={22} /><span>{i.label}</span></span>
          ) : (
            <><Icon name={i.icon} size={22} /><span className="sr">{i.label}</span></>
          )}
        </Link>
      ))}
    </nav>
  );
}
