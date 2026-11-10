#!/usr/bin/env python3
"""Original soundtracks for the sector films, synthesised from scratch (no samples, no third-party music), so they
are ours to use anywhere. Timed to each film's scenes: soft intro under the hook, the groove from "meet", a breakdown
at "And the back office", the groove again, and a final ringing chord on the end card.

    python3 music/compose.py salon|pharmacy out.wav      (needs numpy)
"""
import sys
import wave

import numpy as np

SR = 44100
FPS = 30


def scenes(film):
    """Scene start times in seconds, mirroring parts() in src/Film.tsx."""
    tour = 96 * film['tour']
    frames = [('hook', 105), ('meet', 180), ('tour', tour)]
    if film['booking']:
        frames.append(('booking', 240))
    frames.append(('office', 90))
    frames += [(f'clip{i}', s * 30 + 24) for i, s in enumerate([13, 8, 10, 9, 6])]
    frames += [('link', 150), ('dashboard', 165), ('features', 210), ('end', 165)]
    t, out = 0, {}
    for name, n in frames:
        out[name] = t / FPS
        t += n
    return out, t / FPS


FILMS = {
    'salon': {
        'tour': 8, 'booking': True, 'bpm': 100,
        # Fmaj7 - G6 - Em7 - Am7, warm and lifting; ends on Cmaj9
        'chords': [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]],
        'roots': [41, 43, 40, 45],
        'final': ([48, 52, 55, 59, 62], 36),
        'lead': 'ep', 'drums': 1.0, 'bright': 5200,
    },
    'pharmacy': {
        'tour': 7, 'booking': False, 'bpm': 92,
        # Dmaj7 - A/C# - Bm7 - Gmaj7, calm and clean; ends on Dmaj9
        'chords': [[50, 54, 57, 61], [49, 52, 57, 64], [47, 50, 54, 57], [43, 47, 50, 54]],
        'roots': [38, 37, 35, 43],
        'final': ([50, 54, 57, 61, 64], 38),
        'lead': 'bell', 'drums': 0.75, 'bright': 6500,
    },
}


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, r, hold=None):
    """Attack/release envelope over n samples (seconds)."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    if r > 0:
        tail = (n / SR) - r
        e *= np.clip(1 - (t - tail) / r, 0, 1)
    return e


def table_saw(f, cap):
    """One cycle of a band-limited saw (harmonics below cap Hz), soft roll-off."""
    ph = np.linspace(0, 1, 2048, endpoint=False)
    w = np.zeros_like(ph)
    for k in range(1, max(2, int(cap / f)) + 1):
        w += np.sin(2 * np.pi * k * ph) / k * (1 / (1 + (k / 6) ** 2))
    return w / np.abs(w).max()


def osc(table, f, n, phase0=0.0):
    ph = (phase0 + f * np.arange(n) / SR) % 1.0
    return np.interp(ph * len(table), np.arange(len(table)), table, period=len(table))


class Mix:
    def __init__(self, seconds):
        self.n = int(seconds * SR) + SR * 4
        self.bus = {k: np.zeros((2, self.n)) for k in ('pad', 'bass', 'keys', 'drums', 'fx')}

    def add(self, bus, t, sig, pan=0.0, gain=1.0):
        i = int(t * SR)
        if i >= self.n:
            return
        sig = sig[: self.n - i]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.bus[bus][0, i:i + len(sig)] += sig * l * gain * 1.414
        self.bus[bus][1, i:i + len(sig)] += sig * r * gain * 1.414


def pad(mix, t, notes, dur, cap, gain=0.04):
    n = int(dur * SR)
    for j, note in enumerate(notes):
        for d, pan in ((-7, -0.6), (0, 0), (7, 0.6)):
            f = hz(note) * 2 ** (d / 1200)
            s = osc(table_saw(f, cap), f, n, phase0=(j * 0.37 + d * 0.11) % 1)
            mix.add('pad', t, s * env(n, 0.9, 1.2), pan, gain)


def bass(mix, t, note, dur, gain=0.32):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = hz(note)
    s = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt) + 0.08 * np.sin(6 * np.pi * f * tt)
    mix.add('bass', t, s * env(n, 0.01, 0.08) * np.exp(-tt * 0.6), 0, gain)


def key(mix, t, note, kind, gain=0.12, pan=0.0):
    dur = 1.6 if kind == 'ep' else 2.4
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = hz(note)
    if kind == 'ep':  # electric piano: FM, ratio 1, quick index decay
        s = np.sin(2 * np.pi * f * tt + 1.8 * np.exp(-tt * 6) * np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 2.6)
    else:  # glassy bell: FM, ratio 3.5
        s = np.sin(2 * np.pi * f * tt + 2.2 * np.exp(-tt * 4) * np.sin(2 * np.pi * 3.5 * f * tt)) * np.exp(-tt * 2.0)
    mix.add('keys', t, s * env(n, 0.003, 0.05), pan, gain)


rng = np.random.default_rng(7)


def noise(n):
    return rng.standard_normal(n)


def band(sig, lo, hi):
    spec = np.fft.rfft(sig)
    fr = np.fft.rfftfreq(len(sig), 1 / SR)
    spec[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(spec, len(sig))


def kick(mix, t, g):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = 48 + 90 * np.exp(-tt * 38)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    s += band(noise(n), 1500, 6000) * np.exp(-tt * 120) * 0.15
    mix.add('drums', t, s, 0, 0.55 * g)


def clap(mix, t, g):
    n = int(0.25 * SR)
    tt = np.arange(n) / SR
    s = band(noise(n), 900, 5000) * (np.exp(-tt * 28) + 0.5 * np.exp(-np.maximum(tt - 0.012, 0) * 35) * (tt > 0.012))
    mix.add('drums', t, s, 0.1, 0.16 * g)


def hat(mix, t, g, pan):
    n = int(0.09 * SR)
    tt = np.arange(n) / SR
    mix.add('drums', t, band(noise(n), 7000, 15000) * np.exp(-tt * 55), pan, 0.06 * g)


def riser(mix, t_end, length=2.0, gain=0.07):
    n = int(length * SR)
    tt = np.arange(n) / SR
    s = noise(n)
    out = np.zeros(n)
    seg = SR // 20
    for i in range(0, n, seg):  # a band sweeping upward
        p = i / n
        out[i:i + seg] = band(s[i:i + seg], 400 + 5000 * p ** 2, 1200 + 9000 * p ** 2)
    mix.add('fx', t_end - length, out * (tt / length) ** 2, 0, gain)


def impact(mix, t, gain=0.12):
    n = int(2.5 * SR)
    tt = np.arange(n) / SR
    s = band(noise(n), 60, 2500) * np.exp(-tt * 3) + np.sin(2 * np.pi * 45 * tt) * np.exp(-tt * 4) * 1.5
    mix.add('fx', t, s, 0, gain)


def reverb(x, seconds=2.4, damp=5000):
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = band(noise(n), 150, damp) * np.exp(-tt * 3.2)
        ir /= np.sqrt((ir ** 2).sum())
        size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        out[ch] = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: x.shape[1]]
    return out


def compose(name):
    cfg = FILMS[name]
    sc, total = scenes(cfg)
    beat = 60 / cfg['bpm']
    bar = beat * 4
    mix = Mix(total)
    g = cfg['drums']
    end = sc['end']
    groove = [(sc['meet'], sc['office']), (sc['clip0'], end)]
    in_groove = lambda t: any(a - 1e-6 <= t < b for a, b in groove)
    kick_times = []

    # Harmony: one chord per bar, pad all the way; bass in the groove.
    t, i = 0.0, 0
    while t < end:
        ch = cfg['chords'][i % 4]
        dur = min(bar, end - t) + 1.2
        pad(mix, t, ch, dur, cfg['bright'] * (0.55 if not in_groove(t) else 1.0))
        if in_groove(t):
            for b in range(4):
                bt = t + b * beat
                if bt < end:
                    bass(mix, bt, cfg['roots'][i % 4], beat * (0.9 if b % 2 == 0 else 0.5), 0.3 if b % 2 == 0 else 0.18)
        # Keys: an eighth-note arpeggio over the chord, an octave up (sparser before the groove).
        notes = [n + 12 for n in ch] + [ch[1] + 24]
        pattern = [0, 2, 1, 3, 4, 2, 3, 1]
        for k in range(8):
            kt = t + k * beat / 2
            if kt >= end or (not in_groove(kt) and k % 2):
                continue
            key(mix, kt, notes[pattern[k]], cfg['lead'], 0.11 if k % 2 == 0 else 0.07, pan=0.35 * np.sin(k))
        t += bar
        i += 1

    # Drums on a global grid, only inside the groove sections.
    b = 0
    while b * beat < end:
        bt = b * beat
        if in_groove(bt):
            kick(mix, bt, g)
            kick_times.append(bt)
            if b % 2 == 1:
                clap(mix, bt, g)
            hat(mix, bt + beat / 2, g, 0.3)
            if b % 4 == 3:
                hat(mix, bt + beat * 0.75, g * 0.6, -0.3)
        b += 1

    # Transitions: risers into the groove, a lift into each section, an impact on the end card.
    riser(mix, sc['meet'], 2.2)
    riser(mix, sc['clip0'], 2.6, 0.09)
    for key_scene in ('tour', 'link', 'features'):
        riser(mix, sc[key_scene], 1.0, 0.035)
    impact(mix, end)
    notes, root = cfg['final']
    pad(mix, end, notes, total - end + 2.5, cfg['bright'], 0.06)
    bass(mix, end, root, total - end + 1.5, 0.35)
    for k, n in enumerate(notes):
        key(mix, end + k * 0.09, n + 12, cfg['lead'], 0.12, pan=-0.4 + 0.2 * k)

    # Sidechain: pad and bass duck under each kick, the pumping that holds it together.
    duck = np.ones(mix.n)
    dn = int(beat * SR)
    curve = 1 - 0.45 * np.exp(-np.arange(dn) / SR * 11)
    for kt in kick_times:
        i0 = int(kt * SR)
        duck[i0:i0 + dn] = np.minimum(duck[i0:i0 + dn], curve[: min(dn, mix.n - i0)])
    for busname in ('pad', 'bass'):
        mix.bus[busname] *= duck

    mix.bus['pad'] = np.stack([band(ch, 140, 20000) for ch in mix.bus['pad']])  # leave the low end to the bass
    keys = mix.bus['keys']
    wet = reverb(mix.bus['pad'] * 0.6 + keys + mix.bus['fx'] * 0.5)
    out = mix.bus['pad'] + mix.bus['bass'] + keys * 0.9 + mix.bus['drums'] + mix.bus['fx'] + wet * 0.35
    out = out[:, : int(total * SR)]
    # The intro sits lower (about -6 dB), so the groove lands on "meet"; it rises over the last two seconds.
    tt = np.arange(out.shape[1]) / SR
    out *= np.interp(tt, [0, sc['meet'] - 2.0, sc['meet']], [0.5, 0.5, 1.0])
    fade = int(1.4 * SR)
    out[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
    out[:, : int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))
    out = np.tanh(out / np.abs(out).max() * 0.7) / np.tanh(0.7) * 0.8  # light saturation, headroom; loudness is set when muxing
    return out


def write(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').T.copy()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    name, out = sys.argv[1], sys.argv[2]
    x = compose(name)
    write(out, x)
    print(f'{name}: {x.shape[1] / SR:.1f} s -> {out}')
