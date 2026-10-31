#!/usr/bin/env python3
"""Check a rendered video and make a contact sheet to look at.

    python3 check_video.py out/launch-1920x1080-linkedin.mp4 [--frames 12]

Prints size, length, pixel format and whether the file is set up for fast start, and writes <video name>-sheet.jpg with
frames spread over the film, in the current folder. LOOK at the sheet: this checks the file, not whether the film is good.
Needs ffmpeg and ffprobe (the contact sheet also needs ImageMagick's montage).
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('--frames', type=int, default=12)
a = ap.parse_args()
v = Path(a.video)
info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(v)], capture_output=True, text=True, check=True).stdout)
vs = next(s for s in info['streams'] if s['codec_type'] == 'video')
dur = float(info['format']['duration'])
problems = []
if vs.get('pix_fmt') != 'yuv420p': problems.append(f"pixel format is {vs.get('pix_fmt')}, not yuv420p (some players show wrong colours)")
if any(s['codec_type'] == 'audio' for s in info['streams']): print('note: the file has an audio track')
head = v.read_bytes()[:65536]
moov, mdat = head.find(b'moov'), head.find(b'mdat')
if moov == -1 or (mdat != -1 and mdat < moov): problems.append('the file is not set up for fast start (moov atom is not first): run finish.sh')
print(f"{v.name}: {vs['width']}x{vs['height']}, {dur:.1f} s, {vs['codec_name']}, {vs.get('pix_fmt')}, {int(info['format']['size']) / 1e6:.1f} MB")
for p in problems: print('PROBLEM:', p)
tmp = Path(tempfile.mkdtemp())
files = []
for i in range(a.frames):
    t = dur * (i + 0.5) / a.frames
    f = tmp / f'{i:02d}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.2f}', '-i', str(v), '-frames:v', '1', '-vf', 'scale=480:-1', str(f)], check=True)
    files.append(str(f))
sheet = Path(v.stem + '-sheet.jpg')  # in the folder you run it from, so it never lands among the deliverables
subprocess.run(['montage', *files, '-geometry', '+4+4', '-tile', '4x', str(sheet)], check=True)
print('contact sheet:', sheet)
sys.exit(1 if problems else 0)
