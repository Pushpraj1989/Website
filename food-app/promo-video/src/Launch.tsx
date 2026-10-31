import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Backdrop, CornerBrand, SCENE_STARTS } from './components';
import { sceneFade } from './motion';
import { loadFonts } from './fonts';
import { Hook, Brand, Promise as PromiseScene } from './scenes/Opening';
import { Deploy, Restaurant, Offers } from './scenes/Steps';
import { Dashboard, Stores, Recap, End } from './scenes/Proof';

loadFonts();

export const DURATION = 1440; // 48 s at 30 fps
const SCENES: React.FC[] = [Hook, Brand, PromiseScene, Deploy, Restaurant, Offers, Dashboard, Stores, Recap, End];

/** One scene, with the shared blur crossfade at its start and end. */
const Shell: React.FC<{ duration: number; last: boolean; children: React.ReactNode }> = ({ duration, last, children }) => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, last ? duration + 100 : duration);
  return <AbsoluteFill style={fade}>{children}</AbsoluteFill>;
};

// The whole film: the drifting glow, the ten scenes in order (see STORYBOARD.md), and the corner brand.
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
