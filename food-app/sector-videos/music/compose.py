#!/usr/bin/env python3
"""Original launch soundtracks for the sector films: upbeat jazz-funk, synthesised from scratch (no samples, no
third-party music), so they are ours to use anywhere.

Swung groove (ride cymbal, backbeat snare, walking bass), Rhodes-style comping on extended jazz chords, and synth
brass stabs on the hits. Timed to each film's scenes: a short punchy intro under the hook, the full band from "meet",
a bass-and-ride breakdown at "And the back office" with a fill back in, crashes on the big scene changes, and a final
brass chord on the end card.

    python3 music/compose.py salon|pharmacy out.wav      (needs numpy)
"""
import sys
import wave

import numpy as np

SR = 44100
FPS = 30
rng = np.random.default_rng(11)


def scenes(film):
    """Scene start times in seconds, mirroring parts() in src/Film.tsx (or the film's own plan)."""
    if 'plan' in film:
        t, out = 0, {}
        for name, n in film['plan']:
            out[name] = t / FPS
            t += n
        return out, t / FPS
    frames = [('hook', 105), ('meet', 180), ('tour', 96 * film['tour'])]
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
    'salon': {  # F major: Gm9 - C13 - Fmaj9 - Dm9 (ii - V - I - vi)
        'tour': 8, 'booking': True, 'bpm': 120,
        'chords': [[58, 62, 65, 69], [58, 62, 64, 69], [57, 60, 64, 67], [53, 57, 60, 64]],
        'roots': [43, 36, 41, 38],
        'final': ([53, 57, 60, 64, 67, 72], 29),
    },
    'finale': {  # the all-sectors film: same groove as the salon, a touch faster; timed by an explicit plan
        'plan': [('hook', 150), ('meet', 756), ('office', 210), ('clip0', 150), ('end', 180)],
        'crashes': ['meet', 'clip0'], 'whoosh_every': (5.0, 2.8, 9),
        'bpm': 124,
        'chords': [[58, 62, 65, 69], [58, 62, 64, 69], [57, 60, 64, 67], [53, 57, 60, 64]],
        'roots': [43, 36, 41, 38],
        'final': ([53, 57, 60, 64, 67, 72], 29),
    },
    'backoffice': {  # the console film: breakdown on the numbers chapter, drop on the wall of screens
        'plan': [('hook', 150), ('meet', 2352), ('office', 165), ('clip0', 180), ('end', 180)],
        'crashes': ['meet', 'clip0'],
        'whoosh_at': [330, 534, 768, 942, 1356, 1620, 1944, 2238],
        'bpm': 120,
        'chords': [[58, 62, 65, 69], [58, 62, 64, 69], [57, 60, 64, 67], [53, 57, 60, 64]],
        'roots': [43, 36, 41, 38],
        'final': ([53, 57, 60, 64, 67, 72], 29),
    },
    'pharmacy': {  # G major: Am9 - D13 - Gmaj9 - Em9
        'tour': 7, 'booking': False, 'bpm': 116,
        'chords': [[60, 64, 67, 71], [60, 64, 66, 71], [59, 62, 66, 69], [55, 59, 62, 66]],
        'roots': [45, 38, 43, 40],
        'final': ([55, 59, 62, 66, 69, 74], 31),
    },
}

SWING = 0.64  # where the off-beat eighth falls inside the beat


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def noise(n):
    return rng.standard_normal(n)


