// The promotion audit log. Every change that matters to money or to a partner is written here, with who made it.
import type { PoolClient } from 'pg';
import { pool } from './db.ts';

export type AuditTarget = 'campaign' | 'voucher' | 'partner' | 'batch' | 'restaurant';

export async function recordAudit(c: { query: PoolClient['query'] } = pool, actor: string, action: string, targetType: AuditTarget, targetId: string | null, detail: Record<string, unknown> = {}) {
  await c.query(
    `insert into promotion_audit_log (actor, action, target_type, target_id, detail) values ($1,$2,$3,$4,$5)`,
    [actor, action, targetType, targetId, JSON.stringify(detail)],
  );
}

export async function auditFor(targetType: AuditTarget, targetId: string) {
  const { rows } = await pool.query(
    `select action, actor, detail, created_at from promotion_audit_log where target_type = $1 and target_id = $2 order by id`,
    [targetType, targetId],
  );
  return rows.map((r) => ({ action: r.action as string, actor: r.actor as string, detail: r.detail, at: new Date(r.created_at).toISOString() }));
}
