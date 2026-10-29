import * as data from '@/lib/data.ts';
import { currentLocale } from '@/lib/http.ts';
import { t } from '@/lib/i18n.ts';
import { AddToCart } from '@/components/AddToCart';
import { Money } from '@/components/Money';

export default async function MenuPage() {
  const locale = await currentLocale();
  const s = t(locale);
  const [restaurant, categories] = await Promise.all([data.getRestaurant(), data.getMenu()]);

  return (
    <>
      <h1>{s.menu}</h1>
      {categories.map((category) => (
        <section key={category.id} aria-labelledby={category.id}>
          <h2 id={category.id}>{category.name[locale]}</h2>
          {category.items.map((item) => (
            <article key={item.id} className={item.soldOut ? 'item sold' : 'item'}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-base)' }}>{item.name[locale]}</h3>
                <p className="muted" style={{ margin: 'var(--space-1) 0 0' }}>{item.description[locale]}</p>
                <p style={{ margin: 'var(--space-1) 0 0', fontWeight: 600 }}>
                  <Money minor={item.priceMinor} currency={restaurant.currency} locale={locale} />
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
      ))}
    </>
  );
}
