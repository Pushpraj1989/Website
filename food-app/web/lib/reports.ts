// Promotion reports (Phase 8 of the brief). Read-only: every figure is counted from the records, not kept as a
// separate total, so the reports cannot drift from the vouchers, redemptions and orders they describe.
import { pool } from './db.ts';
import { RESTAURANT_ID } from './catalog.ts';

const FUNDERS: Record<string, string> = { restaurant: 'Restaurant', platform: 'Platform', shared: 'Shared' };

/** Per campaign: what was issued, what is still usable, what was used and what it cost, and who pays for it. */
export async function campaignReport() {
  const { rows } = await pool.query(
    `select cm.id, cm.name, cm.status, cm.funding_source, cm.budget_minor, cm.starts_at, cm.ends_at,
      (select count(*)::int from vouchers v join voucher_pools p on p.id = v.pool_id where p.campaign_id = cm.id) as issued,
      (select count(*)::int from vouchers v join voucher_pools p on p.id = v.pool_id
         where p.campaign_id = cm.id and v.status = 'available' and v.expires_at > now()) as available,
      (select count(*)::int from vouchers v join voucher_pools p on p.id = v.pool_id where p.campaign_id = cm.id and v.status = 'redeemed') as redeemed_vouchers,
      (select count(*)::int from vouchers v join voucher_pools p on p.id = v.pool_id
         where p.campaign_id = cm.id and (v.status = 'expired' or (v.status = 'available' and v.expires_at <= now()))) as expired,
      (select count(*)::int from vouchers v join voucher_pools p on p.id = v.pool_id where p.campaign_id = cm.id and v.status = 'revoked') as revoked,
      (select count(*)::int from offer_redemptions r join offers o on o.id = r.offer_id where o.campaign_id = cm.id) as redemptions,
      (select coalesce(sum(r.amount_minor), 0)::bigint from offer_redemptions r join offers o on o.id = r.offer_id where o.campaign_id = cm.id) as discount_minor
     from campaigns cm where cm.restaurant_id = $1 order by cm.starts_at desc`,
    [RESTAURANT_ID],
  );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    status: r.status as string,
    fundedBy: FUNDERS[r.funding_source as string] ?? r.funding_source,
    budgetMinor: r.budget_minor as number | null,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    issued: r.issued as number,
    available: r.available as number,
    redeemed: r.redeemed_vouchers as number,
    expired: r.expired as number,
    revoked: r.revoked as number,
    redemptions: r.redemptions as number,
    discountMinor: Number(r.discount_minor),
    redemptionRate: r.issued ? Math.round(((r.redeemed_vouchers as number) / (r.issued as number)) * 1000) / 10 : null,
  }));
}

/** Discount given, split by who paid for it. */
export async function fundingReport() {
  const { rows } = await pool.query(
    `select cm.funding_source as funder, coalesce(sum(r.amount_minor), 0)::bigint as discount_minor, count(r.id)::int as redemptions
     from campaigns cm left join offers o on o.campaign_id = cm.id left join offer_redemptions r on r.offer_id = o.id
     where cm.restaurant_id = $1 group by cm.funding_source`,
    [RESTAURANT_ID],
  );
  return rows.map((r) => ({ fundedBy: FUNDERS[r.funder as string] ?? r.funder, discountMinor: Number(r.discount_minor), redemptions: r.redemptions as number }));
}

/** How many vouchers were issued each day, for the last thirty days. */
export async function issuanceByDay() {
  const { rows } = await pool.query(
    `select to_char(date_trunc('day', v.created_at), 'YYYY-MM-DD') as day, count(*)::int as issued
     from vouchers v join voucher_pools p on p.id = v.pool_id join campaigns cm on cm.id = p.campaign_id
     where cm.restaurant_id = $1 and v.created_at > now() - interval '30 days'
     group by 1 order by 1`,
    [RESTAURANT_ID],
  );
  return rows;
}

/** Each partner's use: codes requested, validations, refusals, and the last request. */
export async function partnerReport() {
  const { rows } = await pool.query(
    `select c.id, c.name, c.status,
      coalesce((select sum(b.requested_quantity) from voucher_batches b where b.partner_client_id = c.id and b.created_at > now() - interval '30 days'), 0)::int as codes_requested,
      (select count(*)::int from partner_api_audit a where a.client_id = c.id and a.created_at > now() - interval '30 days') as requests,
      (select count(*)::int from partner_api_audit a where a.client_id = c.id and a.status >= 400 and a.created_at > now() - interval '30 days') as refused,
      (select count(*)::int from partner_api_audit a where a.client_id = c.id and a.path like '%/validate') as validations,
      (select max(a.created_at) from partner_api_audit a where a.client_id = c.id) as last_request
     from partner_clients c where c.restaurant_id = $1 order by c.name`,
    [RESTAURANT_ID],
  );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    status: r.status as string,
    codesRequested: r.codes_requested as number,
    requests: r.requests as number,
    refused: r.refused as number,
    validations: r.validations as number,
    lastRequest: r.last_request ? new Date(r.last_request).toISOString() : null,
  }));
}

