import Link from 'next/link';
import * as data from '@/lib/data.ts';
import { currentLocale } from '@/lib/http.ts';
import { t } from '@/lib/i18n.ts';
import { DishCard } from '@/components/DishCard';
import { Icon } from '@/components/Icon';
import { WelcomeOffer, type WelcomePromo } from '@/components/WelcomeOffer';
import { livePromotions } from '@/lib/gallery.ts';

// The menu, as in the app: a search box, the categories as tabs that stay at the top while the page scrolls, and each
// dish as a card with its photo and an Add button on it. ?q= narrows the dishes to those whose name or description
// holds the words, in either language. ?filter=available or ?filter=under keeps the dishes the home's filter chips
// name, by the app's same rules: not sold out, or priced under 20.
const FILTERS = {
  available: (i: { soldOut: boolean }) => !i.soldOut,
  under: (i: { priceMinor: number }) => i.priceMinor < 2000,
} as const;

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const locale = await currentLocale();
  const s = t(locale);
  const params = await searchParams;
  const q = String(params.q ?? '').trim().slice(0, 60);
  const filter = params.filter === 'available' || params.filter === 'under' ? params.filter : null;
  const filterLabel = filter === 'available' ? s.filterAvailable : filter === 'under' ? s.filterUnder : '';
  const [restaurant, all, live] = await Promise.all([data.getRestaurant(), data.getMenu(), livePromotions()]);
  const welcome = live.welcome as WelcomePromo | null;
  const words = q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every((w) => text.toLocaleLowerCase().includes(w));
  const keep = filter ? FILTERS[filter] : () => true;
  const categories = words.length || filter
    ? all
        .map((c) => ({ ...c, items: c.items.filter((i) => keep(i) && (!words.length || matches(`${i.name.en} ${i.name.ar} ${i.description.en} ${i.description.ar} ${c.name.en} ${c.name.ar}`))) }))
        .filter((c) => c.items.length)
    : all;
  const found = categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="menu-page">
      <div className="menu-head">
        <h1>{s.menu}</h1>
        <form className="search" action="/menu" method="get" role="search">
          <Icon name="search" />
          {filter ? <input type="hidden" name="filter" value={filter} /> : null}
          <input id="menu-q" name="q" type="search" aria-label={s.searchDishes} defaultValue={q} placeholder={s.searchDishes} autoComplete="off" enterKeyHint="search" />
          <button type="submit" className="btn">{s.search}</button>
        </form>
        {q ? (
          <p className="muted" role="status">
            {found ? s.resultsFor(found, q) : s.noResults(q)} · <Link href="/menu">{s.clearSearch}</Link>
          </p>
        ) : null}
        {filter ? (
          <p className="muted" role="status">
            {s.showingFilter(filterLabel)} · <Link href="/menu">{s.clearSearch}</Link>
          </p>
        ) : null}
      </div>

      {categories.length > 1 ? (
        <nav className="tabs" aria-label={s.categories}>
          {categories.map((c) => <a key={c.id} href={`#${c.id}`}>{c.name[locale]}</a>)}
        </nav>
      ) : null}

      {categories.map((category) => (
        <section key={category.id} className="menu-section" aria-labelledby={category.id}>
          <h2 id={category.id}>{category.name[locale]}</h2>
          <div className="dish-list">
            {category.items.map((item) => <DishCard key={item.id} item={item} locale={locale} currency={restaurant.currency} />)}
          </div>
        </section>
      ))}

      {welcome ? (
        <WelcomeOffer
          promo={welcome}
          locale={locale}
          words={{
            validOn: s.validOn, allDishes: s.allDishes, selectedDishes: s.selectedDishes, minSpend: s.minSpend, maxSaving: s.maxSaving,
            validUntil: s.validUntil, noLimit: s.noLimit, orderNow: s.orderNow, close: s.close,
            daysLeft: welcome.offer ? s.daysLeft(welcome.offer.daysLeft) : '', useCode: welcome.offer?.code ? s.useCode(welcome.offer.code) : '',
          }}
        />
      ) : null}
    </div>
  );
}
