import { continueRender, delayRender, staticFile } from 'remotion';

// Loads the bundled fonts before the first frame renders, so no frame is drawn in a fallback font.
const faces: [string, string, string][] = [
  ['Inter', 'fonts/inter-latin-400-normal.woff2', '400'],
  ['Inter', 'fonts/inter-latin-500-normal.woff2', '500'],
  ['Inter', 'fonts/inter-latin-600-normal.woff2', '600'],
  ['Inter', 'fonts/inter-latin-700-normal.woff2', '700'],
  ['Inter', 'fonts/inter-latin-800-normal.woff2', '800'],
  ['JetBrains Mono', 'fonts/jetbrains-mono-latin-400-normal.woff2', '400'],
  ['JetBrains Mono', 'fonts/jetbrains-mono-latin-600-normal.woff2', '600'],
];
let loaded = false;
export function loadFonts() {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('fonts');
  Promise.all(
    faces.map(([family, file, weight]) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format('woff2')`, { weight });
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
      return face.load();
    }),
  ).then(() => continueRender(handle), () => continueRender(handle));
}
