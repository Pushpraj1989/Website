import React from 'react';
import { Composition } from 'remotion';
import { Film, filmLength } from './Film';
import { FILMS } from './sectors';

// Each business type in two sizes: the 16:9 master and the 4:5 feed version.
export const Root: React.FC = () => (
  <>
    {FILMS.map((f) => (
      <React.Fragment key={f.id}>
        <Composition id={`${f.id}-wide`} component={Film} defaultProps={{ film: f }} durationInFrames={filmLength(f)} fps={30} width={1920} height={1080} />
        <Composition id={`${f.id}-feed`} component={Film} defaultProps={{ film: f }} durationInFrames={filmLength(f)} fps={30} width={1080} height={1350} />
      </React.Fragment>
    ))}
  </>
);
