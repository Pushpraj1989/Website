import React from 'react';
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, MONO, BRAND } from './theme';
import { LogoMark, Pill, usePortrait, Words } from './components';
import { clamp, easeInOut, pop, progress, rise, sceneFade, typed } from './motion';
import { loadFonts } from './fonts';

loadFonts();

// The back-office film: the admin console as the hero. Every clip is a real recording of the console being used
// (sped up), every still a real screenshot; the business is the demo salon.

const BG = '#0B0A09';
const DARK = { cream: '#FFFBF3', ink: '#F5F5F4', muted: '#A8A29E', line: '#2A2623', card: '#171412', accent: '#F472B6', amber: '#F59E0B', saffron: '#F6B93B', chilli: '#DC2626' };
const GLOW = '#DB2777';

type Chapter = { title: string; body: string; src: string; seconds: number; still?: boolean };
const CHAPTERS: Chapter[] = [
  { title: 'Take orders *live*', body: 'Every new order rings in. Accept it, set the time, move it to ready.', src: 'salon/console/orders.mp4', seconds: 6 },
  { title: 'Ship by *courier*', body: 'Mark it shipped with the courier and tracking number. The customer sees it in the app.', src: 'backoffice/ship.mp4', seconds: 7 },
  { title: 'Returns and *refunds*', body: 'Approve a return, put the item back in stock, refund to the card or by hand.', src: 'backoffice/returns.mp4', seconds: 5 },
  { title: 'Products and *stock*', body: 'Name, price, photo, and options like shades or sizes, each with its own stock.', src: 'salon/console/product.mp4', seconds: 13 },
  { title: 'Coupons in *seconds*', body: 'A code, a discount, a minimum spend, a cap and dates. Live as soon as you save.', src: 'salon/console/coupon.mp4', seconds: 8 },
  { title: 'Run *campaigns*', body: 'Group your offers, set a budget and dates, add a rule and a code, then start it.', src: 'salon/console/campaign.mp4', seconds: 10 },
  { title: 'Own your *home screen*', body: 'Pop-ups, banners and carousels with your photos, linked to your offers.', src: 'salon/console/popup.mp4', seconds: 9 },
  { title: 'Your brand, *your look*', body: 'Restaurant or shop, brand colour, theme and button style. The app follows.', src: 'backoffice/brand.mp4', seconds: 8 },
  { title: 'Know your *numbers*', body: 'Sales, orders, average order, new and returning customers, by day, week or month.', src: 'backoffice/dashboard.jpg', seconds: 4.5, still: true },
];
const HOLD = 24;
const chapterFrames = (c: Chapter) => Math.round(c.seconds * 30) + (c.still ? 30 : HOLD);

const SECTIONS = ['Dashboard', 'Live orders', 'Returns', 'Products', 'Categories', 'Home and pop-ups', 'Offers and codes', 'Voucher campaigns', 'Voucher designs', 'Shipping', 'Delivery areas', 'Business and look'];
const WALL = ['dashboard', 'orders', 'returns', 'products', 'offers', 'campaigns', 'promotions', 'shipping', 'restaurant', 'appearance', 'designs', 'categories'];

export const BO_PARTS: [string, number][] = [
  ['hook', 150],
  ['overview', 180],
  ...CHAPTERS.map((c, i) => [`ch${i}`, chapterFrames(c)] as [string, number]),
  ['wall', 180],
  ['end', 180],
];
export const BO_LENGTH = BO_PARTS.reduce((n, [, f]) => n + f, 0);
const STARTS: Record<string, number> = {};
BO_PARTS.reduce((t, [id, f]) => { STARTS[id] = t; return t + f; }, 0);
export const BO_STARTS = STARTS;

// ---------- pieces ----------
const Rich: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div style={style}>{text.split(/(\*[^*]+\*)/).map((p, j) => p.startsWith('*') ? <span key={j} style={{ color: C.accent }}>{p.slice(1, -1)}</span> : <span key={j}>{p}</span>)}</div>
);

const Browser: React.FC<{ width: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ width, children, style }) => {
  const bar = Math.round(width * 0.028);
  return (
    <div style={{ width, borderRadius: Math.round(width * 0.012), overflow: 'hidden', background: '#fff', boxShadow: `0 60px 120px rgba(0,0,0,.6), 0 0 0 1px #3a3430, 0 0 140px ${GLOW}33`, ...style }}>
      <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: bar * 0.3, padding: `0 ${bar * 0.5}px`, background: '#1F1B18' }}>
        {['#ef4444', '#f59e0b', '#22c55e'].map((c) => <i key={c} style={{ width: bar * 0.32, height: bar * 0.32, borderRadius: 99, background: c, display: 'block' }} />)}
        <span style={{ marginLeft: bar * 0.4, padding: `${bar * 0.08}px ${bar * 0.6}px`, borderRadius: 99, background: '#2A2522', fontFamily: MONO, fontSize: bar * 0.38, color: '#A8A29E' }}>yourbusiness.com/console</span>
      </div>
      <div style={{ width, height: (width * 900) / 1440, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
  );
};