/** Batches that stopped, so someone can look at them. */
export async function failedBatches() {
  const { rows } = await pool.query(
    `select b.id, b.requested_quantity, b.generated_quantity, b.error_details, b.created_at, cm.name as campaign
     from voucher_batches b join voucher_pools p on p.id = b.pool_id join campaigns cm on cm.id = p.campaign_id
     where b.status = 'failed' and cm.restaurant_id = $1 order by b.created_at desc limit 50`,
    [RESTAURANT_ID],
  );
  return rows.map((r) => ({
    id: r.id as string,
    campaign: r.campaign as string,
    requested: r.requested_quantity as number,
    generated: r.generated_quantity as number,
    reason: (r.error_details ?? '') as string,
    at: new Date(r.created_at).toISOString(),
  }));
}

/**
 * Checks that the records agree with each other. Each check counts the records that do not agree; zero means it holds.
 * A non-zero count is a problem to look at, not something the report tidies away.
 */
export async function reconciliation() {
  const checks: { name: string; count: number; meaning: string }[] = [];
  const count = async (name: string, meaning: string, sql: string) => {
    const { rows } = await pool.query(sql, [RESTAURANT_ID]);
    checks.push({ name, count: rows[0].n as number, meaning });
  };
  await count('redeemed-without-record', 'Redeemed vouchers with no redemption record',
    `select count(*)::int as n from vouchers v join voucher_pools p on p.id = v.pool_id join campaigns cm on cm.id = p.campaign_id
     where cm.restaurant_id = $1 and v.status = 'redeemed' and not exists (select 1 from offer_redemptions r where r.voucher_id = v.id)`);
  await count('record-without-redemption', 'Voucher redemptions for vouchers that are not redeemed',
    `select count(*)::int as n from offer_redemptions r join vouchers v on v.id = r.voucher_id join voucher_pools p on p.id = v.pool_id join campaigns cm on cm.id = p.campaign_id
     where cm.restaurant_id = $1 and v.status <> 'redeemed'`);
  await count('confirmed-without-record', 'Orders confirmed with an offer but no redemption record',
    `select count(*)::int as n from orders o where o.offer_finalised and o.applied_offer_id is not null
       and o.restaurant_id = $1 and not exists (select 1 from offer_redemptions r where r.order_id = o.id)`);
  await count('held-on-cancelled-order', 'Holds still open on orders that were cancelled',
    `select count(*)::int as n from voucher_reservations res join orders o on o.id = res.order_id
     where res.status = 'held' and o.status in ('cancelled','rejected') and o.restaurant_id = $1`);
  return checks;
}

/** The whole report for the admin page. */
export async function promotionsReport() {
  const [campaigns, funding, issuance, partners, failed, checks] = await Promise.all([
    campaignReport(), fundingReport(), issuanceByDay(), partnerReport(), failedBatches(), reconciliation(),
  ]);
  const total = (key: 'issued' | 'available' | 'redeemed' | 'expired' | 'revoked' | 'redemptions' | 'discountMinor') =>
    campaigns.reduce((sum, c) => sum + Number(c[key]), 0);
  return {
    summary: {
      issued: total('issued'),
      available: total('available'),
      redeemed: total('redeemed'),
      expired: total('expired'),
      revoked: total('revoked'),
      redemptions: total('redemptions'),
      discountMinor: total('discountMinor'),
    },
    campaigns,
    funding,
    issuance,
    partners,
    failedBatches: failed,
    reconciliation: checks,
    reconciled: checks.every((c) => c.count === 0),
  };
}

/** The campaign table as CSV, for finance. */
export async function campaignsCsv(): Promise<string> {
  const rows = await campaignReport();
  const header = ['campaign', 'status', 'funded_by', 'issued', 'available', 'redeemed', 'expired', 'revoked', 'redemptions', 'discount_minor', 'redemption_rate_percent'];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.name, r.status, r.fundedBy, r.issued, r.available, r.redeemed, r.expired, r.revoked, r.redemptions, r.discountMinor, r.redemptionRate ?? ''].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}
