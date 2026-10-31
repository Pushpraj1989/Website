'use client';

import { LoopVideo } from '@/components/LoopVideo';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

// The welcome pop-up staff published in the admin, as on the app: it arrives the way they chose (slide from any
// side, zoom or fade), at the size and in the frame they chose, as often as they chose (every visit, once a day, or
// only once, remembered in this browser). The offer's terms are the server's, worked out from the offer itself.
type Localised = { en: string; ar: string };
export type WelcomePromo = {
  id: string;
  title: Localised;
  body: Localised;
  cta: Localised;
  media: { url: string; kind: string; posterUrl?: string | null } | null;
  offer: { headline: Localised; code: string | null; minSpendMinor: number; maxSavingMinor: number | null; currency: string; endsAt: string; daysLeft: number; appliesTo: string } | null;
  look: { animation: string; size: string; frame: string; colour: string | null; frequency: string };
};
type Words = { validOn: string; allDishes: string; selectedDishes: string; minSpend: string; maxSaving: string; validUntil: string; noLimit: string; orderNow: string; close: string; daysLeft: string; useCode: string };

function due(promo: WelcomePromo): boolean {
  try {
    const key = `welcome_${promo.id}`;
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(key);
    const show = promo.look.frequency === 'every_open' ? sessionStorage.getItem(key) === null : promo.look.frequency === 'once' ? last === null : last !== today;
    if (show) {
      localStorage.setItem(key, today);
      sessionStorage.setItem(key, '1');
    }
    return show;
  } catch {
    // Storage blocked: show it, since there is no way to remember.
    return true;
  }
}

export function WelcomeOffer({ promo, locale, words }: { promo: WelcomePromo; locale: 'en' | 'ar'; words: Words }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (due(promo)) setOpen(true);
  }, [promo]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const money = (minor: number, currency: string) => `${currency} ${(minor / 100).toFixed(2)}`;
  const offer = promo.offer;
  const title = promo.title[locale] || offer?.headline[locale] || '';
  const colour = promo.look.colour ?? 'var(--color-accent)';
  return (
    <dialog
      ref={dialog}
      className={`welcome size-${promo.look.size} anim-${promo.look.animation}`}
      aria-labelledby="welcome-title"
      onClose={() => setOpen(false)}
      onClick={(e) => { if (e.target === dialog.current) setOpen(false); }}
    >
      <div className="welcome-inner">
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={words.close} title={words.close}><Icon name="x" /></button>
        <h2 id="welcome-title">{title}</h2>
        {promo.body[locale] ? <p className="muted">{promo.body[locale]}</p> : null}
        <div className={`ticket frame-${promo.look.frame}`} style={{ '--ticket': colour } as React.CSSProperties}>
          {promo.media ? (promo.media.kind === 'video' ? <LoopVideo src={promo.media.url} poster={promo.media.posterUrl} /> : <img src={promo.media.url} alt="" />) : <b>{offer?.headline[locale]}</b>}
        </div>
        {offer ? (
          <>
            <p className="days">{words.daysLeft}</p>
            {offer.code ? <p className="muted">{words.useCode}</p> : null}
            <dl className="facts">
              <div><dt><Icon name="basket" />{words.validOn}</dt><dd>{offer.appliesTo === 'order' ? words.allDishes : words.selectedDishes}</dd></div>
              <div><dt><Icon name="wallet" />{words.minSpend}</dt><dd>{offer.minSpendMinor ? money(offer.minSpendMinor, offer.currency) : words.noLimit}</dd></div>
              <div><dt><Icon name="coins" />{words.maxSaving}</dt><dd>{offer.maxSavingMinor !== null ? money(offer.maxSavingMinor, offer.currency) : words.noLimit}</dd></div>
              <div><dt><Icon name="calendar" />{words.validUntil}</dt><dd>{new Date(offer.endsAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short' })}</dd></div>
            </dl>
          </>
        ) : null}
        <button type="button" className="btn primary lg" onClick={() => setOpen(false)}>{promo.cta[locale] || words.orderNow}</button>
      </div>
    </dialog>
  );
}
