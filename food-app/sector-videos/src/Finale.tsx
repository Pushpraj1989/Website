import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, MONO, BRAND } from './theme';
import { LogoMark, Phone, Pill, usePortrait, Words } from './components';
import { clamp, easeInOut, pop, progress, rise, sceneFade, typed } from './motion';
import { loadFonts } from './fonts';

loadFonts();

// The closing film: nine businesses, one after another, then all of them merging into one app and the brand.
// Dark and glossy on purpose: it is the "product" film that sits above the sector films. Every phone is a real capture
// of the app set up as that business (demo data).

const SECTORS = [
  { key: 'restaurant', title: 'Restaurants', name: 'restaurant', color: '#D97706' },
  { key: 'fashion', title: 'Fashion', name: 'fashion', color: '#64748B' },
  { key: 'beauty', title: 'Beauty', name: 'beauty', color: '#DB2777' },
  { key: 'supplements', title: 'Supplements', name: 'supplements', color: '#7C3AED' },
  { key: 'pharmacy', title: 'Pharmacies', name: 'pharmacy', color: '#0D9488' },
  { key: 'grocery', title: 'Groceries', name: 'grocery', color: '#16A34A' },
  { key: 'flowers', title: 'Florists', name: 'flower shop', color: '#E11D48' },
  { key: 'bakery', title: 'Bakeries', name: 'bakery', color: '#EA580C' },
  { key: 'cafe', title: 'Cafés', name: 'café', color: '#A16207' },
];
const shot = (key: string) => `finale/sector-${key}.jpg`;

const BG = '#0B0A09';
const DARK = { cream: '#FFFBF3', ink: '#F5F5F4', muted: '#A8A29E', line: '#2A2623', card: '#171412', accent: '#FB923C', amber: '#F59E0B', saffron: '#F6B93B', chilli: '#DC2626' };

export const FINALE_PARTS = [
  ['hook', 150],
  ['parade', 84 * SECTORS.length],
  ['converge', 210],
  ['oneapp', 150],
  ['end', 180],
] as const;
export const FINALE_LENGTH = FINALE_PARTS.reduce((n, [, f]) => n + f, 0);
const STARTS: Record<string, number> = {};
FINALE_PARTS.reduce((t, [id, f]) => { STARTS[id] = t; return t + f; }, 0);

// ---------- Scenes ----------
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const swap = 72;
  const out = progress(frame, swap - 10, 10);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 70px' }}>
      {frame < swap ? (
        <div style={{ opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
          <Words text={portrait ? 'Every business\nneeds an *app.*' : 'Every business needs an *app.*'} start={4} gap={6} size={portrait ? 112 : 124} />
        </div>
      ) : (
        <Words text={portrait ? 'Without the\n*big* *tech* *bill.*' : 'Without the *big* *tech* *bill.*'} start={swap + 2} gap={6} size={portrait ? 112 : 124} />
      )}
    </AbsoluteFill>
  );
};

