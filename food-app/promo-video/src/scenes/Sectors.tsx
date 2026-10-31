import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, FONT, SECTORS } from '../theme';
import { Phone, usePortrait, Words } from '../components';
import { clamp, easeInOut, progress } from '../motion';

// "Every business": the real app, set up for each sector (its name, colour and products, in shop or restaurant mode),
// on phones that slide along a curve. The phone at the centre is upright and large; the others turn away and drop
// along the arc. The label under the centre phone names its business: "Your fashion app is ready."
export const Sectors: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const n = SECTORS.length;
  // The ring turns one step every 22 frames after a short hold, easing into each stop.
  const stepFrames = 22;
  const start = 26;
  const raw = Math.max(0, (frame - start) / stepFrames);
  const whole = Math.floor(raw);
  const turn = whole + easeInOut(Math.min(1, (raw - whole) * 1.6));
  const centre = ((Math.round(turn) % n) + n) % n;
  const enter = progress(frame, 0, 26);
  const phoneW = portrait ? 300 : 280;
  const radius = portrait ? 610 : 760;
  const label = SECTORS[centre];
  const labelIn = progress((frame - start) % stepFrames, 0, 8);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: portrait ? 90 : 70, left: 0, right: 0 }}>
        <Words text="One app. *Every business.*" start={0} gap={5} size={portrait ? 84 : 92} />
      </div>
      <div style={{ position: 'absolute', left: '50%', top: portrait ? 350 : 230, width: 0, height: 0, perspective: 1800 }}>
        {SECTORS.map((sector, i) => {
          // Angle of this phone on the ring, in steps from the centre, wrapped to the nearest side.
          let d = i - turn;
          d = ((d % n) + n + n / 2) % n - n / 2;
          const a = d * 0.42; // radians between neighbours
          if (Math.abs(a) > 1.5) return null;
          const x = Math.sin(a) * radius;
          const y = (1 - Math.cos(a)) * (portrait ? 300 : 260);
          const scale = 0.62 + 0.38 * Math.cos(a);
          const z = Math.cos(a);
          const fade = interpolate(Math.abs(a), [1.05, 1.5], [1, 0], clamp) * enter;
          return (
            <div
              key={sector.key}
              style={{
                position: 'absolute', left: -phoneW / 2, top: 0, zIndex: Math.round(z * 100),
                transform: `translate(${x}px, ${y + (1 - enter) * 300}px) scale(${scale}) rotateY(${-a * 38}deg)`,
                opacity: fade, filter: `brightness(${0.75 + 0.25 * z})`,
              }}
            >
              <Phone src={sector.shot} width={phoneW} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: portrait ? 120 : 92, textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: portrait ? 54 : 52, letterSpacing: '-0.03em', color: C.ink, opacity: frame < start ? progress(frame, 12, 14) : labelIn }}>
        Your <span style={{ color: C.accent }}>{label.name}</span> app is ready.
      </div>
    </AbsoluteFill>
  );
};
