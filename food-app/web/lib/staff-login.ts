// Limits on staff sign-in. Failures are counted per source (the client address the host reports) and in total, over
// a sliding window, so one machine cannot guess the password at speed and many machines together cannot either.
import { createHash } from 'node:crypto';
import { pool } from './db.ts';
import { RuleError } from './orders.ts';

export const WINDOW_MINUTES = 15;
export const MAX_PER_SOURCE = 10;
export const MAX_TOTAL = 100;

/** Where a request came from, as the host reports it. Only a hash is stored. */
export function sourceOf(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const source = forwarded || headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(source).digest('hex');
}

/** Refuses a sign-in attempt when this source, or everyone together, has failed too often in the window. */
export async function assertCanTry(source: string): Promise<void> {
  const { rows } = await pool.query(
    `select count(*) filter (where source_hash = $1)::int as mine, count(*)::int as total
       from staff_login_failures where at > now() - make_interval(mins => $2)`,
    [source, WINDOW_MINUTES],
  );
  if (rows[0].mine >= MAX_PER_SOURCE || rows[0].total >= MAX_TOTAL) {
    throw new RuleError(`Too many wrong passwords. Try again in ${WINDOW_MINUTES} minutes.`, 'too_many_attempts', 429);
  }
}

export async function recordFailure(source: string): Promise<void> {
  await pool.query('insert into staff_login_failures (source_hash) values ($1)', [source]);
  await pool.query(`delete from staff_login_failures where at < now() - make_interval(mins => $1)`, [WINDOW_MINUTES * 4]);
}
