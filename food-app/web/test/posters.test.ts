// Video posters: the still made from a video's first frame, its name, and what happens without ffmpeg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dropPoster, makePoster, posterKeyFor, posterUrlFor } from '../lib/posters.ts';

const id = '8128b33c-23ee-4ded-b8ae-03bd6a83964b';
const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

test('only videos have posters, named after the video', () => {
  assert.equal(posterKeyFor(`${id}.mp4`), `${id}.poster.jpg`);
  assert.equal(posterKeyFor(`${id}.webm`), `${id}.poster.jpg`);
  assert.equal(posterKeyFor(`${id}.jpg`), null);
  assert.equal(posterKeyFor('../etc/passwd.mp4'), null);
});

test('a poster is made from the first frame, reported, and removed with the video', { skip: !hasFfmpeg && 'ffmpeg is not installed' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'posters-'));
  process.chdir(dir);
  mkdirSync(join(dir, 'storage', 'media'), { recursive: true });
  const video = join(dir, 'storage', 'media', `${id}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=orange:s=320x180:d=1', '-pix_fmt', 'yuv420p', video]);
  assert.equal(posterUrlFor(`${id}.mp4`), null);
  assert.equal(await makePoster(`${id}.mp4`), true);
  const poster = join(dir, 'storage', 'media', `${id}.poster.jpg`);
  assert.deepEqual([...readFileSync(poster).subarray(0, 3)], [0xff, 0xd8, 0xff], 'a JPEG');
  assert.equal(posterUrlFor(`${id}.mp4`), `/media/${id}.poster.jpg`);
  assert.equal(await makePoster(`${id}.mp4`), true, 'running again is fine');
  dropPoster(`${id}.mp4`);
  assert.equal(existsSync(poster), false);
});

test('a file ffmpeg cannot read gives no poster and no error', { skip: !hasFfmpeg && 'ffmpeg is not installed' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'posters-'));
  process.chdir(dir);
  mkdirSync(join(dir, 'storage', 'media'), { recursive: true });
  writeFileSync(join(dir, 'storage', 'media', `${id}.mp4`), 'not a video');
  assert.equal(await makePoster(`${id}.mp4`), false);
  assert.equal(posterUrlFor(`${id}.mp4`), null);
});
