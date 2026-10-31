// How the console looks for this member of staff: light or dark, a wallpaper behind frosted cards, an accent colour,
// clear or tinted glass, and solid cards for anyone who finds transparency hard to read. Saved in this browser only;
// nothing here changes what customers see.

const KEY = 'console-appearance';

export const MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' },
];

// Three colours each, blended softly behind the cards. Plain has no wallpaper and solid cards.
export const WALLPAPERS = [
  { id: 'plain', label: 'Plain', colours: null },
  { id: 'stone', label: 'Stone', colours: ['#a8a29e', '#d6d3d1', '#78716c'] },
  { id: 'dune', label: 'Dune', colours: ['#f59e0b', '#fcd34d', '#d97706'] },
  { id: 'olive', label: 'Olive', colours: ['#84cc16', '#a3e635', '#4d7c0f'] },
  { id: 'lagoon', label: 'Lagoon', colours: ['#14b8a6', '#22d3ee', '#0e7490'] },
  { id: 'haze', label: 'Haze', colours: ['#94a3b8', '#c4b5fd', '#475569'] },
  { id: 'ocean', label: 'Ocean', colours: ['#2563eb', '#06b6d4', '#7c3aed'] },
  { id: 'rose', label: 'Rose', colours: ['#ec4899', '#a855f7', '#f43f5e'] },
  { id: 'sunset', label: 'Sunset', colours: ['#f97316', '#ef4444', '#a855f7'] },
  { id: 'forest', label: 'Forest', colours: ['#16a34a', '#0d9488', '#65a30d'] },
  { id: 'dusk', label: 'Dusk', colours: ['#4f46e5', '#7c3aed', '#1e3a8a'] },
];

// Every accent keeps white text readable on it (4.5:1 or better). "Brand" follows the restaurant's own colour.
export const ACCENTS = [
  { id: 'brand', label: 'Brand colour', value: null },
  { id: 'blue', label: 'Blue', value: '#2563eb' },
  { id: 'violet', label: 'Violet', value: '#7c3aed' },
  { id: 'rose', label: 'Rose', value: '#be185d' },
  { id: 'orange', label: 'Orange', value: '#c2410c' },
  { id: 'green', label: 'Green', value: '#15803d' },
  { id: 'graphite', label: 'Graphite', value: '#3f3f46' },
];

export const DEFAULTS = { mode: 'auto', wallpaper: 'plain', accent: 'brand', glass: 'tinted', solid: false };

export function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      mode: MODES.some((m) => m.id === saved.mode) ? saved.mode : DEFAULTS.mode,
      wallpaper: WALLPAPERS.some((w) => w.id === saved.wallpaper) ? saved.wallpaper : DEFAULTS.wallpaper,
      accent: ACCENTS.some((a) => a.id === saved.accent) ? saved.accent : DEFAULTS.accent,
      glass: saved.glass === 'clear' ? 'clear' : 'tinted',
      solid: saved.solid === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppearance(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private windows can refuse storage; the choice then lasts until the page is closed.
  }
}

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');
export const resolvedMode = (mode) => (mode === 'auto' ? (darkQuery()?.matches ? 'dark' : 'light') : mode);

let brandColour = null;
export function setBrandColour(colour) {
  brandColour = colour;
  applyAppearance(loadAppearance());
}

export function applyAppearance(prefs) {
  const root = document.documentElement;
  root.dataset.mode = resolvedMode(prefs.mode);
  root.dataset.wallpaper = prefs.wallpaper;
  root.dataset.glass = prefs.glass;
  root.dataset.solid = String(prefs.solid || prefs.wallpaper === 'plain');
  const wall = WALLPAPERS.find((w) => w.id === prefs.wallpaper)?.colours;
  ['--w1', '--w2', '--w3'].forEach((name, i) => (wall ? root.style.setProperty(name, wall[i]) : root.style.removeProperty(name)));
  const accent = ACCENTS.find((a) => a.id === prefs.accent)?.value ?? brandColour;
  if (accent) root.style.setProperty('--accent', accent);
  else root.style.removeProperty('--accent');
  root.style.colorScheme = root.dataset.mode;
}

/**
 * Applies a change. A switch between light and dark spreads out in a circle from where it was pressed, where the
 * browser can do that and motion is not reduced; anything else changes at once.
 */
export function changeAppearance(prefs, from) {
  saveAppearance(prefs);
  const before = document.documentElement.dataset.mode;
  const flips = resolvedMode(prefs.mode) !== before;
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!flips || calm || !document.startViewTransition) {
    applyAppearance(prefs);
    return;
  }
  const x = from?.x ?? window.innerWidth / 2;
  const y = from?.y ?? 0;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(() => applyAppearance(prefs));
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}

/** Keeps Auto in step with the device when it switches between light and dark. */
export function followDevice() {
  const q = darkQuery();
  const onChange = () => { if (loadAppearance().mode === 'auto') applyAppearance(loadAppearance()); };
  q?.addEventListener?.('change', onChange);
}
