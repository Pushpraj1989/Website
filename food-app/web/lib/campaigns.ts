// Campaigns, rules, voucher pools and code generation for staff. Phase 2 of the promotions brief.
// A campaign's rules are ordinary `offers` rows linked to the campaign, so the price logic applies to them unchanged.
// Codes are generated with a cryptographic random source, stored as keyed hashes (lookups) and encrypted copies (for
// printing and export later). A batch is all-or-nothing: either every code is created or none are.
import { createHmac, randomInt } from 'node:crypto';
import { pool, withTx } from './db.ts';
import { RESTAURANT_ID, validateOffer, offerView } from './catalog.ts';
import { encryptSecret } from './crypto.ts';
import { RuleError } from './orders.ts';
import type { PoolClient } from 'pg';
import { currentVersionId } from './templates.ts';

/** Largest batch created in one request. Bigger batches need the background worker (Phase 4 of the brief). */
export const BULK_SYNC_LIMIT = 1000;
const MAX_ATTEMPTS = 5;
const FUNDING = ['platform', 'restaurant', 'shared'];
const ALPHABET = {
  '#': '0123456789',
  '@': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '*': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
} as const;

function voucherSecret(): string {
  const secret = process.env.VOUCHER_CODE_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('VOUCHER_CODE_SECRET must be set in production');
  return secret ?? 'dev-only-voucher-secret';
}

/** The lookup hash of a normalised code. Keyed, so a leaked table cannot be used to test guesses without the key. */
export const codeHash = (normalised: string) => createHmac('sha256', voucherSecret()).update(normalised).digest('hex');

export function normaliseCode(raw: unknown): string {
  const code = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9-]{4,30}$/.test(code)) throw new RuleError('A code is 4 to 30 letters, digits or dashes.', 'bad_input', 400);
  return code;
}

function text(value: unknown, label: string, max: number): string {
  const s = String(value ?? '').trim();
  if (s.length < 1 || s.length > max) throw new RuleError(`${label} must be 1 to ${max} characters.`, 'bad_input', 400);
  return s;
}

function int(value: unknown, label: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new RuleError(`${label} must be a whole number from ${min} to ${max}.`, 'bad_input', 400);
  return n;
}

function date(value: unknown, label: string): Date {
  const d = new Date(String(value ?? ''));
  if (Number.isNaN(d.getTime())) throw new RuleError(`${label} must be a date and time.`, 'bad_input', 400);
  return d;
}

function optionalInt(value: unknown, label: string, min: number, max: number): number | null {
  return value === undefined || value === null || value === '' ? null : int(value, label, min, max);
}

/** Moves campaigns along their dates. A scheduled campaign becomes active when it starts; any campaign completes when it ends. */
export async function refreshCampaignStatuses(c: { query: PoolClient['query'] } = pool): Promise<void> {
  await c.query(`update campaigns set status = 'active', updated_at = now() where status = 'scheduled' and starts_at <= now() and ends_at > now()`);
  await c.query(`update campaigns set status = 'completed', updated_at = now() where status in ('scheduled','active','paused') and ends_at <= now()`);
  await c.query(`update offers set active = false where campaign_id in (select id from campaigns where status in ('completed','cancelled')) and active`);
}

export function campaignView(row: Record<string, any>) {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    timezone: row.timezone as string,
    budgetMinor: row.budget_minor as number | null,
    fundingSource: row.funding_source as string,
    maxIssuance: row.max_issuance as number | null,
    maxRedemptions: row.max_redemptions as number | null,
  };
}

function campaignFields(body: Record<string, unknown>) {
  const startsAt = date(body.startsAt, 'Start');
  const endsAt = date(body.endsAt, 'End');
  if (endsAt <= startsAt) throw new RuleError('The end must be after the start.', 'bad_input', 400);
  const funding = String(body.fundingSource ?? 'restaurant');
  if (!FUNDING.includes(funding)) throw new RuleError('Choose who pays for the discount.', 'bad_input', 400);
  return {
    name: text(body.name, 'Name', 120),
    startsAt,
    endsAt,
    timezone: text(body.timezone ?? 'Asia/Dubai', 'Timezone', 60),
    budgetMinor: optionalInt(body.budgetMinor, 'Budget', 0, 1_000_000_000),
    fundingSource: funding,
    maxIssuance: optionalInt(body.maxIssuance, 'Maximum issued', 1, 100_000_000),
    maxRedemptions: optionalInt(body.maxRedemptions, 'Maximum redeemed', 1, 100_000_000),
  };
}