/** One sector: a colour glow, its name huge, its real app on a phone sweeping in. */
const SectorCard: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const isLast = i === SECTORS.length - 1;
  const portrait = usePortrait();
  const s = SECTORS[i];
  const inP = progress(frame, 0, 16);
  const outP = isLast ? progress(frame, 70, 14, easeInOut) : progress(frame, 84, 14, easeInOut);
  const phoneIn = progress(frame, 4, 22);
  const drift = interpolate(frame, [0, 98], [0, 1]);
  const phoneW = portrait ? 400 : 420;
  const title = (
    <div style={{ fontFamily: FONT, color: C.ink, textAlign: portrait ? 'center' : 'left', transform: `translateX(${(1 - inP) * 80 - outP * 60}px)`, opacity: inP * (1 - outP), filter: `blur(${(1 - inP) * 10 + outP * 10}px)` }}>
      <div style={{ fontFamily: MONO, fontSize: portrait ? 30 : 28, color: s.color, letterSpacing: '0.1em', filter: 'brightness(1.4)' }}>{String(i + 1).padStart(2, '0')} / {String(SECTORS.length).padStart(2, '0')}</div>
      <div style={{ fontSize: portrait ? 150 : 190, fontWeight: 800, letterSpacing: '-0.055em', lineHeight: 0.95, marginTop: 12 }}>{s.title}</div>
      <div style={{ fontSize: portrait ? 44 : 46, fontWeight: 600, color: C.muted, marginTop: 22 }}>
        Your <span style={{ color: s.color, filter: 'brightness(1.5)' }}>{s.name}</span> app, ready.
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: inP * (1 - outP) }}>
        <div style={{ position: 'absolute', width: 1500, height: 1500, borderRadius: '50%', left: portrait ? -210 : 1000 - drift * 120, top: portrait ? 500 : -260, background: `radial-gradient(closest-side, ${s.color}aa, ${s.color}33 55%, transparent)`, filter: 'blur(40px)' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 50 : 140, padding: portrait ? '40px 40px 0' : 0 }}>
        {title}
        <div style={{ perspective: 1600, opacity: phoneIn * (1 - outP) }}>
          <div style={{ transform: `translate(${(1 - phoneIn) * 260 - outP * 140}px, ${(1 - phoneIn) * 40 - drift * 24}px) rotateY(${-22 + 14 * phoneIn}deg) rotateZ(${(1 - phoneIn) * 6}deg)`, filter: `blur(${outP * 8}px) drop-shadow(0 40px 80px ${s.color}55)` }}>
            <Phone src={shot(s.key)} width={phoneW} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Parade: React.FC = () => (
  <AbsoluteFill>
    {SECTORS.map((s, i) => (
      <Sequence key={s.key} from={i * 84} durationInFrames={i === SECTORS.length - 1 ? 84 : 98}><SectorCard i={i} /></Sequence>
    ))}
  </AbsoluteFill>
);

/** All nine as a grid, then flying into one stack; the top one carries on into the next scene. */
const Converge: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = usePortrait();
  const gather = progress(frame, 104, 60, easeInOut);
  const phoneW = portrait ? 150 : 170;
  const final = 300;
  const cols = portrait ? 3 : 9;
  const gapX = portrait ? 250 : 196;
  const gapY = portrait ? 330 : 0;
  const rows = Math.ceil(SECTORS.length / cols);
  const label1 = progress(frame, 14, 18) * (1 - progress(frame, 96, 12));
  const label2 = progress(frame, 120, 18);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: portrait ? 70 : 90, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 800, letterSpacing: '-0.045em', color: C.ink, fontSize: portrait ? 96 : 104 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, opacity: label1, filter: `blur(${(1 - label1) * 8}px)` }}>Nine businesses.</div>
        <div style={{ position: 'absolute', left: 0, right: 0, opacity: label2, filter: `blur(${(1 - label2) * 8}px)` }}>One <span style={{ color: C.accent }}>solution.</span></div>
      </div>
      {SECTORS.map((s, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const gx = width / 2 + (col - (cols - 1) / 2) * gapX;
        const gy = height / 2 + (portrait ? 120 : 60) + (row - (rows - 1) / 2) * gapY;
        const appear = pop(frame, 4 + i * 5, 30, 14);
        const cx = width / 2;
        const cy = height / 2 + (portrait ? 140 : 90);
        const x = gx + (cx - gx) * gather;
        const y = gy + (cy - gy) * gather;
        const w = phoneW + (final - phoneW) * gather * (i === 0 ? 1 : 0.85);
        const rot = (1 - gather) * 0 + gather * (i === 0 ? 0 : (i - 4) * 2.4) * (1 - progress(frame, 168, 30));
        const fadeOthers = i === 0 ? 1 : 1 - progress(frame, 176, 26);
        return (
          <div key={s.key} style={{ position: 'absolute', left: x - w / 2, top: y - (w * 2.06) / 2, zIndex: i === 0 ? 20 : 10 - i, opacity: Math.min(1, appear * 1.4) * fadeOthers, transform: `scale(${0.85 + 0.15 * Math.min(appear, 1)}) rotate(${rot}deg)`, filter: `drop-shadow(0 30px 60px ${s.color}44)` }}>
            <Phone src={shot(s.key)} width={w} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** The one app: the same phone flicking through every business's look. */
const OneApp: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = usePortrait();
  const step = frame < 90 ? Math.floor(frame / 10) : 0;
  const s = SECTORS[(step + (frame >= 90 ? 0 : 0)) % SECTORS.length];
  const grow = progress(frame, 0, 30, easeInOut);
  const w = 300 + ((portrait ? 400 : 420) - 300) * grow;
  const move = portrait ? 0 : progress(frame, 0, 30, easeInOut);
  const text = (
    <div style={{ fontFamily: FONT, color: C.ink, width: portrait ? 940 : 760, textAlign: portrait ? 'center' : 'left', ...rise(frame, 18) }}>
      <div style={{ fontSize: portrait ? 84 : 92, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.04 }}>
        Same app.<br />Same back office.<br /><span style={{ color: C.accent }}>Your</span> brand.
      </div>
      <div style={{ fontSize: portrait ? 34 : 34, color: C.muted, marginTop: 24, lineHeight: 1.4 }}>Change the name, colours and products. Restaurant or shop mode is one switch.</div>
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', width: 1300, height: 1300, borderRadius: '50%', left: (portrait ? width / 2 : width / 2 + 300 * move) - 650, top: height / 2 - 650 + (portrait ? 200 : 0), background: `radial-gradient(closest-side, ${s.color}88, ${s.color}22 55%, transparent)`, filter: 'blur(40px)' }} />
      <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 40 : 120 * move }}>
        <div style={{ width: portrait ? 'auto' : 760 * move, overflow: 'hidden', opacity: portrait ? 1 : move }}>{text}</div>
        <div style={{ position: 'relative' }}>
          <Phone src={shot(s.key)} width={w} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -64, textAlign: 'center', fontFamily: MONO, fontSize: 26, color: C.muted }}>{frame < 90 ? s.name : ''}</div>
        </div>
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
      <div style={{ position: 'absolute', width: 1400, height: 1000, borderRadius: '50%', background: `radial-gradient(closest-side, ${C.accent}44, transparent)`, filter: 'blur(60px)', opacity: word }} />
      <LogoMark size={portrait ? 220 : 200} start={0} onDark />
      <div style={{ fontWeight: 800, fontSize: portrait ? 100 : 116, letterSpacing: '-0.05em', lineHeight: 1, color: C.ink, marginTop: 24, opacity: word, transform: `translateY(${(1 - word) * 30}px)` }}>{BRAND.name}</div>
      <div style={{ fontWeight: 600, fontSize: portrait ? 50 : 52, letterSpacing: '-0.025em', color: C.accent, marginTop: 22, opacity: progress(frame, 24, 14) }}>Build your business app in a day.</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 36, flexWrap: 'wrap', justifyContent: 'center', maxWidth: portrait ? 1000 : 1400 }}>
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

