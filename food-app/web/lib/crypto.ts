// Encryption at rest for secrets the server must read back: the AI provider keys. AES-256-GCM, a fresh 96-bit
// nonce per value, and the authentication tag checked on every read. The key comes from the environment and is
// never stored with the data. Losing the key means re-entering the provider keys, which is the intended trade.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('APP_ENCRYPTION_KEY must be set in production');
    // Development only: a fixed key so tests and local runs work. It protects nothing and is never used in production.
    return Buffer.alloc(32, 7);
  }
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 random bytes, base64 encoded');
  return bytes;
}

/** Returns "v1:<nonce>:<tag>:<ciphertext>", all base64. The version lets the scheme change later. */
export function encryptSecret(plain: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), nonce);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', nonce.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}

export function decryptSecret(sealed: string): string {
  const [version, nonce, tag, body] = sealed.split(':');
  if (version !== 'v1' || !nonce || !tag || !body) throw new Error('Unknown encrypted value format');
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}

/** Shows only the last four characters, enough for the admin to recognise which key is saved. */
export function keyHint(plain: string): string {
  return plain.length > 8 ? `…${plain.slice(-4)}` : '…';
}