export async function listCampaigns() {
  await refreshCampaignStatuses();
  const { rows } = await pool.query(`select * from campaigns where restaurant_id = $1 order by created_at desc`, [RESTAURANT_ID]);
  return rows.map(campaignView);
}

export async function createCampaign(body: Record<string, unknown>) {
  const f = campaignFields(body);
  const { rows } = await pool.query(
    `insert into campaigns (restaurant_id, name, starts_at, ends_at, timezone, budget_minor, funding_source, max_issuance, max_redemptions)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [RESTAURANT_ID, f.name, f.startsAt, f.endsAt, f.timezone, f.budgetMinor, f.fundingSource, f.maxIssuance, f.maxRedemptions],
  );
  return campaignView(rows[0]);
}

/** A draft campaign can be changed. Once it is scheduled, active or paused, its dates and budget are fixed. */
export async function updateCampaign(id: string, body: Record<string, unknown>) {
  return withTx(async (c) => {
    const current = await lockCampaign(c, id);
    if (current.status !== 'draft') throw new RuleError('Only a draft campaign can be changed.', 'not_editable', 409);
    const view = campaignView(current);
    const f = campaignFields({
      name: body.name ?? view.name,
      startsAt: body.startsAt ?? view.startsAt,
      endsAt: body.endsAt ?? view.endsAt,
      timezone: body.timezone ?? view.timezone,
      budgetMinor: body.budgetMinor === undefined ? view.budgetMinor : body.budgetMinor,
      fundingSource: body.fundingSource ?? view.fundingSource,
      maxIssuance: body.maxIssuance === undefined ? view.maxIssuance : body.maxIssuance,
      maxRedemptions: body.maxRedemptions === undefined ? view.maxRedemptions : body.maxRedemptions,
    });
    const { rows } = await c.query(
      `update campaigns set name=$2, starts_at=$3, ends_at=$4, timezone=$5, budget_minor=$6, funding_source=$7, max_issuance=$8, max_redemptions=$9, updated_at=now()
       where id=$1 returning *`,
      [id, f.name, f.startsAt, f.endsAt, f.timezone, f.budgetMinor, f.fundingSource, f.maxIssuance, f.maxRedemptions],
    );
    return campaignView(rows[0]);
  });
}

async function lockCampaign(c: PoolClient, id: string): Promise<Record<string, any>> {
  const { rows } = await c.query(`select * from campaigns where id = $1 and restaurant_id = $2 for update`, [id, RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Campaign not found.', 'not_found', 404);
  return rows[0];
}

export async function getCampaign(id: string) {
  await refreshCampaignStatuses();
  const { rows } = await pool.query(`select * from campaigns where id = $1 and restaurant_id = $2`, [id, RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Campaign not found.', 'not_found', 404);
  const offers = await pool.query(`select * from offers where campaign_id = $1 order by starts_at`, [id]);
  const pools = await pool.query(`select * from voucher_pools where campaign_id = $1 order by created_at`, [id]);
  return { campaign: campaignView(rows[0]), offers: offers.rows.map(offerView), pools: pools.rows.map(poolView) };
}

export type CampaignAction = 'activate' | 'pause' | 'resume' | 'complete' | 'cancel';

const TRANSITIONS: Record<CampaignAction, { from: string[]; to: (startsAt: Date) => string; offersOn: boolean }> = {
  activate: { from: ['draft'], to: (s) => (s > new Date() ? 'scheduled' : 'active'), offersOn: true },
  pause: { from: ['scheduled', 'active'], to: () => 'paused', offersOn: false },
  resume: { from: ['paused'], to: (s) => (s > new Date() ? 'scheduled' : 'active'), offersOn: true },
  complete: { from: ['active', 'paused'], to: () => 'completed', offersOn: false },
  cancel: { from: ['draft', 'scheduled', 'active', 'paused'], to: () => 'cancelled', offersOn: false },
};

/** Moves a campaign through its states. Pausing, completing or cancelling switches its offers off; resuming switches them on. */
export async function transitionCampaign(id: string, action: string) {
  const rule = TRANSITIONS[action as CampaignAction];
  if (!rule) throw new RuleError('Unknown campaign action.', 'bad_input', 400);
  await withTx(async (c) => {
    const current = await lockCampaign(c, id);
    if (!rule.from.includes(current.status)) {
      throw new RuleError(`A ${current.status} campaign cannot be ${action}d.`, 'bad_transition', 409);
    }
    if (action === 'activate' || action === 'resume') {
      const { rows } = await c.query(`select count(*)::int as n from offers where campaign_id = $1`, [id]);
      if (rows[0].n === 0) throw new RuleError('Add at least one rule to the campaign before it starts.', 'no_rules', 409);
    }
    const next = rule.to(new Date(current.starts_at));
    await c.query(`update campaigns set status = $2, updated_at = now() where id = $1`, [id, next]);
    await c.query(`update offers set active = $2 where campaign_id = $1`, [id, rule.offersOn]);
  });
  // Read after the commit: the read uses its own connection, which cannot see changes still inside the transaction.
  return getCampaign(id);
}

/** Adds a rule to a campaign. The rule is an offer, so the same discount types, audiences and limits apply. */
export async function createCampaignOffer(campaignId: string, body: Record<string, unknown>) {
  const v = validateOffer(body);
  return withTx(async (c) => {
    const campaign = await lockCampaign(c, campaignId);
    if (['completed', 'cancelled'].includes(campaign.status)) throw new RuleError('This campaign has ended.', 'not_editable', 409);
    const starts = new Date(v.startsAt);
    const ends = new Date(v.endsAt);
    if (starts < new Date(campaign.starts_at) || ends > new Date(campaign.ends_at)) {
      throw new RuleError('A rule must fall inside the campaign dates.', 'bad_input', 400);
    }
    if (v.code) {
      const taken = await c.query(`select 1 from offers where code = $1`, [v.code]);
      if (taken.rows[0]) throw new RuleError('That code is already used by another offer.', 'duplicate', 409);
    }
    const active = campaign.status === 'active';
    const { rows } = await c.query(
      `insert into offers (restaurant_id, campaign_id, name_en, name_ar, offer_type, value_int, applies_to, audience, min_subtotal_minor,
         code, starts_at, ends_at, usage_limit, max_discount_minor, active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
      [RESTAURANT_ID, campaignId, v.nameEn, v.nameAr, v.type, v.value, v.appliesTo, v.audience, v.minSubtotalMinor, v.code, v.startsAt, v.endsAt, v.usageLimit, v.maxDiscountMinor, active],
    );
    return offerView(rows[0]);
  });
}

