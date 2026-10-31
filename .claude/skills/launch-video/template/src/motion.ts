import { Easing, interpolate, spring } from 'remotion';

// The motion system (see STORYBOARD.md): one place for easing, entrances, blur transitions, counters and springs.
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0 → 1 between two frames, eased out. */
export const progress = (frame: number, start: number, length: number, ease = easeOut) =>
  interpolate(frame, [start, start + length], [0, 1], { ...clamp, easing: ease });

/** A word or card rising in: opacity, lift and blur. */
export function rise(frame: number, start: number, { length = 18, lift = 40, blur = 8 } = {}) {
  const p = progress(frame, start, length);
  return { opacity: p, transform: `translateY(${(1 - p) * lift}px)`, filter: `blur(${(1 - p) * blur}px)` };
}

/** The blur crossfade every scene uses at its start and end. */
export function sceneFade(frame: number, duration: number) {
  const inP = progress(frame, 0, 16);
  const outP = interpolate(frame, [duration - 12, duration], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const blur = (1 - inP) * 10 + outP * 14;
  return { opacity: Math.min(inP, 1 - outP), filter: blur > 0.05 ? `blur(${blur}px)` : undefined };
}

/** A number counting up, eased. */
export const count = (frame: number, start: number, length: number, to: number, from = 0) =>
  from + (to - from) * progress(frame, start, length, easeInOut);

/** A springy pop from 0 to 1. */
export const pop = (frame: number, start: number, fps: number, damping = 14) =>
  spring({ frame: frame - start, fps, config: { damping, stiffness: 160, mass: 0.7 } });

export const money = (v: number, decimals = 2) =>
  v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** The text typed so far, at a speed in characters per frame. */
export const typed = (text: string, frame: number, start: number, perFrame = 1.6) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * perFrame)));