def band(sig, lo, hi):
    spec = np.fft.rfft(sig)
    fr = np.fft.rfftfreq(len(sig), 1 / SR)
    spec[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(spec, len(sig))


def saw_table(cap_harm):
    ph = np.linspace(0, 1, 2048, endpoint=False)
    w = sum(np.sin(2 * np.pi * k * ph) / k for k in range(1, cap_harm + 1))
    return w / np.abs(w).max()


TABLES = {k: saw_table(k) for k in (4, 8, 16, 32)}


def saw(freqs, cap=3000):
    """Band-limited saw following a frequency curve (array, Hz)."""
    harm = max(2, int(cap / max(freqs.mean(), 20)))
    table = TABLES[min(TABLES, key=lambda k: abs(k - harm))]
    ph = np.cumsum(freqs) / SR % 1.0
    return np.interp(ph * 2048, np.arange(2048), table, period=2048)


class Mix:
    def __init__(self, seconds):
        self.n = int(seconds * SR) + SR * 4
        self.bus = {k: np.zeros((2, self.n)) for k in ('keys', 'bass', 'brass', 'drums', 'fx')}

    def add(self, bus, t, sig, pan=0.0, gain=1.0):
        i = int(t * SR)
        if i >= self.n or i < 0:
            return
        sig = sig[: self.n - i]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.bus[bus][0, i:i + len(sig)] += sig * l * gain * 1.414
        self.bus[bus][1, i:i + len(sig)] += sig * r * gain * 1.414


# ---------- instruments ----------
def rhodes(mix, t, notes, dur, gain=0.11):
    n = int((dur + 0.4) * SR)
    tt = np.arange(n) / SR
    rel = np.clip(1 - (tt - dur) / 0.35, 0, 1)
    for j, note in enumerate(notes):
        f = hz(note)
        tine = np.sin(2 * np.pi * f * tt + 1.6 * np.exp(-tt * 9) * np.sin(2 * np.pi * f * tt))
        bark = 0.35 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 14)
        trem = 1 + 0.12 * np.sin(2 * np.pi * 5.2 * tt + j)
        s = (tine + bark) * np.exp(-tt * 1.6) * rel * trem
        mix.add('keys', t + j * 0.006, s, -0.35 + 0.23 * j, gain)


def bass(mix, t, note, dur, gain=0.42):
    n = int((dur + 0.05) * SR)
    tt = np.arange(n) / SR
    f = np.full(n, hz(note))
    body = saw(f, cap=900) * 0.55 + np.sin(2 * np.pi * hz(note) * tt)
    pluck = np.exp(-tt * 3.2) * np.minimum(1, tt / 0.004) * np.clip(1 - (tt - dur) / 0.05, 0, 1)
    mix.add('bass', t, body * pluck, 0, gain)


def brass(mix, t, notes, dur, gain=0.085, scoop=True):
    n = int((dur + 0.12) * SR)
    tt = np.arange(n) / SR
    amp = np.minimum(1, tt / 0.025) * np.clip(1 - (tt - dur) / 0.12, 0, 1) * (0.75 + 0.25 * np.exp(-tt * 6))
    for j, note in enumerate(notes):
        for d, pan in ((-9, -0.5), (9, 0.5)):
            f0 = hz(note) * 2 ** (d / 1200)
            curve = f0 * 2 ** ((-0.35 * np.exp(-tt * 30) if scoop else np.zeros(n)) / 12)
            bright = band(saw(curve, cap=3200), 180, 3000 + 1500 * (j % 2))
            mix.add('brass', t, bright * amp, pan, gain)


def kick(mix, t, g=1.0):
    n = int(0.3 * SR)
    tt = np.arange(n) / SR
    f = 50 + 110 * np.exp(-tt * 40)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 10) + band(noise(n), 2000, 7000) * np.exp(-tt * 150) * 0.2
    mix.add('drums', t, s, 0, 0.62 * g)


def snare(mix, t, g=1.0):
    n = int(0.28 * SR)
    tt = np.arange(n) / SR
    s = band(noise(n), 1200, 9000) * np.exp(-tt * 20) * 0.9 + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 28) * 0.7
    mix.add('drums', t, s, 0.08, 0.3 * g)


def ride(mix, t, g=1.0):
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    partials = sum(np.sin(2 * np.pi * f * tt + p) for f, p in ((3260, 0), (4115, 1), (5330, 2), (6870, 3), (8520, 4)))
    s = (partials * 0.18 + band(noise(n), 6000, 16000) * 0.5) * np.exp(-tt * 5) * (1 + 1.5 * np.exp(-tt * 60))
    mix.add('drums', t, s, 0.35, 0.07 * g)


