// The web pages' theme colours: every text colour reaches 4.5:1 on what it sits on, for every theme and for brand
// colours across the whole range the settings accept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, themeColours, themeStyle, PALETTES } from '../lib/theme.ts';
import { contrastWithWhite, THEMES } from '../lib/restaurant-settings.ts';

const accepted: string[] = [];
for (let r = 0; r < 256; r += 34) for (let g = 0; g < 256; g += 34) for (let b = 0; b < 256; b += 34) {
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  if (contrastWithWhite(hex) >= 4.5) accepted.push(hex);
}
const rgba = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 1] as [number, number, number, number];

test('many accepted brand colours are tried', () => assert.ok(accepted.length > 200));

for (const theme of THEMES) {
  test(`${theme}: text, muted, danger and brand text are readable on every background`, () => {
    for (const brand of accepted) {
      const c = themeColours(theme, brand);
      for (const bg of c.page) {
        for (const [name, colour] of [['text', PALETTES[theme].text], ['muted', PALETTES[theme].textMuted], ['danger', PALETTES[theme].danger]] as const) {
          assert.ok(contrast(rgba(colour), bg) >= 4.5, `${name} with ${brand}`);
        }
        assert.ok(contrast(c.accentFg, bg) >= 4.5, `brand text ${brand}`);
      }
    }
  });
}

test('the page gets the theme as CSS variables, with the true brand colour for buttons', () => {
  const style = themeStyle('glass_night', '#1E3A8A');
  assert.equal(style['--color-accent'], '#1E3A8A');
  assert.notEqual(style['--color-accent-fg'], '#1E3A8A');
  assert.match(style['--page-backdrop'], /radial-gradient/);
  assert.equal(style['color-scheme'], 'dark');
});
