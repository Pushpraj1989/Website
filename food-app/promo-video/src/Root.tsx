import React from 'react';
import { Composition } from 'remotion';
import { Launch, DURATION } from './Launch';

// Two sizes of the same film: the 16:9 master and the 4:5 LinkedIn feed version. Scenes lay themselves out for each.
export const Root: React.FC = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
    <Composition id="LaunchFeed" component={Launch} durationInFrames={DURATION} fps={30} width={1080} height={1350} />
  </>
);
