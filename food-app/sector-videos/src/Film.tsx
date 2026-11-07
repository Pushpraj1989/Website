import React from 'react';
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, MONO, BRAND } from './theme';
import { Card, LogoMark, Phone, Pill, usePortrait, Words } from './components';
import { clamp, easeInOut, pop, progress, rise, sceneFade, typed } from './motion';
import { loadFonts } from './fonts';
import type { Clip, SectorFilm, Shot } from './sectors';

loadFonts();

// ---------- Timing ----------
const TOUR = 96; // frames per app screen
const HOLD = 24; // frames a console clip holds its last frame
type Part = { id: string; frames: number; render: (f: SectorFilm) => React.ReactNode };

export function parts(f: SectorFilm): Part[] {
  const list: Part[] = [
    { id: 'hook', frames: 105, render: (x) => <Hook f={x} /> },
    { id: 'meet', frames: 180, render: (x) => <Meet f={x} /> },
    { id: 'tour', frames: TOUR * f.tour.length, render: (x) => <Tour shots={x.tour} /> },
  ];
  if (f.booking) list.push({ id: 'booking', frames: 240, render: (x) => <Booking f={x} /> });
  list.push({ id: 'office', frames: 90, render: () => <Office /> });
  f.console.forEach((c, i) => list.push({ id: `clip${i}`, frames: c.seconds * 30 + HOLD, render: () => <ConsoleClip clip={c} /> }));
  list.push({ id: 'link', frames: 150, render: (x) => <Link f={x} /> });
  list.push({ id: 'dashboard', frames: 165, render: (x) => <Dashboard f={x} /> });
  list.push({ id: 'features', frames: 210, render: (x) => <Features f={x} /> });
  list.push({ id: 'end', frames: 165, render: (x) => <End f={x} /> });
  return list;
}
export const filmLength = (f: SectorFilm) => parts(f).reduce((n, p) => n + p.frames, 0);

// ---------- Shared pieces ----------
const Centre: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>{children}</AbsoluteFill>
);

const Kicker: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 24 }) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{children}</div>
);

/** Words with *accent* parts, static (for captions that change in place). */
const Rich: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div style={style}>
    {text.split('\n').map((line, i) => (
      <div key={i}>{line.split(/(\*[^*]+\*)/).map((part, j) => part.startsWith('*') ? <span key={j} style={{ color: C.accent }}>{part.slice(1, -1)}</span> : <span key={j}>{part}</span>)}</div>
    ))}
  </div>
);

/** A browser window around a console recording or screenshot. 1440 × 900 content. */
const Browser: React.FC<{ width: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ width, children, style }) => {
  const bar = Math.round(width * 0.03);
  return (
    <Card glow={false} style={{ width, borderRadius: Math.round(width * 0.014), ...style }}>
      <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: bar * 0.3, padding: `0 ${bar * 0.5}px`, background: '#F3F1EF', borderBottom: `1px solid ${C.line}` }}>
        {['#ef4444', '#f59e0b', '#22c55e'].map((c) => <i key={c} style={{ width: bar * 0.32, height: bar * 0.32, borderRadius: 99, background: c, display: 'block' }} />)}
        <span style={{ marginLeft: bar * 0.4, padding: `${bar * 0.08}px ${bar * 0.5}px`, borderRadius: 99, background: '#fff', fontFamily: MONO, fontSize: bar * 0.38, color: C.muted }}>yourbusiness.com/console</span>
      </div>
      <div style={{ width, height: (width * 900) / 1440, position: 'relative', overflow: 'hidden', background: '#fff' }}>{children}</div>
    </Card>
  );
};

// ---------- Scenes ----------
const Hook: React.FC<{ f: SectorFilm }> = ({ f }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  return (
    <Centre>
      <div style={{ textAlign: 'center' }}>
        <Words text={portrait ? f.hook.portrait : f.hook.landscape} start={6} gap={7} size={portrait ? 104 : 120} />
        <div style={{ marginTop: 40, fontFamily: FONT, fontSize: portrait ? 50 : 52, fontWeight: 600, color: C.muted, ...rise(frame, 52) }}>{f.hook.sub}</div>
      </div>
    </Centre>
  );
};

