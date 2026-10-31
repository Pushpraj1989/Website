'use client';

import { useEffect, useRef } from 'react';
import { preload } from 'react-dom';

// A silent looping clip that never shows an empty box: its poster (a still of the first frame) shows at once, and
// the video plays over it when it has loaded. It only downloads and plays while it is on screen, so the clip at the
// top is not slowed down by the ones further down. A visitor who asks for less motion sees the still only.
//   first:  the clip at the top of the page. It starts loading straight away, poster first.
//   active: false for a hero slide that is not showing; it waits, then plays the moment it is shown.
//   warm:   load ahead without playing (the hero's next slide), so it is ready when it comes up.
export function LoopVideo({ src, poster, first = false, active = true, warm = false, hidden = false }: {
  src: string; poster?: string | null; first?: boolean; active?: boolean; warm?: boolean; hidden?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  if (first && poster) preload(poster, { as: 'image', fetchPriority: 'high' });

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    video.muted = true; // iPhones only start a video by itself when it is muted, set as a property too.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      return undefined;
    }
    let onScreen = first;
    let warmTimer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (active && onScreen) {
        if (video.preload !== 'auto') video.preload = 'auto';
        video.play().catch(() => { /* Low-power mode or no autoplay: the poster stays. */ });
      } else {
        video.pause();
      }
    };
    // The next slide loads ahead only once the page has loaded and the first clip has had a head start, so it never
    // competes with what the visitor is looking at.
    const startWarming = () => { warmTimer = setTimeout(() => { if (video.preload !== 'auto') video.preload = 'auto'; }, 2500); };
    if (warm && !active) {
      if (document.readyState === 'complete') startWarming();
      else window.addEventListener('load', startWarming, { once: true });
    }
    update();
    const stop = () => {
      clearTimeout(warmTimer);
      window.removeEventListener('load', startWarming);
    };
    if (typeof IntersectionObserver === 'undefined') {
      onScreen = true;
      update();
      return stop;
    }
    const watch = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    }, { rootMargin: '200px' });
    watch.observe(video);
    return () => {
      stop();
      watch.disconnect();
    };
  }, [active, warm, first]);

  return (
    <video
      ref={ref} src={src} poster={poster ?? undefined} muted loop playsInline
      autoPlay={first && active} preload={first ? 'auto' : 'none'}
      aria-hidden={hidden ? 'true' : undefined}
    />
  );
}
