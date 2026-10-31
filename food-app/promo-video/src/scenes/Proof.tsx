import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, MONO, DEMO, BRAND } from '../theme';
import { Camera, Card, Cursor, LogoMark, Phone, Pill, StepHeader, usePortrait, Words } from '../components';
import { count, money, pop, progress, rise, typed } from '../motion';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 20, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</div>
);

// 7. The proof: the sales dashboard counts up (demo data), the cursor picks "This year", the camera moves to orders.
export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const w = portrait ? 952 : 1300;
  const left = portrait ? 64 : 310;
  const top = portrait ? 260 : 250;
  const max = Math.max(...DEMO.months.map((m) => m.v));
  const tabs = ['Today', '7 days', '30 days', 'This month', 'This year'];
  const yearOn = frame >= 92;
  const orders = [
    ['#36', '2 × Grilled chicken plate', 'Collected', 110],
    ['#14', '2 × Lentil soup, 2 × Mint lemonade', 'Preparing', 54],
    ['#33', '1 × Grilled chicken plate, 1 × Still water', 'Preparing', 95],
    ['#28', '2 × Vegetable stew', 'Collected', 76],
    ['#21', '1 × Grilled chicken plate, 1 × Still water', 'Collected', 95],
  ] as const;
  const tiles = [
    ['Orders received', String(Math.round(count(frame, 20, 34, DEMO.orders)))],
    ['Delivered or collected', String(Math.round(count(frame, 24, 34, DEMO.collected)))],
    ['Average order', `${DEMO.currency} ${money(count(frame, 28, 34, DEMO.average))}`],
    ['New customers', String(Math.round(count(frame, 32, 34, DEMO.customers)))],
  ];
  return (
    <AbsoluteFill>
      <Camera start={112} length={56} scale={1} y={portrait ? -760 : -560}>
        <div style={{ position: 'absolute', left: portrait ? 64 : 110, top: portrait ? 80 : 70 }}>
          <Words text="Watch it *grow.*" start={0} gap={6} size={portrait ? 92 : 84} align="left" />
        </div>
        <Card style={{ position: 'absolute', left, top, width: w, padding: 34, ...rise(frame, 6, { lift: 80 }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Good afternoon · {DEMO.restaurant}</div>
            <div style={{ display: 'flex', gap: 8, padding: 6, borderRadius: 16, background: '#F5EFE6' }}>
              {(portrait ? tabs.slice(2) : tabs).map((t) => (
                <span key={t} style={{ padding: '8px 16px', borderRadius: 12, fontSize: 20, fontWeight: 600, background: t === 'This year' && yearOn ? C.ink : 'transparent', color: t === 'This year' && yearOn ? '#fff' : C.ink }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 26, flexDirection: portrait ? 'column' : 'row' }}>
            <div style={{ flex: 1.3, borderRadius: 22, padding: 28, color: '#fff', background: `linear-gradient(135deg, #D97706, ${C.accent} 50%, #7C2D12)` }}>
              <Label><span style={{ color: '#fff', opacity: 0.85 }}>Sales · {yearOn ? 'This year' : '30 days'}</span></Label>
              <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>{DEMO.currency} {money(count(frame, 14, 40, DEMO.sales))}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 120, marginTop: 14 }}>
                {DEMO.months.map((m, i) => {
                  const h = progress(frame, 30 + i * 6, 22) * (m.v / max) * 110;
                  return (
                    <div key={m.m} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ height: h, borderRadius: 8, background: i === 3 ? '#fff' : 'rgba(255,255,255,.5)' }} />
                      <div style={{ fontSize: 16, marginTop: 6, opacity: 0.9 }}>{m.m}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {tiles.map(([label, value], i) => (
                <div key={label} style={{ border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, ...rise(frame, 16 + i * 5, { lift: 20, blur: 4 }) }}>
                  <div style={{ fontSize: 19, color: C.muted, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card style={{ position: 'absolute', left, top: top + (portrait ? 880 : 640), width: w, padding: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><div style={{ fontSize: 34, fontWeight: 700 }}>Live orders</div><Pill tone="green" size={20}>● Live</Pill></div>
          {orders.map(([n, items, status, total], i) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: portrait ? '70px 1fr 160px' : '80px 1fr 200px 170px', gap: 16, alignItems: 'center', padding: '16px 0', borderBottom: i < orders.length - 1 ? `1px solid ${C.line}` : 'none', fontSize: 24, ...rise(frame, 126 + i * 6, { lift: 20, blur: 4 }) }}>
              <b>{n}</b>
              <span style={{ color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{items}</span>
              {!portrait && <span><Pill tone={status === 'Preparing' ? 'green' : 'soft'} size={18}>{status}</Pill></span>}
              <b style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{DEMO.currency} {money(total)}</b>
            </div>
          ))}
        </Card>
      </Camera>
      {frame < 110 && (
        <Cursor from={[left + w * 0.5, top + 520]} to={portrait ? [left + w - 70, top + 52] : [left + w - 90, top + 56]} start={62} length={26} clickAt={92} />
      )}
    </AbsoluteFill>
  );
};

// 8. Step 4: the app, ready to build for the stores, with the honest fine print.
export const Stores: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const a = progress(frame, 8, 30);
  const b = progress(frame, 16, 30);
  const drift = progress(frame, 0, 174) * 30;
  const chips = ['iOS', 'Android', 'Web'];
  const textBlock = (
    <div>
      <StepHeader n={4} lead="Ready for the" words={['stores.']} portrait={portrait} />
      <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
        {chips.map((c, i) => <span key={c} style={{ transform: `scale(${pop(frame, 48 + i * 7, fps)})`, display: 'inline-block' }}><Pill tone={i === 0 ? 'ink' : 'soft'} size={30}>{c}</Pill></span>)}
      </div>
      <div style={{ marginTop: 34, fontFamily: FONT, fontSize: portrait ? 32 : 30, color: C.muted, maxWidth: 760, lineHeight: 1.35, ...rise(frame, 76) }}>
        Built with Flutter. Publish under your own name with your Apple and Google developer accounts.
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: portrait ? 64 : 110, top: portrait ? 80 : 300 }}>{textBlock}</div>
      <div style={{ position: 'absolute', left: portrait ? 190 : 1000, top: portrait ? 470 : 120, perspective: 1600 }}>
        <div style={{ position: 'absolute', left: portrait ? 300 : 300, top: 60 - drift * 0.6, opacity: b, transform: `translateY(${(1 - b) * 200}px) rotateY(-10deg)` }}>
          <Phone src="shots/web-menu.png" width={portrait ? 320 : 380} />
        </div>
        <div style={{ position: 'relative', top: -drift, opacity: a, transform: `translateY(${(1 - a) * 220}px) rotateY(8deg)` }}>
          <Phone src="shots/app-home.png" width={portrait ? 340 : 400} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 9. Recap: the three parts, side by side.
export const Recap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const parts = [
    { name: 'Website', src: 'shots/web-home.png' },
    { name: 'App', src: 'shots/app-home.png' },
    { name: 'Admin', src: 'shots/console-dashboard.png', wide: true },
  ];
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ marginTop: portrait ? 110 : 90 }}><Words text="Website. App. *Admin.*" start={0} gap={6} size={portrait ? 92 : 96} /></div>
      <div style={{ display: 'flex', gap: portrait ? 22 : 40, marginTop: portrait ? 70 : 60, alignItems: 'flex-end' }}>
        {parts.map((p, i) => {
          const k = pop(frame, 8 + i * 8, fps, 13);
          const w = portrait ? (p.wide ? 400 : 250) : (p.wide ? 760 : 300);
          return (
            <div key={p.name} style={{ textAlign: 'center', transform: `translateY(${(1 - k) * 160}px) rotate(${(1 - k) * (i - 1) * 8}deg)`, opacity: Math.min(1, k * 1.5) }}>
              {p.wide ? (
                <Card style={{ width: w, height: w * 0.62, padding: 0 }}><Img src={staticFile(p.src)} style={{ width: '100%' }} /></Card>
              ) : (
                <Phone src={p.src} width={w} />
              )}
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: portrait ? 34 : 36, marginTop: 20, color: C.ink }}>{p.name}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// 10. End card: the logo, the promise and the link.
export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const word = progress(frame, 12, 22);
  const tags = ['0% commission', 'Free & open source', 'Apache 2.0'];
  const url = typed(BRAND.repo, frame, 44, 1.6);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FONT, textAlign: 'center' }}>
      <LogoMark size={portrait ? 230 : 210} start={0} />
      <div style={{ fontWeight: 800, fontSize: portrait ? 96 : 104, letterSpacing: '-0.045em', lineHeight: 1, color: C.ink, marginTop: 22, opacity: word, transform: `translateY(${(1 - word) * 30}px)` }}>
        {portrait ? <>Free Restaurant<br />Ordering</> : BRAND.name}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 36, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
        {tags.map((t, i) => <span key={t} style={{ transform: `scale(${pop(frame, 26 + i * 5, fps)})`, display: 'inline-block' }}><Pill tone={i === 0 ? 'accent' : 'soft'} size={portrait ? 32 : 30}>{t}</Pill></span>)}
      </div>
      <div style={{ marginTop: 40, fontFamily: MONO, fontSize: portrait ? 34 : 36, color: C.ink, padding: '18px 28px', borderRadius: 18, background: '#fff', border: `1px solid ${C.line}`, minWidth: portrait ? 900 : 1040, opacity: progress(frame, 40, 8) }}>
        {url || ' '}
      </div>
    </AbsoluteFill>
  );
};