const Meet: React.FC<{ f: SectorFilm }> = ({ f }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const swap = 66;
  const out = progress(frame, swap - 10, 10);
  const phone = progress(frame, swap, 30);
  return (
    <AbsoluteFill>
      {frame < swap && (
        <Centre>
          <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: portrait ? 0 : 36, opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
            {f.meet.map((t, i) => <Words key={i} text={t} start={i * 20} gap={5} size={portrait ? 130 : 150} />)}
          </div>
        </Centre>
      )}
      {frame >= swap && (
        <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 40 : 120, padding: portrait ? '70px 70px 0' : 0 }}>
          <div style={{ width: portrait ? 940 : 760, textAlign: portrait ? 'center' : 'left', fontFamily: FONT, color: C.ink, ...rise(frame, swap + 6) }}>
            <Kicker>{f.business}</Kicker>
            <Rich text={f.meet.join(' ')} style={{ fontSize: portrait ? 84 : 96, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.02, marginTop: 14 }} />
            <div style={{ fontSize: portrait ? 36 : 36, color: C.muted, marginTop: 24, lineHeight: 1.35 }}>{f.meetLine}</div>
          </div>
          <div style={{ opacity: phone, transform: `translateY(${(1 - phone) * 200}px) rotate(${(1 - phone) * 4}deg)` }}>
            <Phone src={`${f.id}/app/a01-signin.png`} width={portrait ? 400 : 420} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** The app, screen by screen: the phone changes with a slide and blur; the caption beside it changes with it. */
const Tour: React.FC<{ shots: Shot[] }> = ({ shots }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const i = Math.min(shots.length - 1, Math.floor(frame / TOUR));
  const local = frame - i * TOUR;
  const inP = progress(local, 0, 18);
  const s = shots[i];
  const phoneW = portrait ? 430 : 450;
  const caption = (
    <div style={{ width: portrait ? 940 : 700, fontFamily: FONT, color: C.ink, textAlign: portrait ? 'center' : 'left', opacity: inP, transform: `translateY(${(1 - inP) * 24}px)`, filter: `blur(${(1 - inP) * 6}px)` }}>
      <Kicker>{s.kicker} · {i + 1}/{shots.length}</Kicker>
      <div style={{ fontSize: portrait ? 76 : 84, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.04, marginTop: 14 }}>{s.title}</div>
      <div style={{ fontSize: portrait ? 36 : 36, color: C.muted, marginTop: 20, lineHeight: 1.35 }}>{s.body}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 34 : 130, padding: portrait ? '60px 60px 0' : 0 }}>
      {caption}
      <div style={{ position: 'relative', width: phoneW, height: phoneW * 2.06 }}>
        {shots.map((sh, k) => {
          if (k < i - 1 || k > i) return null;
          const p = k === i ? inP : 1 - inP;
          return (
            <div key={sh.src} style={{ position: 'absolute', inset: 0, opacity: k === i ? Math.min(1, inP * 1.4) : p, transform: `translateX(${k === i ? (1 - inP) * 90 : -(1 - p) * 90}px) scale(${0.96 + 0.04 * p})`, filter: k === i ? `blur(${(1 - inP) * 8}px)` : `blur(${(1 - p) * 8}px)` }}>
              <Phone src={sh.src} width={phoneW} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Booking: React.FC<{ f: SectorFilm }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const b = f.booking!;
  const a = progress(frame, 10, 30);
  const c = progress(frame, 70, 30);
  const w = portrait ? 360 : 400;
  return (
    <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 30 : 110, padding: portrait ? '60px 60px 0' : 0 }}>
      <div style={{ width: portrait ? 940 : 640, fontFamily: FONT, textAlign: portrait ? 'center' : 'left', ...rise(frame, 4) }}>
        <span style={{ display: 'inline-block', transform: `scale(${pop(frame, 6, fps)})` }}><Pill tone="accent" size={portrait ? 26 : 24}>{b.kicker}</Pill></span>
        <Rich text={b.title} style={{ fontSize: portrait ? 76 : 84, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.04, marginTop: 20, color: C.ink }} />
        <div style={{ fontSize: 36, color: C.muted, marginTop: 20, lineHeight: 1.35 }}>{b.body}</div>
        <div style={{ fontSize: portrait ? 30 : 28, color: C.muted, marginTop: 22, fontStyle: 'italic', ...rise(frame, 110) }}>{b.note}</div>
      </div>
      <div style={{ display: 'flex', gap: 30 }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 160}px) rotate(-3deg)` }}><Phone src={`${f.id}/app/booking.png`} width={w} /></div>
        <div style={{ opacity: c, transform: `translateY(${(1 - c) * 160 + 40}px) rotate(3deg)` }}><Phone src={`${f.id}/app/booking-done.png`} width={w} /></div>
      </div>
    </AbsoluteFill>
  );
};

const Office: React.FC = () => {
  const portrait = usePortrait();
  return (
    <Centre>
      <div style={{ textAlign: 'center' }}>
        <Words text={portrait ? 'And the\nback office.\nSimple *enough.*' : 'And the back office.\nSimple *enough.*'} start={4} gap={6} size={portrait ? 110 : 120} />
      </div>
    </Centre>
  );
};

/** A real console recording, sped up, in a browser window, with its caption. */
const ConsoleClip: React.FC<{ clip: Clip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const len = clip.seconds * 30;
  const w = portrait ? 1000 : 1300;
  const enter = progress(frame, 0, 22);
  const video = <OffthreadVideo src={staticFile(clip.src)} muted style={{ width: '100%', display: 'block' }} />;
  const caption = (
    <div style={{ width: portrait ? 940 : 470, fontFamily: FONT, color: C.ink, textAlign: portrait ? 'center' : 'left', ...rise(frame, 4) }}>
      <Kicker>{clip.kicker}</Kicker>
      <div style={{ fontSize: portrait ? 72 : 72, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.04, marginTop: 14 }}>{clip.title}</div>
      <div style={{ fontSize: portrait ? 34 : 32, color: C.muted, marginTop: 18, lineHeight: 1.35 }}>{clip.body}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 50 : 60, padding: portrait ? '40px 40px 0' : '0 40px' }}>
      {caption}
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 60}px) scale(${0.97 + 0.03 * enter})` }}>
        <Browser width={w}>
          <Sequence from={0} durationInFrames={len} layout="none">{video}</Sequence>
          {frame >= len && <Freeze frame={len - 1}>{video}</Freeze>}
        </Browser>
      </div>
    </AbsoluteFill>
  );
};

