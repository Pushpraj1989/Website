import crypto from "node:crypto";

// Passwords: scrypt with a random salt per user. Stored as "scrypt$N$r$p$salt$hash".
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPassword(password, stored) {
  const [name, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (name !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p),
  });
  return crypto.timingSafeEqual(actual, expected);
}

// A fixed hash to compare against when the email is unknown, so the response time does not reveal accounts.
export const DUMMY_HASH = hashPassword(crypto.randomBytes(24).toString("hex"));

const COMMON = new Set([
  "password", "password1", "password123", "123456789012", "qwertyuiop12", "letmein12345",
  "welcome12345", "iloveyou1234", "admin1234567", "changeme1234", "azaiba-gardens", "s&s-group-2026",
]);

export function checkPassword(password, email = "") {
  if (typeof password !== "string" || password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common. Choose another.";
  if (email && password.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length > 3) {
    return "Do not use your email name in the password.";
  }
  return null;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Sliding-window rate limiter kept in memory. One process only; fine for a single Node server.
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return {
    take(key) {
      const now = Date.now();
      const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
      list.push(now);
      hits.set(key, list);
      return list.length <= max;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

// TOTP (RFC 6238): 6 digits, 30-second steps, SHA-1, accepts one step either side.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of text.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secret, timeMs = Date.now(), offset = 0) {
  const counter = Math.floor(timeMs / 1000 / 30) + offset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const pos = mac[mac.length - 1] & 0x0f;
  const code = ((mac[pos] & 0x7f) << 24) | (mac[pos + 1] << 16) | (mac[pos + 2] << 8) | mac[pos + 3];
  return String(code % 1000000).padStart(6, "0");
}

export function verifyTotp(secret, code, timeMs = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return false;
  return [-1, 0, 1].some((offset) => {
    const expected = totpCode(secret, timeMs, offset);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code));
  });
}
