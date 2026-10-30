// The restaurant's theme for the web pages, matching the customer app (mobile/lib/core/theme.dart): the same four
// looks, the same colours, and the same rule for brand-coloured text: moved towards white or black only as far as
// needed to reach 4.5:1 on every background it meets.
import type { ButtonStyle, Theme } from './restaurant-settings.ts';

type Rgba = [number, number, number, number];
type Palette = {
  dark: boolean; glass: boolean;
  bg: string; surface: string; base: string; border: string; borderInput: string;
  text: string; textMuted: string; danger: string; success: string; warning: string;
};

export const PALETTES: Record<Theme, Palette> = {
  classic: { dark: false, glass: false, bg: '#FFFFFFFF', surface: '#F5F5F4FF', base: '#F5F5F4FF', border: '#E7E5E4FF', borderInput: '#78716CFF', text: '#1C1917FF', textMuted: '#57534EFF', danger: '#B91C1CFF', success: '#15803DFF', warning: '#92400EFF' },
  midnight: { dark: true, glass: false, bg: '#1C1A18FF', surface: '#0F0E0DFF', base: '#0F0E0DFF', border: '#34302CFF', borderInput: '#8A847EFF', text: '#F5F5F4FF', textMuted: '#B0AAA4FF', danger: '#F87171FF', success: '#4ADE80FF', warning: '#FCD34DFF' },
  glass: { dark: false, glass: true, bg: '#FFFFFF8C', surface: '#00000000', base: '#FFFFFFFF', border: '#1C19171F', borderInput: '#6B655FFF', text: '#1C1917FF', textMuted: '#48433FFF', danger: '#991B1BFF', success: '#15803DFF', warning: '#92400EFF' },
  glass_night: { dark: true, glass: true, bg: '#FFFFFF1A', surface: '#00000000', base: '#0B0A09FF', border: '#FFFFFF2E', borderInput: '#9A948EFF', text: '#FAFAF9FF', textMuted: '#D0CAC4FF', danger: '#FCA5A5FF', success: '#4ADE80FF', warning: '#FCD34DFF' },
};

const parse = (hex: string): Rgba => {
  const h = hex.replace('#', '');
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
};
const hex = ([r, g, b]: Rgba) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const css = ([r, g, b, a]: Rgba) => (a >= 1 ? hex([r, g, b, 1]) : `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a.toFixed(2)})`);
const mix = (a: Rgba, b: Rgba, t: number): Rgba => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];
/** A translucent colour laid over an opaque one. */
const over = (top: Rgba, under: Rgba): Rgba => mix(under, [top[0], top[1], top[2], 1], top[3]);

function luminance([r, g, b]: Rgba): number {
  const c = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
export function contrast(a: Rgba, b: Rgba): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function readableOn(colour: Rgba, backgrounds: Rgba[], toLight: boolean): Rgba {
  const end: Rgba = toLight ? [255, 255, 255, 1] : [0, 0, 0, 1];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(colour, end, t);
    if (backgrounds.every((b) => contrast(c, b) >= 4.5)) return c;
  }
  return end;
}

/** The colours a page needs for this theme and brand colour, and every background text may sit on. */
export function themeColours(theme: Theme, brandHex: string) {
  const p = PALETTES[theme];
  const accent = parse(brandHex);
  const base = parse(p.base);
  const card = over(parse(p.bg), base);
  const glow = p.dark ? mix(base, accent, 0.38) : mix(base, accent, 0.24);
  const page = [base, card, ...(p.glass ? [glow, over(parse(p.bg), glow)] : [])];
  return { p, accent, base, card, glow, page, accentFg: readableOn(accent, page, p.dark) };
}

/** CSS custom properties for the page: set on <html> next to data-theme. */
export function themeStyle(theme: Theme, brandHex: string, buttonStyle: ButtonStyle = 'light'): Record<string, string> {
  const { p, accent, base, glow, accentFg } = themeColours(theme, brandHex);
  // Small buttons in the chosen style: light (white, brand words), tonal (a soft tint, readable ink), filled (brand).
  const soft = p.dark ? mix(accent, base, 0.72) : mix(accent, [255, 255, 255, 1], 0.88);
  const ink = readableOn(accent, [soft], p.dark);
  const button = buttonStyle === 'filled' ? { bg: hex(accent), fg: '#FFFFFF', line: hex(accent) }
    : buttonStyle === 'tonal' ? { bg: hex(soft), fg: hex(ink), line: 'transparent' }
      : { bg: '#FFFFFF', fg: hex(accent), line: p.dark ? 'transparent' : hex(mix(accent, [255, 255, 255, 1], 0.65)) };
  const backdrop = !p.glass
    ? css(parse(p.surface))
    : p.dark
      ? `radial-gradient(140% 120% at 10% 0%, ${hex(glow)} 0%, ${hex(mix(base, accent, 0.12))} 55%, ${hex(base)} 100%)`
      : `linear-gradient(135deg, ${hex(glow)} 0%, ${hex(mix(base, accent, 0.06))} 55%, ${hex(mix(base, accent, 0.18))} 100%)`;
  return {
    '--color-bg': css(parse(p.bg)),
    '--color-surface': p.glass ? css(parse(p.dark ? '#FFFFFF17' : '#1C191712')) : css(parse(p.surface)),
    '--color-border': css(parse(p.border)),
    '--color-border-input': css(parse(p.borderInput)),
    '--color-text': css(parse(p.text)),
    '--color-text-muted': css(parse(p.textMuted)),
    '--color-danger': css(parse(p.danger)),
    '--color-success': css(parse(p.success)),
    '--color-warning': css(parse(p.warning)),
    '--color-accent': hex(accent),
    '--color-accent-fg': hex(accentFg),
    '--page-backdrop': backdrop,
    '--btn-bg': button.bg,
    '--btn-fg': button.fg,
    '--btn-line': button.line,
    'color-scheme': p.dark ? 'dark' : 'light',
  };
}
