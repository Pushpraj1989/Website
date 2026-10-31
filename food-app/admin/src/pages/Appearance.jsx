import React, { useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { ACCENTS, MODES, WALLPAPERS, changeAppearance, loadAppearance } from '../appearance.js';

// The console's own look, for whoever is signed in on this browser. The restaurant's customer theme is set under
// Restaurant and look; nothing here changes the app or the website.
const MODE_ICONS = { light: Sun, dark: Moon, auto: Monitor };

export default function Appearance() {
  const [prefs, setPrefs] = useState(loadAppearance);

  function set(patch, event) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const box = event?.currentTarget?.getBoundingClientRect?.();
    changeAppearance(next, box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h1>Appearance</h1>
          <p className="muted">How this console looks on this browser. Customers' app and website are set under Restaurant and look.</p>
        </div>
      </div>

      <div className="card stack">
        <div>
          <h2>Theme</h2>
          <p className="muted">Auto follows this device's light or dark setting.</p>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {MODES.map((m) => {
            const Icon = MODE_ICONS[m.id];
            return (
              <button key={m.id} type="button" role="radio" aria-checked={prefs.mode === m.id} className={prefs.mode === m.id ? 'seg on' : 'seg'} onClick={(e) => set({ mode: m.id }, e)}>
                <Icon className="icon" aria-hidden="true" />{m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card stack">
        <div>
          <h2>Wallpaper</h2>
          <p className="muted">Shows softly behind the cards. Plain keeps the cards solid.</p>
        </div>
        <div className="walls" role="radiogroup" aria-label="Wallpaper">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id} type="button" role="radio" aria-checked={prefs.wallpaper === w.id}
              className={prefs.wallpaper === w.id ? 'wall on' : 'wall'} onClick={(e) => set({ wallpaper: w.id }, e)}
            >
              <span className="wall-art" aria-hidden="true" style={w.colours ? { '--a': w.colours[0], '--b': w.colours[1], '--c': w.colours[2] } : undefined}>
                <span className="wall-card" /><span className="wall-card small" />
                {prefs.wallpaper === w.id ? <span className="wall-tick"><Check className="icon" /></span> : null}
              </span>
              <span>{w.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card stack">
        <div>
          <h2>Accent</h2>
          <p className="muted">{ACCENTS.find((a) => a.id === prefs.accent)?.label}. Used for buttons, the menu and charts.</p>
        </div>
        <div className="swatches" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button
              key={a.id} type="button" role="radio" aria-checked={prefs.accent === a.id} aria-label={a.label} title={a.label}
              className={prefs.accent === a.id ? 'swatch on' : 'swatch'} style={{ '--sw': a.value ?? 'var(--brand, #b45309)' }}
              onClick={(e) => set({ accent: a.id }, e)}
            >
              {a.id === 'brand' ? <span className="swatch-b" aria-hidden="true">B</span> : null}
              {prefs.accent === a.id ? <Check className="icon" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack">
        <div className="row between">
          <div>
            <h2>Glass</h2>
            <p className="muted">Clear shows more of the wallpaper; tinted is easier to read.</p>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Glass">
            {[['clear', 'Clear'], ['tinted', 'Tinted']].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={prefs.glass === id} className={prefs.glass === id ? 'seg on' : 'seg'} disabled={prefs.solid || prefs.wallpaper === 'plain'} onClick={(e) => set({ glass: id }, e)}>{label}</button>
            ))}
          </div>
        </div>
        <label className="choice">
          <input type="checkbox" checked={prefs.solid} onChange={(e) => set({ solid: e.target.checked })} />
          Reduce transparency: solid cards, no blur
        </label>
      </div>
    </section>
  );
}
