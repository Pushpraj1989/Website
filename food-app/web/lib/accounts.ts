// Accounts, one-time codes and sessions. The codes are HMACs of the code, so a database read does not reveal one.
import { createHmac, randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import nodemailer from 'nodemailer';
import { GraphMailError, graphConfigured, sendGraphMail } from './graph-mail.ts';
import { pool, withTx } from './db.ts';
import { RuleError } from './orders.ts';

export const CODE_TTL_MINUTES = 5;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 30;
const SESSION_DAYS = 30;

export type Purpose = 'signup_phone' | 'login_phone' | 'verify_email' | 'signup_email' | 'login_email';
const EMAIL_PURPOSES: Purpose[] = ['verify_email', 'signup_email', 'login_email'];
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
 * Sends a code. Development writes it to data/outbox.jsonl (never shown to a client). In production, OTP_DELIVERY=smtp
 * sends email codes through the restaurant's mail account (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM), and
 * OTP_DELIVERY=graph through Microsoft Graph for a Microsoft 365 mailbox (GRAPH_TENANT_ID, GRAPH_CLIENT_ID,
 * GRAPH_CLIENT_SECRET, GRAPH_SENDER).
 * Anything not configured is refused rather than skipped, so a customer is never told a code was sent when it was not.
 */
async function deliver(channel: 'sms' | 'email', to: string, code: string, purpose: Purpose) {
  const mode = process.env.OTP_DELIVERY ?? (process.env.NODE_ENV === 'production' ? 'none' : 'outbox');
  if (mode === 'outbox') {
    const file = join(process.cwd(), 'data', 'outbox.jsonl');
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), channel, to, purpose, code }) + '\n');
    return;
  }
  if (mode === 'smtp' && channel === 'email') {
    await sendEmailCode(to, code);
    return;
  }
  if (mode === 'graph' && channel === 'email') {
    await sendGraphCode(to, code);
    return;
  }
  throw new RuleError('Verification messages are not set up yet. Try again later.', 'delivery_unavailable', 503);
}

let transport: nodemailer.Transporter | null = null;

// The email that carries a code, the same whichever way it is sent.
async function codeEmail(code: string) {
  const { rows } = await pool.query('select name_en from restaurant limit 1');
  const name = rows[0]?.name_en ?? '';
  return {
    name,
    subject: `${code} is your ${name} code`.replace(/\s+/g, ' ').trim(),
    text: `${code} is your ${name} code. It expires in ${CODE_TTL_MINUTES} minutes.\n\nIf you did not ask for it, you can ignore this email.`,
  };
}

/** The code by email through SMTP, in the restaurant's own name. The SMTP password never appears in an error or a log. */
async function sendEmailCode(to: string, code: string) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new RuleError('Verification messages are not set up yet. Try again later.', 'delivery_unavailable', 503);
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport ??= nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const mail = await codeEmail(code);
  try {
    await transport.sendMail({
      from: mail.name ? `"${mail.name.replace(/"/g, '')}" <${from}>` : from,
      to,
      subject: mail.subject,
      text: mail.text,
    });
  } catch (error) {
    console.error('email code not sent:', (error as { code?: string }).code ?? 'unknown');
    throw new RuleError('The code could not be sent. Try again in a minute.', 'delivery_failed', 502);
  }
}

/** The code by email through Microsoft Graph (lib/graph-mail.ts), for Microsoft 365 mailboxes without SMTP. */
async function sendGraphCode(to: string, code: string) {
  if (!graphConfigured()) throw new RuleError('Verification messages are not set up yet. Try again later.', 'delivery_unavailable', 503);
  const mail = await codeEmail(code);
  try {
    await sendGraphMail({ to, subject: mail.subject, text: mail.text, fromName: mail.name || undefined });
  } catch (error) {
    console.error('email code not sent (graph):', error instanceof GraphMailError ? `${error.stage} ${error.status}` : 'network');
    throw new RuleError('The code could not be sent. Try again in a minute.', 'delivery_failed', 502);
  }
}

/** Creates a challenge and sends its code. Refuses a second code for the same target within the cooldown. */
export async function startChallenge(input: { purpose: Purpose; target: string; accountId?: string | null; name?: string | null; phone?: string | null }) {
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
    `insert into otp_challenges (purpose, target, account_id, name, phone, code_hash, expires_at)
     values ($1, $2, $3, $4, $5, 'pending', now() + make_interval(mins => $6)) returning id`,
    [input.purpose, input.target, input.accountId ?? null, input.name ?? null, input.phone ?? null, CODE_TTL_MINUTES],
  );
  const id: string = rows[0].id;
  await pool.query('update otp_challenges set code_hash = $2 where id = $1', [id, hashCode(id, code)]);
  await deliver(EMAIL_PURPOSES.includes(input.purpose) ? 'email' : 'sms', input.target, code, input.purpose);
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
    return { row: row as { id: string; target: string; account_id: string | null; name: string | null; phone: string | null } };
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

export async function accountByEmail(email: string): Promise<Account | null> {
  const { rows } = await pool.query('select * from accounts where email = $1 and email_verified_at is not null', [email]);
  return rows[0] ? toAccount(rows[0]) : null;
}

/** An account made by email sign-up: the email is verified by the code; the mobile number is as the customer typed it. */
export async function createAccountWithEmail(name: string, phone: string, email: string): Promise<Account> {
  try {
    const { rows } = await pool.query(
      `insert into accounts (name, phone, email, email_verified_at) values ($1, $2, $3, now()) returning *`,
      [name, phone, email],
    );
    return toAccount(rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new RuleError('This email or mobile number already has an account. Sign in instead.', 'already_registered', 409);
    }
    throw error;
  }
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
