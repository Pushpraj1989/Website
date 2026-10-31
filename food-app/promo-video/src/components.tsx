import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, BRAND } from './theme';
import { clamp, easeInOut, easeOut, pop, progress, rise } from './motion';

/** True for the 1080 × 1350 feed version. Scenes rearrange themselves for it. */
export const usePortrait = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

// ---------- Backdrop: cream with two soft saffron glows that drift, and sweep across at each scene change ----------
export const SCENE_STARTS = [0, 96, 222, 318, 492, 678, 858, 1056, 1230, 1470];

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Each scene change adds a sweep, alternating direction, so the glow travels with the story.
  let sweep = 0;
  SCENE_STARTS.slice(1).forEach((s, i) => {
    sweep += (i % 2 === 0 ? 1 : -1) * interpolate(frame, [s - 14, s + 22], [0, 1], { ...clamp, easing: easeInOut });
  });
  const drift = Math.sin(frame / 90) * 40;
  const rot = -18 + Math.sin(frame / 120) * 3 + sweep * 4;
  const s = Math.max(width, height);
  return (
    <AbsoluteFill style={{ background: C.cream, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', width: s * 1.1, height: s * 0.42, left: width * 0.32 + sweep * width * 0.16 + drift, top: -s * 0.12,
        borderRadius: '50%', background: `radial-gradient(closest-side, ${C.saffron}cc, ${C.amber}55 55%, transparent)`,
        filter: 'blur(60px)', transform: `rotate(${rot}deg)`,
      }} />
      <div style={{
        position: 'absolute', width: s * 0.9, height: s * 0.3, left: -s * 0.2 - sweep * width * 0.12 - drift, top: height - s * 0.16,
        borderRadius: '50%', background: `radial-gradient(closest-side, ${C.saffron}aa, ${C.amber}33 60%, transparent)`,
        filter: 'blur(70px)', transform: `rotate(${rot + 8}deg)`,
      }} />
    </AbsoluteFill>
  );
};

// ---------- The logo: the bowl, the heart rising out of it, the steam; drawn in on cue ----------
export const LogoMark: React.FC<{ size: number; start?: number; onDark?: boolean }> = ({ size, start, onDark }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const animate = start !== undefined;
  const bowl = animate ? progress(frame, start!, 18) : 1;
  const heart = animate ? pop(frame, start! + 10, fps, 11) : 1;
  const steam = animate ? progress(frame, start! + 20, 22) : 1;
  const bowlColour = onDark ? C.cream : C.ink;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="heat" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={C.amber} /><stop offset="1" stopColor={C.chilli} />
        </linearGradient>
      </defs>
      <g opacity={steam} transform={`translate(0 ${(1 - steam) * 10})`}>
        <path d="M27 50 C22 44 31 39 26 32 C22 27 28 22 26 17" fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
        <path d="M93 50 C98 44 89 39 94 32 C98 27 92 22 94 17" fill="none" stroke={C.amber} strokeWidth={5} strokeLinecap="round" />
      </g>
      <g transform={`translate(60 70) scale(${heart}) translate(-60 -70) translate(0 ${(1 - Math.min(heart, 1)) * 16})`}>
        <path d="M60 70 C50 63 37 53 37 39 C37 29 45 23 53 25 C57 26 59 29 60 32 C61 29 63 26 67 25 C75 23 83 29 83 39 C83 53 70 63 60 70 Z" fill="url(#heat)" />
      </g>
      <g opacity={bowl} transform={`translate(0 ${(1 - bowl) * 14})`}>
        <path d="M10 62 H110 C110 90 88 108 60 108 C32 108 10 90 10 62 Z" fill={bowlColour} />
        <path d="M22 74 C26 86 36 94 48 97" fill="none" stroke={C.amber} strokeWidth={4} strokeLinecap="round" opacity={0.55} />
        <rect x={42} y={110} width={36} height={6} rx={3} fill={bowlColour} />
      </g>
    </svg>
  );
};

/** The small brand in the bottom-left corner, as in the reference, on every scene but the end card. */
export const CornerBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const opacity = interpolate(frame, [222, 240, SCENE_STARTS[9] - 12, SCENE_STARTS[9] + 4], [0, 0.85, 0.85, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: portrait ? 44 : 56, bottom: portrait ? 40 : 44, display: 'flex', alignItems: 'center', gap: 12, opacity, fontFamily: FONT, fontWeight: 700, fontSize: portrait ? 26 : 24, color: C.ink, letterSpacing: '-0.02em' }}>
      <LogoMark size={portrait ? 44 : 40} />
      {BRAND.name}
    </div>
  );
};