const Link: React.FC<{ f: SectorFilm }> = ({ f }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const a = progress(frame, 6, 26);
  const b = progress(frame, 34, 28);
  const arrow = progress(frame, 26, 18);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: portrait ? 70 : 60, left: 0, right: 0, textAlign: 'center', fontFamily: FONT }}>
        <Rich text={f.popupLink.title} style={{ fontSize: portrait ? 70 : 72, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.04, color: C.ink, ...rise(frame, 2) }} />
        <div style={{ fontSize: 34, color: C.muted, marginTop: 14, ...rise(frame, 60) }}>{f.popupLink.body}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', gap: portrait ? 10 : 50, marginTop: portrait ? 200 : 240 }}>
        <div style={{ opacity: a, transform: `translateX(${(1 - a) * -80}px)` }}>
          <Browser width={portrait ? 680 : 960}><Img src={staticFile(`${f.id}/console/promotions.png`)} style={{ width: '100%' }} /></Browser>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 90, fontWeight: 800, color: C.accent, opacity: arrow, transform: `${portrait ? 'rotate(90deg) ' : ''}translateX(${(1 - arrow) * -30}px)` }}>→</div>
        <div style={{ opacity: b, transform: `translateY(${(1 - b) * 120}px)` }}>
          <Phone src={`${f.id}/app/a02-popup.png`} width={portrait ? 270 : 340} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Dashboard: React.FC<{ f: SectorFilm }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const portrait = usePortrait();
  const zoom = interpolate(frame, [20, 160], [1, 1.12], { ...clamp, easing: easeInOut });
  const enter = progress(frame, 0, 24);
  return (
    <AbsoluteFill style={{ flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: portrait ? 50 : 60, padding: portrait ? '40px 40px 0' : '0 40px' }}>
      <div style={{ width: portrait ? 940 : 470, fontFamily: FONT, color: C.ink, textAlign: portrait ? 'center' : 'left', ...rise(frame, 4) }}>
        <Kicker>The back office</Kicker>
        <Rich text={f.dashboard.title} style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.04, marginTop: 14 }} />
        <div style={{ fontSize: 34, color: C.muted, marginTop: 18, lineHeight: 1.35 }}>{f.dashboard.body}</div>
      </div>
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 60}px)` }}>
        <Browser width={portrait ? 1000 : 1300}>
          <Img src={staticFile(`${f.id}/console/dashboard.png`)} style={{ width: '100%', transform: `scale(${zoom})`, transformOrigin: '30% 25%' }} />
        </Browser>
      </div>
      {durationInFrames < 0 ? null : null}
    </AbsoluteFill>
  );
};

const Features: React.FC<{ f: SectorFilm }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const cols = portrait ? 2 : 4;
  return (
    <AbsoluteFill style={{ alignItems: 'center', fontFamily: FONT }}>
      <div style={{ marginTop: portrait ? 90 : 80 }}>
        <Words text={`Everything your *${f.word}* needs.`} start={0} gap={5} size={portrait ? 66 : 84} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${portrait ? 450 : 380}px)`, gap: 24, marginTop: portrait ? 60 : 70 }}>
        {f.features.map((t, i) => {
          const k = pop(frame, 20 + i * 6, fps, 14);
          return (
            <Card key={t} style={{ padding: portrait ? '30px 30px' : '34px 30px', transform: `translateY(${(1 - k) * 60}px) scale(${0.9 + 0.1 * Math.min(1, k)})`, opacity: Math.min(1, k * 1.5), display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ width: 22, height: 22, borderRadius: 99, background: C.accent, flex: 'none' }} />
              <span style={{ fontSize: portrait ? 34 : 32, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{t}</span>
            </Card>
          );
        })}
      </div>
      <div style={{ marginTop: portrait ? 50 : 56, fontSize: portrait ? 30 : 28, color: C.muted, textAlign: 'center', maxWidth: 940, lineHeight: 1.4, ...rise(frame, 90) }}>
        The app builds for iPhone and Android with Flutter. Publish it under your own name with your Apple and Google developer accounts.
      </div>
    </AbsoluteFill>
  );
};

