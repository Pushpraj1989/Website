'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import { Icon } from '@/components/Icon';

export type HeroSlide = {
  id: string;
  media: { kind: string; url: string } | null;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  colour: string | null;
  seconds: number;
  href: string;
};

// The top of the home page, as in the app: the photo runs edge to edge, with the restaurant's address and the dish
// search on it, and the slide's words and button at its foot. Slides change on their own after each one's time;
// the pause button stops them (they also stop while the pointer or focus is on the hero, and never move when the
// visitor asks for less motion).
export function HeroSlider({ slides, locale, address }: { slides: HeroSlide[]; locale: Locale; address: string }) {
  const s = t(locale);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    if (slides.length < 2 || paused || hold) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), Math.max(3, slide.seconds) * 1000);
    return () => clearTimeout(timer);
  }, [index, paused, hold, slides.length, slide.seconds]);

  return (
    <section
      className="hero" aria-roledescription="carousel" aria-label={slide.title}
      onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}
    >
      {slides.map((sl, i) => (
        <div key={sl.id} className={i === index ? 'hero-media on' : 'hero-media'} aria-hidden="true" style={{ '--hero': sl.colour ?? 'var(--color-accent)' } as React.CSSProperties}>
          {sl.media?.kind === 'video' ? <video src={sl.media.url} autoPlay muted loop playsInline /> : sl.media ? <img src={sl.media.url} alt="" /> : null}
        </div>
      ))}
      <div className="hero-shade" aria-hidden="true" />

      <div className="hero-top">
        {address ? <span className="hero-pin"><Icon name="pin" size={16} />{address}</span> : null}
      </div>

      <form className="hero-search" action="/menu" method="get" role="search">
        <Icon name="search" />
        <input id="hero-q" name="q" type="search" aria-label={s.searchDishes} placeholder={s.searchDishes} autoComplete="off" enterKeyHint="search" />
      </form>

      <div className="hero-foot" aria-live={paused ? 'polite' : 'off'}>
        {slide.kicker ? <span className="hero-kicker">{slide.kicker}</span> : null}
        <h1 className="hero-title">{slide.title}</h1>
        {slide.body ? <p className="hero-body">{slide.body}</p> : null}
        <div className="hero-actions">
          <Link className="btn hero-cta" href={slide.href}>{slide.cta}</Link>
          {slides.length > 1 ? (
            <div className="hero-dots">
              {slides.map((sl, i) => (
                <button key={sl.id} type="button" className={i === index ? 'dot on' : 'dot'} aria-label={s.slideOf(i + 1, slides.length)} aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)} />
              ))}
              <button type="button" className="hero-pause" aria-label={paused ? s.play : s.pause} onClick={() => setPaused((p) => !p)}>
                <Icon name={paused ? 'play' : 'pause'} size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