// ---------- Type ----------
/** A headline whose words rise in one after another. Words wrapped in *stars* take the accent colour. */
export const Words: React.FC<{ text: string; start: number; gap?: number; size: number; weight?: number; align?: 'left' | 'center'; lineHeight?: number }> = ({ text, start, gap = 6, size, weight = 700, align = 'center', lineHeight = 1.06 }) => {
  const frame = useCurrentFrame();
  let i = 0;
  return (
    <div style={{ fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight, letterSpacing: '-0.035em', color: C.ink, textAlign: align }}>
      {text.split('\n').map((line, li) => (
        <div key={li}>
          {line.split(' ').map((w, wi) => {
            const accent = w.startsWith('*');
            const word = w.replace(/\*/g, '');
            const style = rise(frame, start + (i++) * gap, { length: 18, lift: size * 0.35, blur: 8 });
            return (
              <span key={wi} style={{ display: 'inline-block', marginRight: '0.24em', color: accent ? C.accent : C.ink, ...style }}>{word}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** A blinking caret, for typed text. */
export const Caret: React.FC<{ size: number; color?: string }> = ({ size, color = C.ink }) => {
  const frame = useCurrentFrame();
  return <span style={{ display: 'inline-block', width: Math.max(3, size * 0.06), height: size * 0.9, marginLeft: 4, verticalAlign: '-0.1em', background: color, opacity: Math.floor(frame / 15) % 2 ? 0 : 1 }} />;
};

/** The step header: a numbered badge and a line whose accent word cycles through options. */
export const StepHeader: React.FC<{ n: number; lead: string; words: string[]; every?: number; start?: number; portrait: boolean; tail?: string }> = ({ n, lead, words, every = 40, start = 0, portrait, tail = '' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = portrait ? 76 : 84;
  const badge = pop(frame, start, fps);
  const idx = Math.min(words.length - 1, Math.max(0, Math.floor((frame - start) / every)));
  const local = frame - start - idx * every;
  const swapIn = progress(local, 0, 14);
  const swapOut = idx < words.length - 1 ? progress(local, every - 10, 10) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontFamily: FONT, ...rise(frame, start, { lift: 30 }) }}>
      <div style={{ width: size * 0.95, height: size * 0.95, borderRadius: '50%', background: C.ink, color: C.cream, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.48, transform: `scale(${badge})`, flex: 'none' }}>{n}</div>
      <div style={{ fontWeight: 700, fontSize: size, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.04 }}>
        {lead}{' '}
        <span style={{ display: 'inline-block', color: C.accent, opacity: swapIn * (1 - swapOut), filter: `blur(${(1 - swapIn) * 8 + swapOut * 10}px)`, transform: `translateY(${(1 - swapIn) * 24 - swapOut * 18}px)` }}>{words[idx]}</span>
        {tail}
      </div>
    </div>
  );
};

// ---------- UI pieces ----------
export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode; glow?: boolean }> = ({ style, children, glow = true }) => (
  <div style={{
    background: C.card, borderRadius: 26, border: `1px solid ${C.line}`, fontFamily: FONT, color: C.ink, overflow: 'hidden',
    boxShadow: `0 40px 90px rgba(120, 72, 10, 0.16), 0 0 0 1px rgba(255,255,255,0.6) inset${glow ? `, 0 0 120px ${C.saffron}44` : ''}`,
    ...style,
  }}>{children}</div>
);

/** A pointer that travels a path and clicks, with a ripple. */
export const Cursor: React.FC<{ from: [number, number]; to: [number, number]; start: number; length?: number; clickAt?: number }> = ({ from, to, start, length = 24, clickAt }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, start, length, easeInOut);
  const show = interpolate(frame, [start - 6, start], [0, 1], clamp);
  const x = from[0] + (to[0] - from[0]) * p;
  const y = from[1] + (to[1] - from[1]) * p - Math.sin(p * Math.PI) * 40;
  const click = clickAt !== undefined ? frame - clickAt : -1;
  const press = click >= 0 && click < 6 ? 0.86 : 1;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: show, zIndex: 50, pointerEvents: 'none' }}>
      {click >= 0 && click < 16 && (
        <div style={{ position: 'absolute', left: -28, top: -28, width: 56, height: 56, borderRadius: '50%', border: `3px solid ${C.accent}`, transform: `scale(${interpolate(click, [0, 16], [0.2, 1.6])})`, opacity: interpolate(click, [0, 16], [0.7, 0]) }} />
      )}
      <svg width={36} height={36} viewBox="0 0 24 24" style={{ transform: `scale(${press})`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.25))' }}>
        <path d="M4 2 L4 19 L8.5 15 L11.5 21.5 L14 20.3 L11 14 L17 14 Z" fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** A phone with a real screenshot of the app. */
export const Phone: React.FC<{ src: string; width: number; style?: React.CSSProperties; scrollTo?: number; scrollStart?: number }> = ({ src, width, style, scrollTo = 0, scrollStart = 0 }) => {
  const frame = useCurrentFrame();
  const h = width * 2.06;
  const scroll = scrollTo ? progress(frame, scrollStart, 40, easeInOut) * scrollTo : 0;
  return (
    <div style={{ width, height: h, borderRadius: width * 0.14, background: '#0d0c0b', padding: width * 0.032, boxShadow: '0 50px 100px rgba(60,30,0,.35), 0 0 0 2px #2a2725 inset', ...style }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: width * 0.11, overflow: 'hidden', background: '#fff' }}>
        <Img src={staticFile(src)} style={{ width: '100%', position: 'absolute', left: 0, top: -scroll }} />
        <div style={{ position: 'absolute', top: width * 0.03, left: '50%', width: width * 0.3, height: width * 0.075, marginLeft: -width * 0.15, borderRadius: 99, background: '#0d0c0b' }} />
      </div>
    </div>
  );
};

/** The scene's camera: a slow push and drift over its content. */
export const Camera: React.FC<{ children: React.ReactNode; start: number; length: number; scale?: number; x?: number; y?: number }> = ({ children, start, length, scale = 1.06, x = 0, y = 0 }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, start, length, easeInOut);
  return <AbsoluteFill style={{ transform: `translate(${x * p}px, ${y * p}px) scale(${1 + (scale - 1) * p})` }}>{children}</AbsoluteFill>;
};

export const Pill: React.FC<{ children: React.ReactNode; tone?: 'green' | 'accent' | 'ink' | 'soft'; size?: number; style?: React.CSSProperties }> = ({ children, tone = 'soft', size = 20, style }) => {
  const tones = {
    green: { background: C.greenSoft, color: C.green },
    accent: { background: C.accent, color: '#fff' },
    ink: { background: C.ink, color: '#fff' },
    soft: { background: '#F5EFE6', color: C.ink },
  }[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: 999, fontWeight: 600, fontSize: size, ...tones, ...style }}>{children}</span>;
};

export const ease = { easeOut, easeInOut };
