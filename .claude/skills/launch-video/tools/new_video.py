#!/usr/bin/env python3
"""Scaffold a launch video project from a brief.

    python3 .claude/skills/launch-video/tools/new_video.py --brief briefs/<slug>.video.json --out <dir> [--install]

Copies the Remotion template to <dir>, writes src/content.ts from the brief (defaults come from tools/defaults.json,
the brief overrides them, section by section), sets the accent colours in src/theme.ts, writes a STORYBOARD.md
skeleton with the timing sheet, and creates plain placeholder pictures for every screenshot and photo the film
expects (never overwriting a real one). Then replace the placeholders with real captures (tools/capture.mjs).

Brief format: references/intake.md. Standard library only.
"""
import argparse
import copy
import json
import re
import shutil
import struct
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
TEMPLATE = SKILL / 'template'

SCENE_NAMES = {
    'hook': 'Hook', 'brand': 'Brand reveal', 'promise': 'Promise', 'deploy': 'Step 1: deploy', 'details': 'Step 2: details',
    'offers': 'Step 3: offers', 'dashboard': 'Proof: dashboard', 'stores': 'Step 4: stores', 'sectors': 'Every business', 'end': 'End card',
}
FPS = 30


def deep_merge(base, over):
    """Dicts merge key by key; everything else (lists, strings, numbers) is replaced by the brief's value."""
    if isinstance(base, dict) and isinstance(over, dict):
        out = copy.deepcopy(base)
        for k, v in over.items():
            out[k] = deep_merge(out[k], v) if k in out else copy.deepcopy(v)
        return out
    return copy.deepcopy(over)


