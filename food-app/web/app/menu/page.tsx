import { cookies } from 'next/headers';
import { CATEGORIES, ITEMS, RESTAURANT } from '@/lib/seed.ts';
import { t, type Locale } from '@/lib/i18n.ts';
import { AddToCart } from '@/components/AddToCart';
import { Money } from '@/components/Money';

export default async function MenuPage() {
  const locale: Locale = (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
  const s = t(locale);
  const currency = RESTAURANT.pricing.currency;

  return (
    <>
      <h1>{s.menu}</h1>
      {CATEGORIES.map((category) => {
        const items = ITEMS.filter((item) => item.categoryId === category.id);
        return (
          <section key={category.id} aria-labelledby={category.id}>
            <h2 id={category.id}>{category.name[locale]}</h2>
            {items.length === 0 ? <p className="muted">{s.noOrders}</p> : null}
            {items.map((item) => (
              <article key={item.id} className={item.soldOut ? 'item sold' : 'item'}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-base)' }}>{item.name[locale]}</h3>
                  <p className="muted" style={{ margin: 'var(--space-1) 0 0' }}>{item.description[locale]}</p>
                  <p style={{ margin: 'var(--space-1) 0 0', fontWeight: 600 }}>
                    <Money minor={item.priceMinor} currency={currency} locale={locale} />
                  </p>
                </div>
                {item.soldOut ? (
                  <span className="badge danger">{s.soldOut}</span>
                ) : (
                  <AddToCart itemId={item.id} label={`${s.addToCart}: ${item.name[locale]}`} addLabel={s.addToCart} />
                )}
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}
