import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../theme';
import { Caret, LogoMark, usePortrait, Words } from '../components';
import { clamp, count, pop, progress, rise, typed } from '../motion';

const Centre: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 90px', ...style }}>{children}</AbsoluteFill>
);

// 1. Hook: the question, word by word, the last word in the accent colour.
export const Hook: React.FC = () => {
  const portrait = usePortrait();
  return (
    <Centre>
      <Words text={portrait ? 'Still paying\nfor your\nbusiness *app?*' : 'Still paying for\nyour business *app?*'} start={8} gap={8} size={portrait ? 118 : 136} />
    </Centre>
  );
};

// 2. Brand: "Meet / your own / ordering app." one beat at a time, then the logo draws on.
export const Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const beats = [
    { text: 'Meet', at: 0 },
    { text: 'your *own*', at: 18 },
    { text: 'ordering *app.*', at: 36 },
  ];
  const size = portrait ? 140 : 168;
  const logoAt = 56;
  const wordmark = progress(frame, logoAt + 16, 20);
  return (
    <Centre>
      {beats.map((b, i) => {
        const end = i < beats.length - 1 ? beats[i + 1].at : logoAt;
        const out = progress(frame, end - 8, 8);
        if (frame < b.at || out >= 1) return null;
        return (
          <div key={i} style={{ position: 'absolute', opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
            <Words text={b.text} start={b.at} gap={5} size={size} />
          </div>
        );
      })}
      {frame >= logoAt && (
        <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', gap: portrait ? 30 : 40 }}>
          <LogoMark size={portrait ? 260 : 240} start={logoAt} />
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: portrait ? 84 : 100, letterSpacing: '-0.04em', lineHeight: 0.98, color: C.ink, opacity: wordmark, transform: `translateX(${(1 - wordmark) * (portrait ? 0 : -30)}px) translateY(${(1 - wordmark) * (portrait ? 20 : 0)}px)`, textAlign: portrait ? 'center' : 'left' }}>
            Free Restaurant<br />Ordering
          </div>
        </div>
      )}
    </Centre>
  );
};

// 3. Promise: "Free. Open source." types in; "0%" counts down; "commission." gets an underline.
export const Promise: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const line = 'Free. Open source.';
  const shown = typed(line, frame, 4, 0.75);
  const zero = Math.round(count(frame, 30, 22, 0, 30));
  const zeroPop = pop(frame, 28, fps, 12);
  const underline = progress(frame, 52, 14);
  const big = portrait ? 230 : 250;
  return (
    <Centre>
      <div style={{ fontFamily: FONT, textAlign: 'center', color: C.ink }}>
        <div style={{ fontWeight: 700, fontSize: portrait ? 84 : 96, letterSpacing: '-0.035em' }}>
          {shown}{shown.length < line.length || frame < 40 ? <Caret size={portrait ? 84 : 96} /> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: portrait ? 'center' : 'baseline', justifyContent: 'center', gap: portrait ? 0 : 40, marginTop: 18 }}>
          <span style={{ fontWeight: 800, fontSize: big, letterSpacing: '-0.06em', color: C.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums', transform: `scale(${zeroPop})`, display: 'inline-block', opacity: interpolate(frame, [26, 32], [0, 1], clamp) }}>{zero}%</span>
          <span style={{ position: 'relative', fontWeight: 700, fontSize: portrait ? 110 : 120, letterSpacing: '-0.04em', ...rise(frame, 44) }}>
            commission.
            <span style={{ position: 'absolute', left: 0, bottom: -8, height: 12, borderRadius: 6, width: `${underline * 100}%`, background: C.accent }} />
          </span>
        </div>
        <div style={{ marginTop: 38, fontSize: portrait ? 44 : 42, fontWeight: 500, color: C.muted, ...rise(frame, 62) }}>No subscription. No per-order fee.</div>
      </div>
    </Centre>
  );
};


