// Posters: a still of a video's first frame, shown at once while the video itself loads, so the customer never
// looks at an empty box. Made with ffmpeg when a video is uploaded (and for older videos by scripts/make-posters.ts).
// Without ffmpeg there is simply no poster and the video shows when it has loaded, as before.
import { spawn } from 'node:child_process';
import { existsSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { storageDir } from './catalog.ts';

const VIDEO = /^([0-9a-f-]{36})\.(mp4|mov|webm)$/;

/** The poster's file name for a video's file name, or null when the file is not a video. */
export function posterKeyFor(storageKey: string): string | null {
  const m = VIDEO.exec(storageKey);
  return m ? `${m[1]}.poster.jpg` : null;
}

/** The poster's address when it has been made, else null. */
export function posterUrlFor(storageKey: string): string | null {
  const key = posterKeyFor(storageKey);
  return key && existsSync(join(storageDir(), key)) ? `/media/${key}` : null;
}

/** Makes the poster for an uploaded video. Resolves true when there is one; never throws. */
export function makePoster(storageKey: string): Promise<boolean> {
  const key = posterKeyFor(storageKey);
  if (!key) return Promise.resolve(false);
  const source = join(storageDir(), storageKey);
  const target = join(storageDir(), key);
  if (existsSync(target)) return Promise.resolve(true);
  const partial = `${target}.part.jpg`;
  return new Promise((resolve) => {
    let child;
    try {
      // The first frame, at most 1280 wide, as a well-compressed JPEG (usually 40-120 KB).
      child = spawn('ffmpeg', ['-v', 'error', '-y', '-i', source, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '5', partial], { stdio: 'ignore' });
    } catch {
      return resolve(false);
    }
    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      if (code === 0 && existsSync(partial)) {
        renameSync(partial, target);
        resolve(true);
      } else {
        if (existsSync(partial)) unlinkSync(partial);
        resolve(false);
      }
    });
  });
}

/** Removes a video's poster along with the video. */
export function dropPoster(storageKey: string) {
  const key = posterKeyFor(storageKey);
  const file = key && join(storageDir(), key);
  if (file && existsSync(file)) unlinkSync(file);
}
