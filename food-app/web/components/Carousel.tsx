'use client';

import { useRef } from 'react';
import { Icon } from '@/components/Icon';

// A row of cards that scrolls sideways and snaps card by card, with previous and next buttons above it on wide
// screens, clear of the cards' words. Phones swipe. Nothing moves on its own, so there is nothing to pause.
// The section's heading row is drawn here too: the title, an optional link, then the two buttons.
export function Carousel({ id, title, action, previous, next, kind = 'offers', children }: { id: string; title: string; action?: React.ReactNode; previous: string; next: string; kind?: 'offers' | 'tiles'; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
    el.scrollBy({ left: dir * rtl * el.clientWidth * 0.85, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return (
    <section className={`home-section carousel kind-${kind}`} aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        <div className="row">
          {action}
          <span className="carousel-nav">
            <button type="button" className="carousel-btn" aria-label={previous} onClick={() => move(-1)}><Icon name="back" /></button>
            <button type="button" className="carousel-btn" aria-label={next} onClick={() => move(1)}><Icon name="chevron" /></button>
          </span>
        </div>
      </div>
      <div className="carousel-track" ref={track} tabIndex={0} role="group" aria-label={title}>{children}</div>
    </section>
  );
}
