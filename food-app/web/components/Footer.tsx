import Link from 'next/link';
import pkg from '../package.json' with { type: 'json' };
import { t, type Locale } from '@/lib/i18n.ts';
import { getSettings } from '@/lib/restaurant-settings.ts';

// The foot of every page: the restaurant's own name, contact, copyright and the website's release number, all from
// its settings and this build. Staff sign in from here.
export async function Footer({ locale }: { locale: Locale }) {
  const s = t(locale);
  const settings = await getSettings();
  const name = settings.name[locale];
  const year = new Date().getFullYear();
  const address = settings.address[locale];
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <strong>{name}</strong>
        {address || settings.phone ? <span>{[address, settings.phone].filter(Boolean).join(' · ')}</span> : null}
        <nav aria-label={locale === 'ar' ? 'روابط إضافية' : 'More links'}>
          <Link href="/menu">{s.menu}</Link>
          <Link href="/admin">{s.adminLogin}</Link>
        </nav>
        <span>{s.copyright(year, name)} {s.websiteVersion(pkg.version)}</span>
      </div>
    </footer>
  );
}