// ---------- scenes ----------
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const swap = 66;
  const out = progress(frame, swap - 10, 10);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 70px' }}>
      {frame < swap ? (
        <div style={{ opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
          <Words text={portrait ? 'Customers see\nthe *app.*' : 'Customers see the *app.*'} start={4} gap={6} size={portrait ? 116 : 124} />
        </div>
      ) : (
        <Words text={portrait ? 'You run it\nfrom *here.*' : 'You run it from *here.*'} start={swap + 2} gap={6} size={portrait ? 116 : 124} />
      )}
    </AbsoluteFill>
  );
};

const Overview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const enter = progress(frame, 0, 26);
  const zoom = interpolate(frame, [20, 180], [1, 1.05], { ...clamp, easing: easeInOut });
  return (
    <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 40 : 70, padding: portrait ? '60px 40px 0' : '0 60px' }}>
      <div style={{ width: portrait ? 980 : 520, fontFamily: FONT, color: C.ink, textAlign: portrait ? 'center' : 'left' }}>
        <Rich text="One console. *Everything.*" style={{ fontSize: portrait ? 84 : 84, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.02, ...rise(frame, 2) }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 30, justifyContent: portrait ? 'center' : 'flex-start' }}>
          {SECTIONS.map((t, i) => (
            <span key={t} style={{ transform: `scale(${pop(frame, 24 + i * 5, fps, 15)})`, display: 'inline-block' }}>
              <Pill size={portrait ? 24 : 22} style={{ background: '#211C19', color: '#E7E5E4', border: '1px solid #3A3430' }}>{t}</Pill>
            </span>
          ))}
        </div>
      </div>
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 80}px) perspective(2000px) rotateY(${portrait ? 0 : -8 + 8 * progress(frame, 0, 60)}deg)` }}>
        <Browser width={portrait ? 1000 : 1180}><Img src={staticFile('backoffice/dashboard.jpg')} style={{ width: '100%', transform: `scale(${zoom})`, transformOrigin: '20% 20%' }} /></Browser>
      </div>
    </AbsoluteFill>
  );
};

const ChapterScene: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const c = CHAPTERS[i];
  const len = Math.round(c.seconds * 30);
  const enter = progress(frame, 0, 22);
  const w = portrait ? 1010 : 1300;
  const media = c.still ? (
    <Img src={staticFile(c.src)} style={{ width: '100%', transform: `scale(${interpolate(frame, [10, len + 30], [1, 1.14], { ...clamp, easing: easeInOut })})`, transformOrigin: '30% 25%' }} />
  ) : (
    <>
      <Sequence from={0} durationInFrames={len} layout="none"><OffthreadVideo src={staticFile(c.src)} muted style={{ width: '100%', display: 'block' }} /></Sequence>
      {frame >= len && <Freeze frame={len - 1}><OffthreadVideo src={staticFile(c.src)} muted style={{ width: '100%', display: 'block' }} /></Freeze>}
    </>
  );
  return (
    <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 50 : 60, padding: portrait ? '30px 35px 0' : '0 40px' }}>
      <div style={{ width: portrait ? 980 : 470, fontFamily: FONT, color: C.ink, textAlign: portrait ? 'center' : 'left' }}>
        <div style={{ fontFamily: MONO, fontSize: portrait ? 30 : 28, color: C.accent, letterSpacing: '0.1em', ...rise(frame, 0) }}>{String(i + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}</div>
        <Rich text={c.title} style={{ fontSize: portrait ? 76 : 76, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.02, marginTop: 14, ...rise(frame, 4) }} />
        <div style={{ fontSize: portrait ? 34 : 32, color: C.muted, marginTop: 20, lineHeight: 1.4, ...rise(frame, 12) }}>{c.body}</div>
      </div>
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 70}px) scale(${0.96 + 0.04 * enter})` }}>
        <Browser width={w}>{media}</Browser>
      </div>
    </AbsoluteFill>
  );
};

