// The customer wallet (Phase 5 of the promotions brief). A customer saves a voucher code to their account. Saving
// does not use the voucher: redemption happens at checkout (Phase 6). Vouchers bound to one customer can only be saved
// by that customer. Wrong codes give the same answer whether or not the code exists, and repeated failures are limited.
import { pool, withTx } from './db.ts';
import { codeHash, normaliseCode } from './campaigns.ts';
import { discountText } from './print.ts';
import { RuleError } from './orders.ts';

export const MAX_FAILED_SAVES = 10;
export const FAILURE_WINDOW_MINUTES = 15;
const NOT_VALID = 'That code is not valid. Check it and try again.';

export type WalletState = 'available' | 'used' | 'expired' | 'unavailable';

function stateOf(row: Record<string, any>): WalletState {
  if (row.status === 'redeemed') return 'used';
  if (row.status === 'revoked') return 'unavailable';
  if (row.status === 'expired' || new Date(row.expires_at) <= new Date()) return 'expired';
  return 'available';
}

function walletView(row: Record<string, any>) {
  const min = Number(row.min_subtotal_minor);
  return {
    voucherId: row.voucher_id as string,
    state: stateOf(row),
    discount: discountText(row),
    campaign: row.campaign_name as string,
    minOrderMinor: min,
    currency: row.currency as string,
    expiresAt: new Date(row.expires_at).toISOString(),
    savedAt: new Date(row.saved_at).toISOString(),
  };
}

const LIST_SQL = `
  select w.voucher_id, w.saved_at, v.status, v.expires_at, o.value_int, o.offer_type,
         o.min_subtotal_minor, cm.name as campaign_name, r.currency_code as currency
  from voucher_wallet w
  join vouchers v on v.id = w.voucher_id
  join offers o on o.id = v.offer_id
  join voucher_pools p on p.id = v.pool_id
  join campaigns cm on cm.id = p.campaign_id
  join restaurant r on r.id = cm.restaurant_id
  where w.customer_id = $1 and w.removed_at is null
  order by w.saved_at desc`;

/** The customer's saved vouchers, in three groups: what they can still use, what they used, and what has expired. */
export async function walletFor(accountId: string) {
  const { rows } = await pool.query(LIST_SQL, [accountId]);
  const items = rows.map(walletView);
  return {
    available: items.filter((i) => i.state === 'available'),
    used: items.filter((i) => i.state === 'used'),
    expired: items.filter((i) => i.state === 'expired' || i.state === 'unavailable'),
  };
}

/** Counts this account's failed saves in the window. Used before every attempt, so guessing is slowed down. */
async function failedSavesRecently(accountId: string, c: any = pool): Promise<number> {
  const { rows } = await c.query(
    `select count(*)::int as n from voucher_save_attempts where account_id = $1 and created_at > now() - ($2 || ' minutes')::interval`,
    [accountId, String(FAILURE_WINDOW_MINUTES)],
  );
  return rows[0].n;
}

/**
 * Saves a voucher to the account by its code. The same code saved twice is not a second entry.
 * A failed attempt is recorded and committed before the answer is given, so repeated guesses are counted.
 */
export async function saveVoucher(accountId: string, rawCode: unknown) {
  const outcome = await withTx(async (c): Promise<{ view?: ReturnType<typeof walletView>; error?: RuleError }> => {
    await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [accountId]);
    if ((await failedSavesRecently(accountId, c)) >= MAX_FAILED_SAVES) {
      return { error: new RuleError('Too many attempts. Wait a few minutes and try again.', 'rate_limited', 429) };
    }
    const fail = async (error: RuleError) => {
      await c.query(`insert into voucher_save_attempts (account_id) values ($1)`, [accountId]);
      return { error };
    };
    let code: string;
    try {
      code = normaliseCode(rawCode);
    } catch {
      return fail(new RuleError(NOT_VALID, 'not_valid', 422));
    }
    const found = await c.query(
      `select v.id, v.status, v.expires_at, v.assigned_customer_id from vouchers v where v.code_hash = $1`,
      [codeHash(code)],
    );
    const v = found.rows[0];
    const bound = v && v.assigned_customer_id && v.assigned_customer_id !== accountId;
    if (!v || bound) return fail(new RuleError(NOT_VALID, 'not_valid', 422));
    if (v.status === 'revoked') return { error: new RuleError('This voucher is no longer valid.', 'unavailable', 409) };
    if (v.status === 'redeemed') return { error: new RuleError('This voucher has already been used.', 'used', 409) };
    if (v.status === 'expired' || new Date(v.expires_at) <= new Date()) return { error: new RuleError('This voucher has expired.', 'expired', 409) };
    await c.query(
      `insert into voucher_wallet (customer_id, voucher_id) values ($1,$2)
       on conflict (customer_id, voucher_id) do update set removed_at = null`,
      [accountId, v.id],
    );
    await c.query(`insert into voucher_ledger (voucher_id, event, customer_id) values ($1, 'saved', $2)`, [v.id, accountId]);
    const { rows } = await c.query(LIST_SQL.replace('where w.customer_id = $1 and w.removed_at is null', 'where w.customer_id = $1 and w.voucher_id = $2'), [accountId, v.id]);
    return { view: walletView(rows[0]) };
  });
  // Thrown after the commit, so a failed attempt is saved before it is reported.
  if (outcome.error) throw outcome.error;
  return outcome.view!;
}

/** Removes a voucher from the wallet. The voucher itself is kept, and the removal is recorded. */
export async function removeVoucher(accountId: string, voucherId: string) {
  return withTx(async (c) => {
    const { rows } = await c.query(
      `update voucher_wallet set removed_at = now() where customer_id = $1 and voucher_id = $2 and removed_at is null returning voucher_id`,
      [accountId, voucherId],
    );
    if (!rows[0]) throw new RuleError('That voucher is not in your wallet.', 'not_found', 404);
    await c.query(`insert into voucher_ledger (voucher_id, event, customer_id) values ($1, 'removed', $2)`, [voucherId, accountId]);
    return { removed: true };
  });
}
