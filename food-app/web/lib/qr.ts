// A QR code encoder written for this platform (ISO/IEC 18004), with no external dependency.
// Byte mode, error correction level M, versions 1 to 8 (enough for a voucher code and a short link).
// Output is a square grid of dark modules; the caller draws it. Verified against an independent decoder in tests.

// Per version (1..8) at level M: data codewords per block and block groups, and error codewords per block.
type Spec = { ecc: number; groups: readonly (readonly [number, number])[] };
const LEVEL_M: Spec[] = [
  { ecc: 0, groups: [] }, // version numbers start at 1
  { ecc: 10, groups: [[1, 16]] },
  { ecc: 16, groups: [[1, 28]] },
  { ecc: 26, groups: [[1, 44]] },
  { ecc: 18, groups: [[2, 32]] },
  { ecc: 24, groups: [[2, 43]] },
  { ecc: 16, groups: [[4, 27]] },
  { ecc: 18, groups: [[4, 31]] },
  { ecc: 22, groups: [[2, 38], [2, 39]] },
];
const ALIGNMENT: Record<number, number[]> = {
  2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42],
};

export function capacityBytes(version: number): number {
  const v = LEVEL_M[version];
  return v.groups.reduce((sum, [count, data]) => sum + count * data, 0) - 2; // byte mode header takes about two bytes
}

// GF(256) arithmetic with the QR polynomial 0x11D.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function reedSolomon(data: number[], degree: number): number[] {
  // Generator polynomial: product of (x - a^i) for i in 0..degree-1.
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gmul(gen[j], EXP[i]);
    }
    gen = next;
  }
  const rem = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gmul(gen[i + 1], factor);
  }
  return rem;
}

function bchCode(data: number, poly: number, degree: number): number {
  let rem = data << degree;
  for (let i = 31; i >= degree; i--) {
    if ((rem >>> i) & 1) rem ^= poly << (i - degree);
  }
  return rem;
}

/** Chooses the smallest version that holds the bytes at level M. */
export function versionFor(byteLength: number): number {
  for (let v = 1; v <= 8; v++) if (byteLength <= capacityBytes(v)) return v;
  throw new Error('The text is too long for this QR code.');
}

function dataCodewords(bytes: Uint8Array, version: number): number[] {
  const capacityBits = (LEVEL_M[version].groups.reduce((s, [c, d]) => s + c * d, 0)) * 8;
  const bits: number[] = [];
  const push = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // character count, 8 bits for versions 1 to 9
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacityBits - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    out.push(byte);
  }
  for (let pad = 0; out.length * 8 < capacityBits; pad++) out.push(pad % 2 === 0 ? 0xec : 0x11);
  return out;
}

function interleave(data: number[], version: number): number[] {
  const spec = LEVEL_M[version];
  const blocks: number[][] = [];
  let offset = 0;
  for (const [count, size] of spec.groups) {
    for (let i = 0; i < count; i++) {
      blocks.push(data.slice(offset, offset + size));
      offset += size;
    }
  }
  const eccBlocks = blocks.map((b) => reedSolomon(b, spec.ecc));
  const out: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < spec.ecc; i++) for (const e of eccBlocks) out.push(e[i]);
  return out;
}