def hat(mix, t, g=1.0):
    n = int(0.06 * SR)
    tt = np.arange(n) / SR
    mix.add('drums', t, band(noise(n), 7000, 16000) * np.exp(-tt * 70), -0.3, 0.07 * g)


def crash(mix, t, g=1.0):
    n = int(2.6 * SR)
    tt = np.arange(n) / SR
    s = band(noise(n), 3500, 16000) * np.exp(-tt * 1.6) * (1 + 2 * np.exp(-tt * 30))
    mix.add('drums', t, s, -0.25, 0.09 * g)
    mix.add('drums', t, band(noise(n), 3500, 16000) * np.exp(-tt * 1.6), 0.3, 0.05 * g)


def riser(mix, t_end, length, gain):
    n = int(length * SR)
    out, s, seg = np.zeros(n), noise(n), SR // 20
    for i in range(0, n, seg):
        p = i / n
        out[i:i + seg] = band(s[i:i + seg], 500 + 6000 * p ** 2, 1500 + 10000 * p ** 2)
    mix.add('fx', t_end - length, out * (np.arange(n) / n) ** 2, 0, gain)


def reverb(x, seconds=1.6):
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = band(noise(n), 200, 7000) * np.exp(-tt * 4.5)
        ir /= np.sqrt((ir ** 2).sum())
        size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        out[ch] = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: x.shape[1]]
    return out


