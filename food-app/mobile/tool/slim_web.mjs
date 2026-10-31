// Run after `flutter build web`: removes the icon package's six extra weights of its icon font (Lucide100 to
// Lucide600, about 3 MB). The app only uses the regular icons (lucide_icons.dart), but a browser build downloads
// every font listed in FontManifest.json before it draws its first frame. Usage: node tool/slim_web.mjs [build/web]
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.argv[2] ?? 'build/web';
const manifestPath = join(web, 'assets', 'FontManifest.json');
const unused = /^packages\/lucide_icons_flutter\/Lucide\d+$/;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let bytes = 0;
const kept = manifest.filter((family) => {
  if (!unused.test(family.family)) return true;
  for (const font of family.fonts) {
    const file = join(web, 'assets', font.asset);
    if (existsSync(file)) {
      bytes += readFileSync(file).length;
      rmSync(file);
    }
  }
  return false;
});
writeFileSync(manifestPath, JSON.stringify(kept));
console.log(`Fonts: dropped ${manifest.length - kept.length} unused icon weights (${(bytes / 1e6).toFixed(1)} MB).`);
