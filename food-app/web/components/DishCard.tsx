import type { MenuItem } from '@/lib/data.ts';
import type { Locale } from '@/lib/i18n.ts';
import { initialOf, t } from '@/lib/i18n.ts';
import { AddToCart } from '@/components/AddToCart';
import { Money } from '@/components/Money';
import { Icon } from '@/components/Icon';

// One dish, as in the app: its photo with the Add button on it, then the name, rating, a short description and the
// price. "row" lays the photo beside the words (the menu); "tile" puts it on top (the popular dishes on the home).
// A dish without a photo shows its first letter on a soft panel in the brand colour.
// Only the menu's copy of a dish carries its anchor (#dish-…), so a dish shown twice on a page keeps one id.
export function DishCard({ item, locale, currency, layout = 'row', anchor = true }: { item: MenuItem; locale: Locale; currency: string; layout?: 'row' | 'tile'; anchor?: boolean }) {
  const s = t(locale);
  const name = item.name[locale];
  return (
    <article className={`dish ${layout}${item.soldOut ? ' sold' : ''}`} id={anchor ? `dish-${item.id}` : undefined}>
      <div className="dish-photo">
        {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="dish-letter" aria-hidden="true">{initialOf(name)}</span>}
        <div className="dish-add">
          {item.soldOut ? <span className="badge danger">{s.soldOut}</span> : <AddToCart itemId={item.id} label={`${s.addToCart}: ${name}`} addLabel={s.addToCart} />}
        </div>
      </div>
      <div className="dish-text">
        <h3>{name}</h3>
        {item.rating ? (
          <p className="rating" aria-label={s.ratedLabel(item.rating.average, item.rating.count)}>
            <span className={item.rating.average >= 4 ? 'score good' : 'score'} aria-hidden="true">{item.rating.average.toFixed(1)}<Icon name="star" size={12} /></span>
            <span className="muted" aria-hidden="true">{s.ratings(item.rating.count)}</span>
          </p>
        ) : null}
        {item.description[locale] ? <p className="dish-desc">{item.description[locale]}</p> : null}
        <p className="dish-price"><Money minor={item.priceMinor} currency={currency} locale={locale} /></p>
      </div>
    </article>
  );
}