const End: React.FC<{ f: SectorFilm }> = ({ f }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const word = progress(frame, 12, 22);
  const tags = ['0% commission', 'Free & open source', 'Apache 2.0'];
  const url = typed(BRAND.repo, frame, 50, 1.8);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FONT, textAlign: 'center' }}>
      <LogoMark size={portrait ? 210 : 190} start={0} />
      <div style={{ fontWeight: 800, fontSize: portrait ? 92 : 100, letterSpacing: '-0.045em', lineHeight: 1, color: C.ink, marginTop: 22, opacity: word, transform: `translateY(${(1 - word) * 30}px)` }}>{BRAND.name}</div>
      <div style={{ fontWeight: 600, fontSize: portrait ? 50 : 50, letterSpacing: '-0.025em', color: C.accent, marginTop: 20, opacity: progress(frame, 22, 14) }}>Build your {f.word} app in a day.</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 34, flexWrap: 'wrap', justifyContent: 'center', maxWidth: portrait ? 1000 : 1400 }}>
        {tags.map((t, i) => <span key={t} style={{ transform: `scale(${pop(frame, 30 + i * 5, fps)})`, display: 'inline-block' }}><Pill tone={i === 0 ? 'accent' : 'soft'} size={portrait ? 32 : 30}>{t}</Pill></span>)}
      </div>
      <div style={{ marginTop: 38, fontFamily: MONO, fontSize: portrait ? 32 : 36, color: C.ink, padding: '18px 28px', borderRadius: 18, background: '#fff', border: `1px solid ${C.line}`, minWidth: portrait ? 900 : 1040, opacity: progress(frame, 46, 8) }}>{url || ' '}</div>
    </AbsoluteFill>
  );
};

// ---------- The film ----------
const Backdrop: React.FC<{ starts: number[] }> = ({ starts }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  let sweep = 0;
  starts.slice(1).forEach((s, i) => { sweep += (i % 2 === 0 ? 1 : -1) * interpolate(frame, [s - 14, s + 22], [0, 1], { ...clamp, easing: easeInOut }); });
  const drift = Math.sin(frame / 90) * 40;
  const rot = -18 + Math.sin(frame / 120) * 3 + sweep * 4;
  const s = Math.max(width, height);
  return (
    <AbsoluteFill style={{ background: C.cream, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: s * 1.1, height: s * 0.42, left: width * 0.32 + sweep * width * 0.16 + drift, top: -s * 0.12, borderRadius: '50%', background: `radial-gradient(closest-side, ${C.saffron}cc, ${C.amber}44 55%, transparent)`, filter: 'blur(60px)', transform: `rotate(${rot}deg)` }} />
      <div style={{ position: 'absolute', width: s * 0.9, height: s * 0.3, left: -s * 0.2 - sweep * width * 0.12 - drift, top: height - s * 0.16, borderRadius: '50%', background: `radial-gradient(closest-side, ${C.saffron}aa, ${C.amber}33 60%, transparent)`, filter: 'blur(70px)', transform: `rotate(${rot + 8}deg)` }} />
    </AbsoluteFill>
  );
};

const Shell: React.FC<{ duration: number; last: boolean; children: React.ReactNode }> = ({ duration, last, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={sceneFade(frame, last ? duration + 100 : duration)}>{children}</AbsoluteFill>;
};

export const Film: React.FC<{ film: SectorFilm }> = ({ film }) => {
  Object.assign(C, film.palette); // this composition's brand colours (one film renders per process)
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const list = parts(film);
  const starts: number[] = [];
  list.reduce((t, p) => { starts.push(t); return t + p.frames; }, 0);
  const endStart = starts[starts.length - 1];
  const corner = interpolate(frame, [starts[1] + 70, starts[1] + 90, endStart - 12, endStart + 4], [0, 0.85, 0.85, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop starts={starts} />
      {list.map((p, i) => (
        <Sequence key={p.id} from={starts[i]} durationInFrames={p.frames} name={p.id}>
          <Shell duration={p.frames} last={i === list.length - 1}>{p.render(film)}</Shell>
        </Sequence>
      ))}
      <div style={{ position: 'absolute', left: portrait ? 40 : 52, bottom: portrait ? 34 : 38, display: 'flex', alignItems: 'center', gap: 12, opacity: corner, fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.ink }}>
        <LogoMark size={38} />{BRAND.name}
      </div>
    </AbsoluteFill>
  );
};