/** A wall of every console screen, drifting, then the line. */
const Wall: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = usePortrait();
  const cols = portrait ? 3 : 4;
  const tw = portrait ? 420 : 520;
  const th = (tw * 900) / 1440;
  const gap = 26;
  const gridW = cols * tw + (cols - 1) * gap;
  const rows = Math.ceil(WALL.length / cols);
  const gridH = rows * th + (rows - 1) * gap;
  const drift = interpolate(frame, [0, 180], [40, -40]);
  const text = progress(frame, 40, 22);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: (width - gridW) / 2, top: (height - gridH) / 2 + drift, transform: `perspective(2400px) rotateX(18deg) rotateZ(-6deg) scale(${portrait ? 1.15 : 1.08})`, opacity: 0.55 + 0.45 * (1 - text) }}>
        {WALL.map((p, i) => {
          const a = pop(frame, i * 3, 30, 16);
          return (
            <div key={p} style={{ position: 'absolute', left: (i % cols) * (tw + gap), top: Math.floor(i / cols) * (th + gap), width: tw, height: th, borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,.55)', opacity: Math.min(1, a * 1.4), transform: `translateY(${(1 - a) * 80}px)` }}>
              <Img src={staticFile(`backoffice/${p}.jpg`)} style={{ width: '100%' }} />
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(60% 50% at 50% 50%, ${BG}ee, ${BG}88 70%, transparent)`, opacity: text }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FONT, textAlign: 'center', opacity: text, transform: `scale(${0.94 + 0.06 * text})` }}>
        <Rich text={portrait ? 'Every section.' : 'Every section. One login.'} style={{ fontSize: portrait ? 100 : 110, fontWeight: 800, letterSpacing: '-0.05em', color: C.ink }} />
        {portrait && <Rich text="One *login.*" style={{ fontSize: 100, fontWeight: 800, letterSpacing: '-0.05em', color: C.ink }} />}
        <div style={{ fontSize: portrait ? 38 : 38, color: C.muted, marginTop: 20 }}>No developer needed to run your business.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const word = progress(frame, 12, 22);
  const tags = ['0% commission', 'No subscription', 'Free & open source'];
  const url = typed(BRAND.repo, frame, 56, 1.8);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FONT, textAlign: 'center' }}>
      <div style={{ position: 'absolute', width: 1400, height: 1000, borderRadius: '50%', background: `radial-gradient(closest-side, ${GLOW}44, transparent)`, filter: 'blur(60px)', opacity: word }} />
      <LogoMark size={portrait ? 220 : 200} start={0} onDark />
      <div style={{ fontWeight: 800, fontSize: portrait ? 100 : 116, letterSpacing: '-0.05em', lineHeight: 1, color: C.ink, marginTop: 24, opacity: word, transform: `translateY(${(1 - word) * 30}px)` }}>{BRAND.name}</div>
      <div style={{ fontWeight: 600, fontSize: portrait ? 50 : 52, letterSpacing: '-0.025em', color: C.accent, marginTop: 22, opacity: progress(frame, 24, 14) }}>Run your business from one console.</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
        {tags.map((t, i) => (
          <span key={t} style={{ transform: `scale(${pop(frame, 34 + i * 5, fps)})`, display: 'inline-block' }}>
            <Pill tone={i === 0 ? 'accent' : 'soft'} size={portrait ? 32 : 30} style={i === 0 ? { color: '#1C1917' } : { background: '#2A2623', color: '#F5F5F4' }}>{t}</Pill>
          </span>
        ))}
      </div>
      <div style={{ marginTop: 40, fontFamily: MONO, fontSize: portrait ? 32 : 36, color: C.ink, padding: '18px 28px', borderRadius: 18, background: '#171412', border: `1px solid ${C.line}`, minWidth: portrait ? 900 : 1040, opacity: progress(frame, 50, 8) }}>{url || ' '}</div>
    </AbsoluteFill>
  );
};

// ---------- film ----------
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const d = Math.sin(frame / 90) * 80;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, #1A1613 0%, ${BG} 60%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: width, height: height * 0.7, left: width * 0.35 + d, top: -height * 0.2, borderRadius: '50%', background: `radial-gradient(closest-side, ${GLOW}30, transparent)`, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', width: width * 0.8, height: height * 0.5, left: -width * 0.2 - d, top: height * 0.7, borderRadius: '50%', background: `radial-gradient(closest-side, #F59E0B1f, transparent)`, filter: 'blur(60px)' }} />
    </AbsoluteFill>
  );
};

export const BackOffice: React.FC = () => {
  Object.assign(C, DARK);
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const corner = interpolate(frame, [STARTS.overview + 20, STARTS.overview + 40, STARTS.end - 12, STARTS.end + 4], [0, 0.8, 0.8, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      {BO_PARTS.map(([id, frames], i) => {
        const node = id === 'hook' ? <Hook /> : id === 'overview' ? <Overview /> : id === 'wall' ? <Wall /> : id === 'end' ? <End /> : <ChapterScene i={Number(id.slice(2))} />;
        const last = i === BO_PARTS.length - 1;
        return (
          <Sequence key={id} from={STARTS[id]} durationInFrames={frames} name={id}>
            <FadeIn duration={frames} last={last}>{node}</FadeIn>
          </Sequence>
        );
      })}
      <div style={{ position: 'absolute', left: portrait ? 40 : 52, bottom: portrait ? 30 : 34, display: 'flex', alignItems: 'center', gap: 12, opacity: corner, fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.ink }}>
        <LogoMark size={38} onDark />{BRAND.name}
      </div>
    </AbsoluteFill>
  );
};

const FadeIn: React.FC<{ duration: number; last: boolean; children: React.ReactNode }> = ({ duration, last, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={sceneFade(frame, last ? duration + 100 : duration)}>{children}</AbsoluteFill>;
};
