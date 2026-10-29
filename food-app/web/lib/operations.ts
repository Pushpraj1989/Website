// Controlled actions on vouchers (Phase 8). A revocation keeps the history, needs a reason, and is refused where it
// would change money that has already moved.
import { pool, withTx } from './db.ts';
import { RESTAURANT_ID } from './catalog.ts';
import { recordAudit } from './audit.ts';
import { RuleError } from './orders.ts';

export async function revokeVoucher(voucherId: string, actor: string, reason: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(voucherId)) throw new RuleError('Voucher not found.', 'not_found', 404);
  const why = String(reason ?? '').trim();
  if (why.length < 3 || why.length > 300) throw new RuleError('Say why the voucher is being revoked (3 to 300 characters).', 'bad_input', 400);
  return withTx(async (c) => {
    const { rows } = await c.query(
      `select v.id, v.status from vouchers v join voucher_pools p on p.id = v.pool_id join campaigns cm on cm.id = p.campaign_id
       where v.id = $1 and cm.restaurant_id = $2 for update of v`,
      [voucherId, RESTAURANT_ID],
    );
    const v = rows[0];
    if (!v) throw new RuleError('Voucher not found.', 'not_found', 404);
    if (v.status === 'redeemed') throw new RuleError('This voucher has already been used. A used voucher cannot be revoked; reverse the order instead.', 'already_redeemed', 409);
    if (v.status === 'revoked') throw new RuleError('This voucher is already revoked.', 'already_revoked', 409);
    const held = await c.query(`select 1 from voucher_reservations where voucher_id = $1 and status = 'held' limit 1`, [voucherId]);
    if (held.rows[0]) throw new RuleError('A checkout is holding this voucher. Revoke it once that checkout ends.', 'held_by_order', 409);
    await c.query(`update vouchers set status = 'revoked', revoked_at = now() where id = $1`, [voucherId]);
    await c.query(`insert into voucher_ledger (voucher_id, event, detail) values ($1, 'revoked', $2)`, [voucherId, JSON.stringify({ reason: why, actor })]);
    await recordAudit(c, actor, 'revoke', 'voucher', voucherId, { reason: why, from: v.status });
    return { voucherId, status: 'revoked' };
  });
}

/** The audit trail of promotion changes for one thing, newest last. */
export async function auditTrail(targetType: 'campaign' | 'voucher' | 'partner', targetId: string) {
  const { rows } = await pool.query(
    `select action, actor, detail, created_at from promotion_audit_log where target_type = $1 and target_id = $2 order by id`,
    [targetType, targetId],
  );
  return rows.map((r) => ({ action: r.action as string, actor: r.actor as string, detail: r.detail, at: new Date(r.created_at).toISOString() }));
}
