// Makes the missing posters (a still of the first frame) for videos uploaded before posters existed. Safe to run
// again: videos that already have one are skipped. Run from the web folder:
//   node --experimental-strip-types scripts/make-posters.ts
import { existsSync, readdirSync } from 'node:fs';
import { storageDir } from '../lib/catalog.ts';
import { makePoster, posterKeyFor } from '../lib/posters.ts';
import { join } from 'node:path';

const dir = storageDir();
const videos = existsSync(dir) ? readdirSync(dir).filter((f) => posterKeyFor(f) !== null) : [];
let made = 0;
let failed = 0;
for (const v of videos) {
  if (existsSync(join(dir, posterKeyFor(v)!))) continue;
  if (await makePoster(v)) made += 1;
  else failed += 1;
}
console.log(`Posters: ${videos.length} videos, ${made} new posters${failed ? `, ${failed} could not be made (is ffmpeg installed?)` : ''}.`);
