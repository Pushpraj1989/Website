import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Backdrop, CornerBrand, SCENE_STARTS } from './components';
import { sceneFade } from './motion';
import { loadFonts } from './fonts';
import { Hook, Brand, Promise as PromiseScene } from './scenes/Opening';
import { Deploy, Restaurant, Offers } from './scenes/Steps';
import { Dashboard, Stores, End } from './scenes/Proof';
import { Sectors } from './scenes/Sectors';
import { SCENE_PLAN } from './content';

loadFonts();

export const DURATION = SCENE_PLAN.reduce((n, s) => n + s.frames, 0); // at 30 fps
const REGISTRY: Record<string, React.FC> = { hook: Hook, brand: Brand, promise: PromiseScene, deploy: Deploy, details: Restaurant, offers: Offers, dashboard: Dashboard, stores: Stores, sectors: Sectors, end: End };
const SCENES: React.FC[] = SCENE_PLAN.map((s) => {
  if (!REGISTRY[s.id]) throw new Error(`Unknown scene id "${s.id}" in SCENE_PLAN`);
  return REGISTRY[s.id];
});

/** One scene, with the shared blur crossfade at its start and end. */
const Shell: React.FC<{ duration: number; last: boolean; children: React.ReactNode }> = ({ duration, last, children }) => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, last ? duration + 100 : duration);
  return <AbsoluteFill style={fade}>{children}</AbsoluteFill>;
};

// The whole film: the drifting glow, the scenes in SCENE_PLAN order (see STORYBOARD.md), and the corner brand.
export const Launch: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    {SCENES.map((Scene, i) => {
      const from = SCENE_STARTS[i];
      const to = i < SCENES.length - 1 ? SCENE_STARTS[i + 1] : DURATION;
      return (
        <Sequence key={i} from={from} durationInFrames={to - from} name={Scene.name || `Scene ${i + 1}`}>
          <Shell duration={to - from} last={i === SCENES.length - 1}><Scene /></Shell>
        </Sequence>
      );
    })}
    <CornerBrand />
  </AbsoluteFill>
);