def png(path: Path, w: int, h: int, rgb=(231, 229, 228)):
    """A plain solid PNG, standard library only. Placeholders are meant to be replaced."""
    row = b'\x00' + bytes(rgb) * w
    raw = row * h
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def ts_value(v, indent=0):
    return json.dumps(v, indent=2, ensure_ascii=False).replace('\n', '\n' + ' ' * indent)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--brief', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--install', action='store_true', help='run npm install in the new folder')
    a = ap.parse_args()

    brief = json.loads(Path(a.brief).read_text())
    d = json.loads((HERE / 'defaults.json').read_text())
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        sys.exit(f'{out} is not empty. Pick a new folder (or delete it), so nothing real is overwritten.')

    # ---- merge the brief over the defaults
    brand = deep_merge(d['BRAND'], brief.get('brand', {}))
    if 'wordmark' not in brief.get('brand', {}):
        words = brand['name'].split()
        brand['wordmark'] = [' '.join(words[:max(1, len(words) // 2 + len(words) % 2)]), ' '.join(words[max(1, len(words) // 2 + len(words) % 2):])] if len(words) > 1 else [brand['name']]
    copy_ = deep_merge(d['COPY'], brief.get('copy', {}))
    demo = deep_merge(d['DEMO'], brief.get('demo', {}))
    sectors = [{'key': s['key'], 'name': s.get('name', s['key']), 'shot': s.get('shot', f"shots/sector-{s['key']}.png")} for s in brief.get('sectors', d['SECTORS'])]

    default_frames = {s['id']: s['frames'] for s in d['SCENE_PLAN']}
    default_frames['sectors'] = 26 + 22 * len(sectors) + 16  # a short hold, one step per business, a short settle
    default_frames.update(brief.get('frames', {}))
    ids = brief.get('scenes', [s['id'] for s in d['SCENE_PLAN']])
    for i in ids:
        if i not in SCENE_NAMES:
            sys.exit(f'Unknown scene id "{i}". Known: {", ".join(SCENE_NAMES)}')
    if ids[-1] != 'end':
        sys.exit('The last scene must be "end".')
    plan = [{'id': i, 'frames': default_frames[i]} for i in ids]
    total = sum(p['frames'] for p in plan)

    # ---- copy the template
    shutil.copytree(TEMPLATE, out, ignore=shutil.ignore_patterns('node_modules', 'out', '.DS_Store'))

    # ---- content.ts
    header = (TEMPLATE / 'src' / 'content.ts').read_text().split('export const BRAND')[0]
    body = (
        f"export const BRAND = {ts_value(brand)};\n\n"
        f"export const COPY = {ts_value(copy_)};\n\n"
        f"export const DEMO = {ts_value(demo)};\n\n"
        f"export const SECTORS: {{ key: string; name: string; shot: string }}[] = {ts_value(sectors)};\n\n"
        f"export const SCENE_PLAN: {{ id: string; frames: number }}[] = {ts_value(plan)};\n"
    )
    (out / 'src' / 'content.ts').write_text(header + body)

    # ---- theme colours
    colours = brief.get('colours', {})
    theme = (out / 'src' / 'theme.ts').read_text()
    for key, value in colours.items():
        if not re.fullmatch(r'#[0-9A-Fa-f]{6}', value):
            sys.exit(f'Colour {key} must be like #C2410C, got {value}')
        theme, n = re.subn(rf"(\b{key}: ')#[0-9A-Fa-f]{{6}}(')", rf"\g<1>{value}\2", theme)
        if not n:
            sys.exit(f'Unknown colour "{key}". Known: cream, ink, muted, line, card, accent, amber, saffron, chilli, green, greenSoft')
    (out / 'src' / 'theme.ts').write_text(theme)

    # ---- package.json
    slug = brief.get('slug', re.sub(r'[^a-z0-9]+', '-', brand['name'].lower()).strip('-'))
    pkg = json.loads((out / 'package.json').read_text())
    pkg['name'] = f'{slug}-launch-video'
    pkg['description'] = f"The launch video for {brand['name']}, as code (Remotion). Edit src/content.ts, then render."
    poster = max(0, total - 18)
    pkg['scripts']['render'] = ('remotion render Launch out/launch-1920x1080.mp4 && remotion render LaunchFeed out/launch-1080x1350.mp4 && '
                                f'remotion still Launch out/poster-1920x1080.png --frame={poster} && remotion still LaunchFeed out/poster-1080x1350.png --frame={poster}')
    (out / 'package.json').write_text(json.dumps(pkg, indent=2) + '\n')

    # ---- placeholders for every picture the film expects (never overwrite a real file)
    made = []
    def ph(rel, w, h):
        p = out / 'public' / rel
        if not p.exists():
            png(p, w, h)
            made.append(rel)
    for rel in ['shots/app-home.png', 'shots/app-home-2.png', 'shots/web-menu.png', 'shots/web-home.png']:
        ph(rel, 780, 1688)
    for rel in ['shots/console-dashboard.png', 'shots/console-orders.png']:
        ph(rel, 1600, 1000)
    for s in sectors:
        ph(s['shot'], 780, 1688)
    for dish in demo['dishes']:
        ph(dish['img'], 400, 400)
    (out / 'PLACEHOLDERS.txt').write_text(
        'These pictures are plain grey placeholders. Replace each with a real capture or a licensed photo of the same name\n'
        'before rendering (tools/capture.mjs takes the screens; see references/capture-assets.md for photo rules):\n\n'
        + '\n'.join(f'  public/{m}' for m in made) + '\n')

    # ---- storyboard skeleton with the timing sheet
    rows, t = [], 0
    for p in plan:
        rows.append(f"| {SCENE_NAMES[p['id']]} | {t}–{t + p['frames']} | {t / FPS:.1f}–{(t + p['frames']) / FPS:.1f} |")
        t += p['frames']
    (out / 'STORYBOARD.md').write_text(
        f"# Launch video: storyboard and motion specification\n\n**{brand['name']}.** A {total / FPS:.0f}-second film, built as code (Remotion) in `src/`.\n\n"
        "## Formats\n\n| Format | Size | Composition |\n| --- | --- | --- |\n| Master | 1920 × 1080 | `Launch` |\n| Feed variant | 1080 × 1350 | `LaunchFeed` |\n\n"
        f"Both run at {FPS} fps, {total} frames.\n\n## Ground rules\n\n- Real data only: every number and name on screen is from the real product or the brief.\n"
        "- Real product: phone screens are real captures.\n- Honest claims, with the fine print where one is needed.\n- Original work: nothing copied from a reference's brand, words or screens.\n\n"
        "## Script (on-screen text, no voice-over)\n\nTODO: one row per scene, from `src/content.ts`.\n\n## Scene by scene\n\nTODO: for each scene, what appears, when, and how it moves.\n\n"
        f"## Timing sheet\n\n| Scene | Frames | Seconds |\n| --- | --- | --- |\n" + '\n'.join(rows) + "\n\n## Caption\n\nTODO: the post text, from `references/caption.md`.\n")

    print(f'Created {out}: {len(plan)} scenes, {total} frames ({total / FPS:.1f} s), {len(made)} placeholder pictures.')
    print(f'Next: replace the placeholders (see {out}/PLACEHOLDERS.txt), then:  cd {out} && npm install && bash {SKILL}/tools/render.sh')
    if a.install:
        import subprocess
        subprocess.run(['npm', 'install', '--no-audit', '--no-fund'], cwd=out, check=True)


if __name__ == '__main__':
    main()