/** Builds the module grid. true is dark. The quiet zone is not included; the caller adds it. */
export function encode(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = versionFor(bytes.length);
  const size = 17 + 4 * version;
  const codewords = interleave(dataCodewords(bytes, version), version);

  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (r: number, c: number, dark: boolean) => {
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  // Finder patterns with separators, and the timing patterns.
  const finder = (cr: number, cc: number) => {
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const r = cr + dr;
        const c = cc + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const dist = Math.max(Math.abs(dr), Math.abs(dc));
        setFn(r, c, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(3, size - 4);
  finder(size - 4, 3);
  for (let i = 0; i < size; i++) {
    if (!isFunction[6][i]) setFn(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setFn(i, 6, i % 2 === 0);
  }
  // Alignment patterns.
  const centres = ALIGNMENT[version] ?? [];
  // A pattern is left out only where it would sit on a finder: the three corners of the centre list.
  const first = centres[0];
  const last = centres[centres.length - 1];
  for (const r of centres) {
    for (const c of centres) {
      const onFinder = (r === first && c === first) || (r === first && c === last) || (r === last && c === first);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) setFn(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    }
  }
  // Reserve the format areas, and set the dark module.
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }
  setFn(size - 8, 8, true);
  // Version information for versions 7 and up.
  if (version >= 7) {
    const v = (version << 12) | bchCode(version, 0x1f25, 12);
    for (let i = 0; i < 18; i++) {
      const bit = ((v >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  }

  // Place the data bits in the zigzag order, skipping the function modules.
  const bitsAll: number[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bitsAll.push((cw >>> i) & 1);
  let k = 0;
  const placeWith = (mask: number): boolean[][] => {
    const grid = modules.map((row, r) => row.map((v, c) => (isFunction[r][c] ? v : false)));
    k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          const upward = ((right + 1) & 2) === 0;
          const r = upward ? size - 1 - vert : vert;
          if (isFunction[r][c]) continue;
          let dark = k < bitsAll.length ? bitsAll[k] === 1 : false;
          k++;
          const masked = applyMask(mask, r, c) ? !dark : dark;
          dark = masked;
          grid[r][c] = dark;
        }
      }
    }
    return grid;
  };

  // Try the eight masks and keep the one with the lowest penalty.
  let best: boolean[][] | null = null;
  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = withFormat(placeWith(mask), mask, size, version);
    const penalty = penaltyScore(grid);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = grid;
      bestMask = mask;
    }
  }
  void bestMask;
  return best!;
}

function applyMask(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return ((((r * c) % 2) + ((r * c) % 3)) % 2) === 0;
    default: return ((((r + c) % 2) + ((r * c) % 3)) % 2) === 0;
  }
}

/** Writes the format bits (error level M and the mask) into both copies of the format area. */
function withFormat(grid: boolean[][], mask: number, size: number, version: number): boolean[][] {
  void version;
  const out = grid.map((row) => row.slice());
  const data = (0b00 << 3) | mask; // level M is 00
  const bits = ((data << 10) | bchCode(data, 0x537, 10)) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  // Copy 1, around the top-left finder. Positions are written as [row, column].
  for (let i = 0; i <= 5; i++) out[i][8] = bit(i);
  out[7][8] = bit(6);
  out[8][8] = bit(7);
  out[8][7] = bit(8);
  for (let i = 9; i < 15; i++) out[8][14 - i] = bit(i);
  // Copy 2, split between the other two finders.
  for (let i = 0; i < 8; i++) out[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) out[size - 15 + i][8] = bit(i);
  out[size - 8][8] = true; // the always-dark module
  return out;
}

/** The penalty rules from the standard: runs, blocks, finder-like patterns and the dark balance. */
function penaltyScore(g: boolean[][]): number {
  const n = g.length;
  let score = 0;
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) {
      if (g[r][c] === g[r][c - 1]) run++;
      else { if (run >= 5) score += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) score += 3 + (run - 5);
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if (g[r][c] === g[r - 1][c]) run++;
      else { if (run >= 5) score += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) score += 3 + (run - 5);
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = g[r][c];
      if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) score += 3;
    }
  }
  const pattern = [true, false, true, true, true, false, true];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c + 6 < n; c++) {
      if (pattern.every((v, i) => g[r][c + i] === v)) {
        const before = c >= 4 && [0, 1, 2, 3].every((i) => !g[r][c - 4 + i]);
        const after = c + 10 < n && [7, 8, 9, 10].every((i) => !g[r][c + i]);
        if (before || after) score += 40;
      }
    }
  }
  for (let c = 0; c < n; c++) {
    for (let r = 0; r + 6 < n; r++) {
      if (pattern.every((v, i) => g[r + i][c] === v)) {
        const before = r >= 4 && [0, 1, 2, 3].every((i) => !g[r - 4 + i][c]);
        const after = r + 10 < n && [7, 8, 9, 10].every((i) => !g[r + i][c]);
        if (before || after) score += 40;
      }
    }
  }
  let dark = 0;
  for (const row of g) for (const v of row) if (v) dark++;
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}
