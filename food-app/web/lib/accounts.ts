// Accounts, one-time codes and sessions. The codes are HMACs of the code, so a database read does not reveal one.
import { createHmac, randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pool, withTx } from './db.ts';
import { RuleError } from './orders.ts';

export const CODE_TTL_MINUTES = 5;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 30;
const SESSION_DAYS = 30;

export type Purpose = 'signup_phone' | 'login_phone' | 'verify_email';
export type Account = { id: string; name: string; phone: string; email: string | null; emailVerified: boolean };

/** Accepts +971 50 123 4567 style numbers, returns +971501234567. Country code is required. */
export function normalisePhone(input: unknown): string {
  const cleaned = typeof input === 'string' ? input.replace(/[\s()-]/g, '') : '';
  if (!/^\+[1-9][0-9]{7,14}$/.test(cleaned)) {
    throw new RuleError('Enter the mobile number with its country code, like +971 50 123 4567.', 'bad_phone', 400);
  }
  return cleaned;
}

export function normaliseEmail(input: unknown): string {
  const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new RuleError('Enter a valid email address.', 'bad_email', 400);
  }
  return email;
}

export function normaliseName(input: unknown): string {
  const name = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 80) throw new RuleError('Enter your name (2 to 80 characters).', 'bad_name', 400);
  return name;
}

function otpSecret(): string {
  const secret = process.env.OTP_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('OTP_SECRET must be set in production');
  return secret ?? 'dev-only-otp-secret';
}

const hashCode = (challengeId: string, code: string) =>
  createHmac('sha256', otpSecret()).update(`${challengeId}:${code}`).digest('hex');

export function mask(target: string): string {
  if (target.includes('@')) {
    const [user, domain] = target.split('@');
    return `${user.slice(0, 2)}${'•'.repeat(Math.max(2, user.length - 2))}@${domain}`;
  }
  return `${target.slice(0, 4)} ${'•'.repeat(Math.max(3, target.length - 7))}${target.slice(-3)}`;
}

/**
 * Sends a code. Development writes it to data/outbox.jsonl (never shown to a client). Production needs a real
 * provider; until one is configured, sending is refused rather than skipped.
 */
async function deliver(channel: 'sms' | 'email', to: string, code: string, purpose: Purpose) {
  const mode = process.env.OTP_DELIVERY ?? (process.env.NODE_ENV === 'production' ? 'none' : 'outbox');
  if (mode === 'outbox') {
    const file = join(process.cwd(), 'data', 'outbox.jsonl');
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), channel, to, purpose, code }) + '\n');
    return;
  }
  throw new RuleError('Verification messages are not set up yet. Try again later.', 'delivery_unavailable', 503);
}

/** Creates a challenge and sends its code. Refuses a second code for the same target within the cooldown. */
export async function startChallenge(input: { purpose: Purpose; target: string; accountId?: string | null; name?: string | null }) {
  const recent = await pool.query(
    `select created_at from otp_challenges where target = $1 and purpose = $2 order by created_at desc limit 1`,
    [input.target, input.purpose],
  );
  if (recent.rows[0]) {
    const ageSeconds = (Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000;
    if (ageSeconds < RESEND_COOLDOWN_SECONDS) {
      throw new RuleError(`Wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds)} seconds before asking for another code.`, 'cooldown', 429);
    }
  }
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const { rows } = await pool.query(
    `insert into otp_challenges (purpose, target, account_id, name, code_hash, expires_at)
     values ($1, $2, $3, $4, 'pending', now() + make_interval(mins => $5)) returning id`,
    [input.purpose, input.target, input.accountId ?? null, input.name ?? null, CODE_TTL_MINUTES],
  );
  const id: string = rows[0].id;
  await pool.query('update otp_challenges set code_hash = $2 where id = $1', [id, hashCode(id, code)]);
  await deliver(input.purpose === 'verify_email' ? 'email' : 'sms', input.target, code, input.purpose);
  return { challengeId: id, sentTo: mask(input.target), resendInSeconds: RESEND_COOLDOWN_SECONDS };
}

/** Checks a code. Each wrong try counts; after MAX_ATTEMPTS the challenge is dead. A right code is used once. */
export async function checkChallenge(challengeId: string, purpose: Purpose, code: unknown) {
  if (typeof challengeId !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new RuleError('Enter the 6-digit code.', 'bad_code', 400);
  }
  // The failed try must be counted even though the request is refused, so the refusal happens after the commit.
  // Throwing inside the transaction would roll the count back and the lock would never apply.
  const outcome = await withTx(async (c) => {
    const { rows } = await c.query(`select * from otp_challenges where id = $1 and purpose = $2 for update`, [challengeId, purpose]);
    const row = rows[0];
    if (!row || row.consumed_at) return { refuse: new RuleError('This code is no longer valid. Ask for a new one.', 'code_used', 410) };
    if (new Date(row.expires_at).getTime() < Date.now()) return { refuse: new RuleError('This code has expired. Ask for a new one.', 'code_expired', 410) };
    if (row.attempts >= MAX_ATTEMPTS) return { refuse: new RuleError('Too many wrong codes. Ask for a new one.', 'too_many_attempts', 429) };

    const given = Buffer.from(hashCode(challengeId, code));
    const want = Buffer.from(row.code_hash);
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      await c.query('update otp_challenges set attempts = attempts + 1 where id = $1', [challengeId]);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return {
        refuse: new RuleError(left > 0 ? `That code is wrong. ${left} tries left.` : 'That code is wrong. Ask for a new one.', 'wrong_code', 422),
      };
    }
    await c.query('update otp_challenges set consumed_at = now() where id = $1', [challengeId]);
    return { row: row as { id: string; target: string; account_id: string | null; name: string | null } };
  });
  if ('refuse' in outcome) throw outcome.refuse;
  return outcome.row;
}

export async function createSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `insert into sessions (token_hash, account_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), accountId, SESSION_DAYS],
  );
  return token;
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function toAccount(row: { id: string; name: string; phone: string; email: string | null; email_verified_at: Date | null }): Account {
  return { id: row.id, name: row.name, phone: row.phone, email: row.email, emailVerified: Boolean(row.email_verified_at) };
}

export async function accountForToken(token: string | null): Promise<Account | null> {
  if (!token) return null;
  const { rows } = await pool.query(
    `select a.* from sessions s join accounts a on a.id = s.account_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!rows[0]) return null;
  await pool.query('update sessions set last_seen_at = now() where token_hash = $1', [hashToken(token)]);
  return toAccount(rows[0]);
}

export async function revokeSession(token: string) {
  await pool.query('delete from sessions where token_hash = $1', [hashToken(token)]);
}

export async function accountByPhone(phone: string): Promise<Account | null> {
  const { rows } = await pool.query('select * from accounts where phone = $1', [phone]);
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function createAccount(name: string, phone: string): Promise<Account> {
  const { rows } = await pool.query(
    `insert into accounts (name, phone) values ($1, $2) returning *`,
    [name, phone],
  );
  return toAccount(rows[0]);
}

export async function setVerifiedEmail(accountId: string, email: string): Promise<Account> {
  try {
    const { rows } = await pool.query(
      `update accounts set email = $2, email_verified_at = now() where id = $1 returning *`,
      [accountId, email],
    );
    return toAccount(rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new RuleError('That email is already used by another account.', 'email_taken', 409);
    }
    throw error;
  }
}