// ---------- The film ----------
const SCENES: Record<string, React.FC> = { hook: Hook, parade: Parade, converge: Converge, oneapp: OneApp, end: End };

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = Math.sin(frame / 80) * 60;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, #1A1613 0%, ${BG} 60%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: width * 0.9, height: height * 0.5, left: -width * 0.2 + drift, top: height * 0.7, borderRadius: '50%', background: `radial-gradient(closest-side, ${C.accent}22, transparent)`, filter: 'blur(60px)' }} />
    </AbsoluteFill>
  );
};

export const Finale: React.FC = () => {
  Object.assign(C, DARK);
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const corner = interpolate(frame, [STARTS.parade + 20, STARTS.parade + 40, STARTS.end - 12, STARTS.end + 4], [0, 0.8, 0.8, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      {FINALE_PARTS.map(([id, frames], i) => {
        const Scene = SCENES[id];
        const last = i === FINALE_PARTS.length - 1;
        return (
          <Sequence key={id} from={STARTS[id]} durationInFrames={frames} name={id}>
            <Fade duration={frames} last={last} soft={id === 'converge' || id === 'oneapp'}><Scene /></Fade>
          </Sequence>
        );
      })}
      <div style={{ position: 'absolute', left: portrait ? 40 : 52, bottom: portrait ? 34 : 38, display: 'flex', alignItems: 'center', gap: 12, opacity: corner, fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.ink }}>
        <LogoMark size={38} onDark />{BRAND.name}
      </div>
    </AbsoluteFill>
  );
};

/** Blur crossfade between scenes; the grid-to-one-app handover is a straight cut so the phone stays put. */
const Fade: React.FC<{ duration: number; last: boolean; soft: boolean; children: React.ReactNode }> = ({ duration, last, soft, children }) => {
  const frame = useCurrentFrame();
  if (soft) return <AbsoluteFill>{children}</AbsoluteFill>;
  return <AbsoluteFill style={sceneFade(frame, last ? duration + 100 : duration)}>{children}</AbsoluteFill>;
};
