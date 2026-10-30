import * as data from '@/lib/data.ts';
import { currentLocale } from '@/lib/http.ts';
import { t } from '@/lib/i18n.ts';
import { AddToCart } from '@/components/AddToCart';
import { Money } from '@/components/Money';
import { Icon } from '@/components/Icon';
import { WelcomeOffer, type WelcomePromo } from '@/components/WelcomeOffer';
import { livePromotions } from '@/lib/gallery.ts';

export default async function MenuPage() {
  const locale = await currentLocale();
  const s = t(locale);
  const [restaurant, categories, live] = await Promise.all([data.getRestaurant(), data.getMenu(), livePromotions()]);
  const welcome = live.welcome as WelcomePromo | null;

  return (
    <>
      <h1>{s.menu}</h1>
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
      {categories.map((category) => (
        <section key={category.id} aria-labelledby={category.id}>
          <h2 id={category.id}>{category.name[locale]}</h2>
          {category.items.map((item) => (
            <article key={item.id} className={item.soldOut ? 'item sold' : 'item'}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-base)' }}>{item.name[locale]}</h3>
                {item.rating ? (
                  <p className="rating" aria-label={s.ratedLabel(item.rating.average, item.rating.count)}>
                    <span className={item.rating.average >= 4 ? 'score good' : 'score'} aria-hidden="true">{item.rating.average.toFixed(1)}<Icon name="star" size={12} /></span>
                    <span className="muted" aria-hidden="true">{s.ratings(item.rating.count)}</span>
                  </p>
                ) : null}
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
