import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, MONO, DEMO } from '../theme';
import { Camera, Card, Caret, Cursor, Phone, Pill, StepHeader, usePortrait } from '../components';
import { money, pop, progress, rise, typed } from '../motion';

const Header: React.FC<{ portrait: boolean; children: React.ReactNode }> = ({ portrait, children }) => (
  <div style={{ position: 'absolute', left: portrait ? 64 : 110, top: portrait ? 80 : 86, right: 60 }}>{children}</div>
);

// 4. Step 1: one command on your own server; the restaurant is live.
export const Deploy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const cmd = 'curl -fsSL …/install.sh | sudo DOMAIN=order.yourrestaurant.com bash';
  const shown = typed(cmd, frame, 22, 1.25);
  const steps = [['Database', 86], ['HTTPS certificate', 96], ['Website · Console · App', 106]] as const;
  const live = progress(frame, 116, 22);
  const term = (
    <Card glow={false} style={{ background: '#121110', border: '1px solid #2b2724', width: portrait ? 952 : 900, ...rise(frame, 8, { lift: 60 }) }}>
      <div style={{ height: 52, display: 'flex', gap: 12, alignItems: 'center', padding: '0 24px', background: '#1d1a18' }}>
        {['#ef4444', '#f59e0b', '#22c55e'].map((c) => <i key={c} style={{ width: 15, height: 15, borderRadius: 99, background: c, display: 'block' }} />)}
        <span style={{ marginLeft: 16, color: '#a8a29e', fontFamily: MONO, fontSize: 18 }}>root@your-server</span>
      </div>
      <div style={{ padding: '30px 34px 36px', fontFamily: MONO, fontSize: portrait ? 29 : 28, lineHeight: 1.55, color: '#e7e5e4', minHeight: 330 }}>
        <div><span style={{ color: C.amber }}>$ </span>{shown}{shown.length < cmd.length ? <Caret size={30} color="#e7e5e4" /> : null}</div>
        {steps.map(([label, at]) => frame >= at && (
          <div key={label} style={{ ...rise(frame, at, { lift: 12, blur: 4, length: 10 }) }}><span style={{ color: '#4ade80' }}>✓</span> {label}</div>
        ))}
      </div>
    </Card>
  );
  const liveCard = (
    <Card style={{ width: portrait ? 952 : 620, padding: 36, opacity: live, transform: `translate(${portrait ? 0 : (1 - live) * 120}px, ${portrait ? (1 - live) * 80 : 0}px)` }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your restaurant is live</div>
      <div style={{ marginTop: 14, fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>order.yourrestaurant.com</div>
      <div style={{ display: 'flex', gap: 14, marginTop: 26, flexWrap: 'wrap' }}>
        {['Website', 'Admin console', 'Customer app'].map((label, i) => (
          <span key={label} style={{ transform: `scale(${pop(frame, 128 + i * 6, fps)})`, display: 'inline-block' }}><Pill tone="green" size={24}>● {label}</Pill></span>
        ))}
      </div>
    </Card>
  );
  return (
    <AbsoluteFill>
      <Header portrait={portrait}><StepHeader n={1} lead="Deploy on" words={['your server.']} portrait={portrait} /></Header>
      <Camera start={96} length={70} scale={1.04} x={0} y={portrait ? -40 : -10}>
        {portrait ? (
          <div style={{ position: 'absolute', left: 64, top: 300, display: 'flex', flexDirection: 'column', gap: 34 }}>{term}{liveCard}</div>
        ) : (
          <div style={{ position: 'absolute', left: 110, top: 300, display: 'flex', gap: 40, alignItems: 'flex-start' }}>{term}<div style={{ marginTop: 120 }}>{liveCard}</div></div>
        )}
      </Camera>
    </AbsoluteFill>
  );
};

// 5. Step 2: name and colour (the app follows), then the dishes.
export const Restaurant: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const swap = 92;
  const toDishes = progress(frame, swap, 16);
  const name = typed(DEMO.restaurant, frame, 16, 0.6);
  const swatches = ['#B45309', '#C2410C', '#BE123C', '#15803D', '#0F766E', '#4338CA'];
  const picked = frame >= 62 ? 1 : 0;
  const cardW = portrait ? 952 : 900;
  const left = portrait ? 64 : 110;
  const top = portrait ? 300 : 300;
  const restaurantCard = (
    <Card style={{ position: 'absolute', left, top, width: cardW, padding: 40, opacity: 1 - toDishes, filter: `blur(${toDishes * 12}px)`, ...(frame < swap ? rise(frame, 6, { lift: 60 }) : {}) }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Restaurant and look</div>
      <div style={{ marginTop: 26, fontSize: 24, fontWeight: 600, color: C.muted }}>Restaurant name</div>
      <div style={{ marginTop: 10, height: 76, borderRadius: 16, border: `2px solid ${C.accent}`, display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 38, fontWeight: 600 }}>
        {name}{name.length < DEMO.restaurant.length || frame < 50 ? <Caret size={38} /> : null}
      </div>
      <div style={{ marginTop: 30, fontSize: 24, fontWeight: 600, color: C.muted }}>Brand colour</div>
      <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
        {swatches.map((c, i) => (
          <div key={c} style={{ width: 64, height: 64, borderRadius: 18, background: c, outline: i === picked ? `4px solid ${C.ink}` : 'none', outlineOffset: 4 }} />
        ))}
      </div>
    </Card>
  );
  const dishesCard = (
    <Card style={{ position: 'absolute', left, top, width: cardW, padding: '34px 40px', opacity: toDishes, filter: `blur(${(1 - toDishes) * 10}px)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dishes</div>
        <Pill tone="accent" size={20}>+ Add dish</Pill>
      </div>
      {DEMO.dishes.map((d, i) => {
        const at = swap + 8 + i * 7;
        const on = progress(frame, at + 12, 8);
        return (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '16px 0', borderBottom: i < DEMO.dishes.length - 1 ? `1px solid ${C.line}` : 'none', ...rise(frame, at, { lift: 24, blur: 6, length: 14 }) }}>
            <Img src={staticFile(d.img)} style={{ width: 70, height: 70, borderRadius: 16, objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{d.name}</div>
              <div style={{ fontSize: 22, color: C.muted }}>{d.cat}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{DEMO.currency} {money(d.price)}</div>
            <div style={{ width: 66, height: 38, borderRadius: 99, background: on > 0.5 ? C.green : '#d6d3d1', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 4, left: 4 + on * 28, width: 30, height: 30, borderRadius: 99, background: '#fff' }} />
            </div>
          </div>
        );
      })}
    </Card>
  );
  return (
    <AbsoluteFill>
      <Header portrait={portrait}><StepHeader n={2} lead="Add your" words={['restaurant.', 'dishes.']} every={swap} portrait={portrait} /></Header>
      {restaurantCard}
      {frame >= swap - 2 && dishesCard}
      {!portrait && (
        <div style={{ position: 'absolute', left: 1120, top: 170, ...rise(frame, 22, { lift: 140, length: 26 }), transform: `${rise(frame, 22, { lift: 140, length: 26 }).transform} rotate(-3deg)` }}>
          <Phone src="shots/app-home.png" width={400} scrollTo={toDishes > 0 ? 520 : 0} scrollStart={swap + 10} />
        </div>
      )}
      {frame < swap && <Cursor from={[left + 700, top + 520]} to={[left + 40 + 82 + 32, top + 405]} start={36} length={22} clickAt={62} />}
    </AbsoluteFill>
  );
};

// 6. Step 3: offers, vouchers and campaigns; then a new order arrives.
export const Offers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const toast = progress(frame, 130, 18);
  const cards = [
    { at: 10, el: (
      <Card style={{ width: portrait ? 520 : 540, height: 300, background: `linear-gradient(135deg, #D97706, ${C.accent} 55%, #7C2D12)`, color: '#fff', padding: 36, border: 'none' }}>
        <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Welcome offer</div>
        <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 6 }}>10% OFF</div>
        <div style={{ display: 'inline-block', marginTop: 12, padding: '8px 18px', border: '2px dashed rgba(255,255,255,.85)', borderRadius: 12, fontSize: 28, fontWeight: 700 }}>WELCOME10</div>
        <div style={{ fontSize: 22, marginTop: 14, opacity: 0.9 }}>Min AED 30 · up to AED 20 off</div>
      </Card>
    ) },
    { at: 40, el: (
      <Card style={{ width: portrait ? 420 : 430, height: 300, padding: 36, background: 'linear-gradient(135deg, #0F766E, #134E4A)', color: '#fff', border: 'none' }}>
        <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Printed voucher</div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 6 }}>AED 5</div>
        <div style={{ fontSize: 28, fontWeight: 600 }}>off your next order</div>
      </Card>
    ) },
    { at: 70, el: (
      <Card style={{ width: portrait ? 952 : 520, padding: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Campaign · home screen</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, padding: 14, borderRadius: 16, background: `linear-gradient(110deg, ${C.accent}, #7C2D12)`, color: '#fff' }}>
          <span style={{ background: '#fff', color: C.ink, fontWeight: 900, fontSize: 22, padding: '6px 12px', borderRadius: 8, transform: 'rotate(-3deg)' }}>FREE DELIVERY</span>
          <span style={{ fontSize: 24, fontWeight: 600 }}>Free delivery with FREEDEL</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}><Pill tone="green" size={20}>● Live</Pill><Pill size={20}>Hero · Pop-up · Strip</Pill></div>
      </Card>
    ) },
  ];
  return (
    <AbsoluteFill>
      <Header portrait={portrait}><StepHeader n={3} lead="Run" words={['offers.', 'vouchers.', 'campaigns.']} every={34} portrait={portrait} /></Header>
      <div style={{ position: 'absolute', left: portrait ? 64 : 110, top: portrait ? 300 : 330, display: 'flex', flexWrap: 'wrap', gap: 30, width: portrait ? 960 : 1700 }}>
        {cards.map((c, i) => {
          const p = pop(frame, c.at, fps, 15);
          return <div key={i} style={{ transform: `translateY(${(1 - p) * 120}px) rotate(${(1 - p) * (i - 1) * 6}deg) scale(${0.9 + 0.1 * Math.min(1, p)})`, opacity: Math.min(1, p * 1.4) }}>{c.el}</div>;
        })}
      </div>
      <div style={{ position: 'absolute', right: portrait ? 50 : 90, top: portrait ? 1000 : 70, opacity: toast, transform: `translateY(${(1 - toast) * -40}px)` }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 30px', borderRadius: 22 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: C.accent, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800 }}>✓</div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>New order #41</div>
            <div style={{ fontSize: 22, color: C.muted }}>AED 95.00 · Pickup · just now</div>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

