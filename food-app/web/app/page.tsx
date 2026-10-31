import Link from 'next/link';
import * as data from '@/lib/data.ts';
import { currentLocale } from '@/lib/http.ts';
import { initialOf, t } from '@/lib/i18n.ts';
import { livePromotions } from '@/lib/gallery.ts';
import { getSettings } from '@/lib/restaurant-settings.ts';
import { DishCard } from '@/components/DishCard';
import { HeroSlider, type HeroSlide } from '@/components/HeroSlider';
import { Carousel } from '@/components/Carousel';
import { WelcomeOffer, type WelcomePromo } from '@/components/WelcomeOffer';

export const dynamic = 'force-dynamic';

type Promo = Awaited<ReturnType<typeof livePromotions>>['carousel'][number];

// The home page, laid out like the app's home: the hero with the address and search, the categories, the offer
// strip, the offers that slide sideways, the popular dishes, the spotlight promotions and then the menu. Every part
// comes from the restaurant's own settings, menu and published promotions; a part with nothing to show is left out.
export default async function Home() {
  const locale = await currentLocale();
  const s = t(locale);
  const [settings, restaurant, categories, live] = await Promise.all([getSettings(), data.getRestaurant(), data.getMenu(), livePromotions()]);
  const name = settings.name[locale];
  const items = categories.flatMap((c) => c.items);
  const linkFor = (p: Promo) => (p.menuItemId ? `/menu#dish-${p.menuItemId}` : '/menu');

  const slides: HeroSlide[] = live.hero.length
    ? live.hero.map((p) => ({
        id: p.id, media: p.media, kicker: p.kicker[locale], title: p.title[locale], body: p.body[locale],
        cta: p.cta[locale] || s.orderNow, colour: p.look.colour, seconds: p.look.durationSeconds, href: linkFor(p),
      }))
    : [{ id: 'welcome', media: null, kicker: '', title: s.welcomeTitle(name), body: settings.tagline[locale] || s.welcomeLine, cta: s.orderNow, colour: null, seconds: 6, href: '/menu' }];

  // Best rated first, then dishes with a photo, so the row looks like a menu worth ordering from.
  const popular = [...items.filter((i) => !i.soldOut)]
    .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0) || Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)))
    .slice(0, 8);
  const welcome = live.welcome as WelcomePromo | null;
  const strip = live.strip;

  return (
    <div className="home">
      <HeroSlider slides={slides} locale={locale} address={settings.address[locale]} />

      {categories.length ? (
        <nav className="chips" aria-label={s.categories}>
          {categories.map((c) => (
            <Link key={c.id} className="chip" href={`/menu#${c.id}`}>
              {c.items.find((i) => i.imageUrl) ? <img src={c.items.find((i) => i.imageUrl)!.imageUrl!} alt="" /> : <span className="chip-letter" aria-hidden="true">{initialOf(c.name[locale])}</span>}
              {c.name[locale]}
            </Link>
          ))}
        </nav>
      ) : null}

      {strip ? (
        <Link className="strip" href={linkFor(strip)} style={{ '--strip': strip.look.colour ?? 'var(--color-accent)' } as React.CSSProperties}>
          <strong>{strip.title[locale]}</strong>
          {strip.offer?.code ? <span className="strip-code">{s.useCode(strip.offer.code)}</span> : strip.body[locale] ? <span>{strip.body[locale]}</span> : null}
        </Link>
      ) : null}

      {live.carousel.length ? (
        <Carousel id="offers-h" title={s.offersForYou} previous={s.previous} next={s.next}>
          {live.carousel.map((p) => (
            <Link key={p.id} href={linkFor(p)} className="offer-card" style={{ '--offer': p.look.colour ?? 'var(--color-accent)' } as React.CSSProperties}>
              {p.media ? (p.media.kind === 'video' ? <video src={p.media.url} autoPlay muted loop playsInline aria-hidden="true" /> : <img src={p.media.url} alt="" />) : null}
              <span className="offer-words">
                {p.kicker[locale] ? <span className="offer-kicker">{p.kicker[locale]}</span> : null}
                <strong>{p.title[locale]}</strong>
                {p.body[locale] ? <span>{p.body[locale]}</span> : null}
                {p.offer?.code ? <span className="offer-code">{s.useCode(p.offer.code)}</span> : null}
              </span>
            </Link>
          ))}
        </Carousel>
      ) : null}

      {popular.length ? (
        <Carousel id="popular-h" title={s.popular} action={<Link href="/menu">{s.seeFullMenu}</Link>} previous={s.previous} next={s.next} kind="tiles">
          {popular.map((item) => <DishCard key={item.id} item={item} locale={locale} currency={restaurant.currency} layout="tile" anchor={false} />)}
        </Carousel>
      ) : null}

      {live.midFeed.map((p) => (
        <Link key={p.id} href={linkFor(p)} className={`spotlight size-${p.look.size}`} style={{ '--offer': p.look.colour ?? 'var(--color-accent)' } as React.CSSProperties}>
          {p.media ? (p.media.kind === 'video' ? <video src={p.media.url} autoPlay muted loop playsInline aria-hidden="true" /> : <img src={p.media.url} alt="" />) : null}
          <span className="spotlight-words">
            {p.kicker[locale] ? <span className="offer-kicker">{p.kicker[locale]}</span> : null}
            <strong>{p.title[locale]}</strong>
            {p.body[locale] ? <span>{p.body[locale]}</span> : null}
            <span className="btn spotlight-cta">{p.cta[locale] || s.orderNow}</span>
          </span>
        </Link>
      ))}

      {categories.map((category) => (
        <section key={category.id} className="home-section" aria-labelledby={`home-${category.id}`}>
          <div className="section-head">
            <h2 id={`home-${category.id}`}>{category.name[locale]}</h2>
          </div>
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