export function poolView(row: Record<string, any>) {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    offerId: row.offer_id as string,
    codePattern: row.code_pattern as string,
    quantityLimit: row.quantity_limit as number | null,
    issuedCount: row.issued_count as number,
    status: row.status as string,
    templateId: (row.template_id ?? null) as string | null,
  };
}

export async function createPool(campaignId: string, body: Record<string, unknown>) {
  const offerId = text(body.offerId, 'Rule', 60);
  const pattern = text(body.codePattern, 'Code pattern', 40).toUpperCase();
  if (!/^[A-Z0-9#@*-]{4,40}$/.test(pattern)) throw new RuleError('A pattern uses letters, digits, dashes, and # (digit), @ (letter), * (either).', 'bad_input', 400);
  const limit = optionalInt(body.quantityLimit, 'Quantity limit', 1, 100_000_000);
  const templateId = body.templateId ? String(body.templateId) : null;
  return withTx(async (c) => {
    const campaign = await lockCampaign(c, campaignId);
    if (templateId) {
      const t = await c.query(`select status, current_version from voucher_templates where id = $1 and restaurant_id = $2`, [templateId, RESTAURANT_ID]);
      if (!t.rows[0]) throw new RuleError('Template not found.', 'not_found', 404);
      if (t.rows[0].status !== 'published') throw new RuleError('Publish the template before using it on a pool.', 'not_published', 409);
    }
    if (['completed', 'cancelled'].includes(campaign.status)) throw new RuleError('This campaign has ended.', 'not_editable', 409);
    const offer = await c.query(`select id from offers where id = $1 and campaign_id = $2`, [offerId, campaignId]);
    if (!offer.rows[0]) throw new RuleError('Choose a rule that belongs to this campaign.', 'bad_input', 400);
    const { rows } = await c.query(
      `insert into voucher_pools (campaign_id, offer_id, code_pattern, quantity_limit, template_id) values ($1,$2,$3,$4,$5) returning *`,
      [campaignId, offerId, pattern, limit, templateId],
    );
    return poolView(rows[0]);
  });
}

/** How many different codes a pattern can make. Used to refuse a pattern too small for the batch. */
export function patternCombinations(pattern: string): bigint {
  let total = 1n;
  for (const ch of pattern) {
    if (ch in ALPHABET) total *= BigInt(ALPHABET[ch as keyof typeof ALPHABET].length);
  }
  return total;
}

/** A code from a pattern: '#' a digit, '@' a letter, '*' a letter or digit, anything else copied as it is. */
export function generateCode(pattern: string): string {
  let out = '';
  for (const ch of pattern) {
    if (ch in ALPHABET) {
      const set = ALPHABET[ch as keyof typeof ALPHABET];
      out += set[randomInt(set.length)];
    } else {
      out += ch;
    }
  }
  return out;
}

/** Locks a pool and its campaign, and checks that a voucher may be issued from them now. */
async function assertCanIssue(c: PoolClient, poolId: string, count: number, expiresAt: Date) {
  const { rows } = await c.query(
    `select p.*, c.status as campaign_status, c.ends_at as campaign_ends, c.max_issuance, c.id as campaign
     from voucher_pools p join campaigns c on c.id = p.campaign_id
     where p.id = $1 and c.restaurant_id = $2 for update of p`,
    [poolId, RESTAURANT_ID],
  );
  const p = rows[0];
  if (!p) throw new RuleError('Pool not found.', 'not_found', 404);
  if (p.status !== 'active') throw new RuleError('This pool is closed.', 'pool_closed', 409);
  if (!['active', 'scheduled'].includes(p.campaign_status)) throw new RuleError('Its campaign is not running.', 'campaign_not_running', 409);
  if (expiresAt <= new Date()) throw new RuleError('The expiry must be in the future.', 'bad_input', 400);
  if (expiresAt > new Date(p.campaign_ends)) throw new RuleError('A voucher cannot expire after its campaign ends.', 'bad_input', 400);
  if (p.quantity_limit !== null && p.issued_count + count > p.quantity_limit) {
    throw new RuleError(`This pool has room for ${p.quantity_limit - p.issued_count} more.`, 'pool_full', 409);
  }
  if (p.max_issuance !== null) {
    const { rows: used } = await c.query(
      `select coalesce(sum(p2.issued_count), 0)::int as n from voucher_pools p2 where p2.campaign_id = $1`,
      [p.campaign],
    );
    if (used[0].n + count > p.max_issuance) throw new RuleError('The campaign has no issuance left.', 'campaign_full', 409);
  }
  return p;
}

/** One manual code, typed by staff. It is checked for uniqueness and is stored the same way as a generated code. */
export async function addManualCode(poolId: string, body: Record<string, unknown>) {
  const code = normaliseCode(body.code);
  const expiresAt = date(body.expiresAt, 'Expiry');
  return withTx(async (c) => {
    const p = await assertCanIssue(c, poolId, 1, expiresAt);
    const taken = await c.query(`select 1 from vouchers where code_hash = $1`, [codeHash(code)]);
    if (taken.rows[0]) throw new RuleError('That code is already in use.', 'duplicate', 409);
    const templateVersion = await currentVersionId(c, p.template_id ?? null);
    const { rows } = await c.query(
      `insert into vouchers (pool_id, offer_id, code_hash, code_ciphertext, expires_at, template_version_id) values ($1,$2,$3,$4,$5,$6) returning id`,
      [poolId, p.offer_id, codeHash(code), encryptSecret(code), expiresAt, templateVersion],
    );
    await c.query(`insert into voucher_ledger (voucher_id, event, detail) values ($1, 'issued', '{"source":"manual"}')`, [rows[0].id]);
    await c.query(`update voucher_pools set issued_count = issued_count + 1 where id = $1`, [poolId]);
    return { voucherId: rows[0].id as string, codeHint: code.slice(-4) };
  });
}

export function batchView(row: Record<string, any>) {
  return {
    id: row.id as string,
    poolId: row.pool_id as string,
    requestedQuantity: row.requested_quantity as number,
    generatedQuantity: row.generated_quantity as number,
    status: row.status as string,
    errorDetails: (row.error_details ?? null) as string | null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

/** Codes made per transaction when a large batch runs. Each chunk commits on its own, so a stop loses no finished work. */
export const CHUNK = 500;

/**
 * Starts a batch of unique codes. The whole quantity is reserved on the pool now, so no other batch can take it.
 * Up to BULK_SYNC_LIMIT codes are made in this request. Larger batches are queued and finished by runBatch.
 * The same idempotency key returns the batch it made before, and never a second one.
 */
export async function createBatch(poolId: string, body: Record<string, unknown>, idempotencyKey: string) {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) throw new RuleError('Send an Idempotency-Key header of 8 to 80 characters.', 'bad_input', 400);
  const quantity = int(body.quantity, 'Quantity', 1, 10_000);
  const expiresAt = date(body.expiresAt, 'Expiry');
  const immediate = quantity <= BULK_SYNC_LIMIT;
  const created = await withTx(async (c) => {
    const earlier = await c.query(`select * from voucher_batches where idempotency_key = $1`, [idempotencyKey]);
    if (earlier.rows[0]) {
      if (earlier.rows[0].pool_id !== poolId) throw new RuleError('That key was used for another pool.', 'idempotency_conflict', 409);
      return { view: batchView(earlier.rows[0]), fresh: false };
    }
    const p = await assertCanIssue(c, poolId, quantity, expiresAt);
    const combinations = patternCombinations(p.code_pattern);
    if (combinations < BigInt(quantity) * 10n) {
      throw new RuleError('This pattern has too few codes for that many. Use more # or @ characters.', 'pattern_too_small', 422);
    }
    await c.query(`update voucher_pools set issued_count = issued_count + $2 where id = $1`, [poolId, quantity]);
    const batch = await c.query(
      `insert into voucher_batches (pool_id, requested_quantity, status, idempotency_key, expires_at) values ($1,$2,$3,$4,$5) returning *`,
      [poolId, quantity, immediate ? 'running' : 'queued', idempotencyKey, expiresAt],
    );
    if (immediate) {
      await makeCodes(c, batch.rows[0].id, quantity);
      const done = await c.query(`update voucher_batches set generated_quantity = $2, status = 'completed', completed_at = now() where id = $1 returning *`, [batch.rows[0].id, quantity]);
      return { view: batchView(done.rows[0]), fresh: true };
    }
    return { view: batchView(batch.rows[0]), fresh: true };
  });
  return created.view;
}

/**
 * Makes `count` unique codes for a batch, inside the caller's transaction. Collisions are retried with new codes.
 * The pool's issued count is not changed here: createBatch reserved the whole quantity already.
 */
async function makeCodes(c: PoolClient, batchId: string, count: number) {
  const b = await c.query(`select b.pool_id, p.* from voucher_batches b join voucher_pools p on p.id = b.pool_id where b.id = $1`, [batchId]);
  const p = b.rows[0];
  const expiresAt = (await c.query(`select expires_at from voucher_batches where id = $1`, [batchId])).rows[0].expires_at;
  const templateVersion = await currentVersionId(c, p.template_id ?? null);
  const made = new Map<string, string>(); // code hash -> voucher id
  const hashToCode = new Map<string, string>();
  for (let attempt = 0; attempt < MAX_ATTEMPTS && made.size < count; attempt++) {
    const need = count - made.size;
    const hashes: string[] = [];
    const ciphers: string[] = [];
    for (let i = 0; i < need; i++) {
      const code = generateCode(p.code_pattern);
      const h = codeHash(code);
      if (made.has(h) || hashToCode.has(h)) continue;
      hashToCode.set(h, code);
      hashes.push(h);
      ciphers.push(encryptSecret(code));
    }
    if (hashes.length === 0) continue;
    const { rows } = await c.query(
      `insert into vouchers (pool_id, offer_id, batch_id, code_hash, code_ciphertext, expires_at, template_version_id)
       select $1, $2, $3, h, cipher, $4, $7 from unnest($5::text[], $6::text[]) as t(h, cipher)
       on conflict (code_hash) do nothing returning id, code_hash`,
      [p.id, p.offer_id, batchId, expiresAt, hashes, ciphers, templateVersion],
    );
    for (const r of rows) made.set(r.code_hash, r.id);
  }
  if (made.size < count) throw new RuleError('Could not make enough unique codes. Try again.', 'collision', 500);
  const ids = [...made.values()];
  await c.query(
    `insert into voucher_ledger (voucher_id, event, detail) select v, 'issued', jsonb_build_object('batch', $2::text) from unnest($1::uuid[]) as t(v)`,
    [ids, batchId],
  );
  return made.size;
}

/**
 * Finishes a queued batch, a few chunks per call, so the admin can drive it to the end. Each chunk is its own
 * transaction. A campaign that stops or a voucher date that passes fails the batch and keeps the codes already made.
 */
export async function runBatch(batchId: string, maxChunks = 4) {
  for (let i = 0; i < maxChunks; i++) {
    // The outcome is returned from the transaction and thrown after it, so a failure is saved before it is reported.
    const outcome = await withTx(async (c): Promise<{ done: boolean; failed?: string }> => {
      const { rows } = await c.query(
        `select b.* from voucher_batches b join voucher_pools p on p.id = b.pool_id join campaigns cm on cm.id = p.campaign_id
         where b.id = $1 and cm.restaurant_id = $2 for update of b`,
        [batchId, RESTAURANT_ID],
      );
      const batch = rows[0];
      if (!batch) throw new RuleError('Batch not found.', 'not_found', 404);
      if (batch.status === 'completed') return { done: true };
      if (batch.status === 'failed') return { done: true, failed: batch.error_details ?? 'This batch failed.' };
      const pool = await c.query(`select p.*, cm.status as campaign_status, cm.ends_at as campaign_ends from voucher_pools p join campaigns cm on cm.id = p.campaign_id where p.id = $1 for update of p`, [batch.pool_id]);
      const campaignOk = ['active', 'scheduled'].includes(pool.rows[0].campaign_status);
      if (!campaignOk || new Date(batch.expires_at) > new Date(pool.rows[0].campaign_ends) || new Date(batch.expires_at) <= new Date()) {
        const reason = !campaignOk ? 'The campaign stopped before the batch finished.' : 'A voucher date passed before the batch finished.';
        await c.query(`update voucher_batches set status = 'failed', error_details = $2 where id = $1`, [batchId, reason]);
        return { done: true, failed: reason };
      }
      await c.query(`update voucher_batches set status = 'running' where id = $1`, [batchId]);
      const have = (await c.query(`select count(*)::int as n from vouchers where batch_id = $1`, [batchId])).rows[0].n;
      const count = Math.min(CHUNK, batch.requested_quantity - have);
      if (count > 0) await makeCodes(c, batchId, count);
      const total = have + Math.max(count, 0);
      if (total >= batch.requested_quantity) {
        await c.query(`update voucher_batches set generated_quantity = $2, status = 'completed', completed_at = now() where id = $1`, [batchId, total]);
        return { done: true };
      }
      await c.query(`update voucher_batches set generated_quantity = $2 where id = $1`, [batchId, total]);
      return { done: false };
    });
    if (outcome.failed) throw new RuleError(outcome.failed, 'batch_failed', 409);
    if (outcome.done) break;
  }
  const { rows } = await pool.query(`select * from voucher_batches where id = $1`, [batchId]);
  return batchView(rows[0]);
}

export async function getPool(poolId: string) {
  const { rows } = await pool.query(
    `select p.* from voucher_pools p join campaigns c on c.id = p.campaign_id where p.id = $1 and c.restaurant_id = $2`,
    [poolId, RESTAURANT_ID],
  );
  if (!rows[0]) throw new RuleError('Pool not found.', 'not_found', 404);
  const counts = await pool.query(`select status, count(*)::int as n from vouchers where pool_id = $1 group by status`, [poolId]);
  const batches = await pool.query(`select * from voucher_batches where pool_id = $1 order by created_at desc limit 20`, [poolId]);
  const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]));
  return { pool: poolView(rows[0]), vouchersByStatus: byStatus, batches: batches.rows.map(batchView) };
}