# ---------- arrangement ----------
def compose(name):
    cfg = FILMS[name]
    sc, total = scenes(cfg)
    beat = 60 / cfg['bpm']
    bar = 4 * beat
    end = sc['end']
    mix = Mix(total)
    eighth = lambda b, off: b * beat + (SWING * beat if off else 0)  # swung eighth inside a bar (b = beat 0..3)

    full = [(sc['meet'], sc['office']), (sc['clip0'], end)]
    breakdown = (sc['office'], sc['clip0'])
    in_full = lambda t: any(a - 1e-6 <= t < b for a, b in full)
    in_break = lambda t: breakdown[0] - 1e-6 <= t < breakdown[1]
    kicks = []

    nbars = int(np.ceil(end / bar)) + 1
    for i in range(nbars):
        t0 = i * bar
        if t0 >= end:
            break
        ch = cfg['chords'][i % 4]
        root = cfg['roots'][i % 4]
        nxt = cfg['roots'][(i + 1) % 4]
        full_now, break_now = in_full(t0), in_break(t0)
        intro = t0 < sc['meet']

        # Rhodes comping: syncopated stabs; two patterns that alternate by bar.
        hits = [(0, 0, 0.35), (1, 1, 0.22), (3, 0, 0.5)] if i % 2 == 0 else [(0, 1, 0.3), (2, 0, 0.3), (3, 1, 0.4)]
        if not break_now:
            for b, off, d in hits:
                tt = t0 + eighth(b, off)
                if tt < end:
                    rhodes(mix, tt, ch, d, 0.1 if full_now else 0.085)

        # Walking bass: root, fifth, octave, chromatic approach to the next root; a pickup eighth on beat 4.
        if full_now or break_now:
            line = [root, root + 7, root + 12, nxt + (1 if nxt < root + 12 else -1)]
            for b, note in enumerate(line):
                tt = t0 + b * beat
                if tt < end:
                    bass(mix, tt, note, beat * 0.85)
            if t0 + eighth(3, 1) < end:
                bass(mix, t0 + eighth(3, 1), nxt + 12 if i % 2 else root + 10, beat * 0.3, 0.3)

        # Drums: swung ride everywhere but the intro's first half; kick and backbeat in the full band.
        for b in range(4):
            tb = t0 + b * beat
            if tb >= end:
                break
            if not (intro and tb < sc['meet'] * 0.4):
                ride(mix, tb, 1.0 if b % 2 == 0 else 0.8)
                if b in (1, 3):
                    ride(mix, t0 + eighth(b, 1), 0.65)
            if full_now:
                if b in (0, 2):
                    kick(mix, tb)
                    kicks.append(tb)
                if b == 2 and i % 2 == 1:
                    kick(mix, t0 + eighth(1, 1), 0.7)
                    kicks.append(t0 + eighth(1, 1))
                if b in (1, 3):
                    snare(mix, tb)
                    hat(mix, tb, 0.8)
                if b == 3:
                    snare(mix, t0 + eighth(3, 1), 0.25)  # ghost note
            elif intro and b in (1, 3):
                snare(mix, tb, 0.45)  # light backbeat under the hook

        # Brass: a riff every four bars in the full band (stab on 1, answer on the "and" of 3, push into the next bar).
        if full_now and i % 4 == 0:
            brass(mix, t0, [n + 12 for n in ch[1:]], 0.22)
            brass(mix, t0 + eighth(2, 1), [n + 12 for n in ch[1:]], 0.18, 0.07)
        if full_now and i % 4 == 3 and t0 + eighth(3, 1) < end:
            nch = cfg['chords'][(i + 1) % 4]
            brass(mix, t0 + eighth(3, 1), [n + 12 for n in nch[1:]], 0.35, 0.08)

    # Hits on the big scene changes: brass stab and crash; a snare fill into the full band.
    for key in ('meet', 'clip0'):
        t = sc[key]
        for k in range(8):  # sixteenth-note fill over the last two beats, getting louder
            snare(mix, t - beat * 2 + k * beat / 4, 0.25 + 0.1 * k)
        riser(mix, t, 2.2, 0.06)
    for (start, every, count) in [cfg['whoosh_every']] if 'whoosh_every' in cfg else []:
        for k in range(1, count):  # a light swoosh on every cut of the sector parade
            riser(mix, start + k * every, 0.6, 0.035)
    for fr in cfg.get('whoosh_at', []):  # a swoosh into each chapter, with a light brass push
        riser(mix, fr / FPS, 0.7, 0.04)
        crash(mix, fr / FPS, 0.35)
    for key in cfg.get('crashes', ('meet', 'tour', 'clip0', 'link', 'features')):
        crash(mix, sc[key], 1.0 if key in ('meet', 'clip0') else 0.6)
        brass(mix, sc[key], [n + 12 for n in cfg['chords'][0][1:]], 0.3, 0.08)

    # Ending: full brass chord, crash, low root, Rhodes chord; let it ring to the last frame.
    notes, root = cfg['final']
    crash(mix, end, 1.2)
    kick(mix, end, 1.2)
    brass(mix, end, [n + 12 for n in notes[1:]], total - end - 0.6, 0.075, scoop=False)
    bass(mix, end, root + 12, total - end - 0.4, 0.4)
    rhodes(mix, end, notes, total - end - 0.3, 0.12)

    # Glue: keys and bass duck a little under each kick.
    duck = np.ones(mix.n)
    dn = int(beat * 0.6 * SR)
    curve = 1 - 0.3 * np.exp(-np.arange(dn) / SR * 14)
    for kt in kicks:
        i0 = int(kt * SR)
        duck[i0:i0 + dn] = np.minimum(duck[i0:i0 + dn], curve[: max(0, min(dn, mix.n - i0))])
    for b in ('keys', 'bass'):
        mix.bus[b] *= duck

    wet = reverb(mix.bus['keys'] * 1.3 + mix.bus['brass'] * 1.5 + mix.bus['drums'] * 0.15 + mix.bus['fx'])
    # Balance (measured in the groove): keys about -18 dB, drums -17, bass -18.5, brass stabs cutting through on top.
    out = mix.bus['keys'] * 1.6 + mix.bus['bass'] * 0.55 + mix.bus['brass'] * 2.5 + mix.bus['drums'] * 1.25 + mix.bus['fx'] * 1.3 + wet * 0.35
    out = out[:, : int(total * SR)]
    fade = int(1.0 * SR)
    out[:, -fade:] *= np.linspace(1, 0, fade) ** 1.3
    out[:, : int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
    out = np.tanh(out / np.abs(out).max() * 1.1) / np.tanh(1.1) * 0.85
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
