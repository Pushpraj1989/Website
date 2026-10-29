// Partner integrations (Phase 7 of the promotions brief). A partner application authenticates with its key, is limited
// to the scopes and campaigns it was given, and can never set a discount: the value of every voucher comes from the
// campaign's rule. Every request is rate limited, logged, and, for changes, idempotent.
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { pool } from './db.ts';
import { RESTAURANT_ID } from './catalog.ts';
import { createBatch, codeHash, normaliseCode, runBatch, batchView } from './campaigns.ts';
import { codeOf } from './print.ts';
import { RuleError } from './orders.ts';

export const SCOPES = ['vouchers:issue', 'vouchers:read', 'vouchers:validate', 'campaigns:read', 'codes:export'] as const;
export type Scope = (typeof SCOPES)[number];
export const DAILY_WINDOW_HOURS = 24;
const ISSUE_FIELDS = ['campaignId', 'quantity', 'expiresAt', 'externalReference'];
const BATCH_FIELDS = ['campaignId', 'quantity', 'expiresAt', 'externalReference'];

function secretKey(): string {
  const s = process.env.PARTNER_KEY_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('PARTNER_KEY_SECRET must be set in production');
  return s ?? 'dev-only-partner-secret';
}

const hashSecret = (secret: string) => createHmac('sha256', secretKey()).update(secret).digest('hex');

export type PartnerClient = {
  id: string;
  name: string;
  scopes: Scope[];
  dailyIssueLimit: number;
  requestsPerMinute: number;
  status: string;
  campaignIds: string[];
};

/** Creates a partner client. The key is returned once; only a keyed hash of its secret is kept. */
export async function createPartnerClient(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  if (name.length < 1 || name.length > 120) throw new RuleError('Name the partner (1 to 120 characters).', 'bad_input', 400);
  const scopes = Array.isArray(body.scopes) ? body.scopes.map(String) : [];
  for (const s of scopes) if (!(SCOPES as readonly string[]).includes(s)) throw new RuleError(`Unknown scope: ${s}.`, 'bad_input', 400);
  const campaignIds = Array.isArray(body.campaignIds) ? body.campaignIds.map(String) : [];
  const daily = Number(body.dailyIssueLimit ?? 1000);
  const perMinute = Number(body.requestsPerMinute ?? 60);
  if (!Number.isInteger(daily) || daily < 0 || daily > 1_000_000) throw new RuleError('The daily limit is 0 to 1,000,000.', 'bad_input', 400);
  if (!Number.isInteger(perMinute) || perMinute < 1 || perMinute > 6000) throw new RuleError('Requests per minute is 1 to 6,000.', 'bad_input', 400);
  const id = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  return pool.connect().then(async (c) => {
    try {
      await c.query('begin');
      const own = await c.query(`select id from campaigns where id = any($1::uuid[]) and restaurant_id = $2`, [campaignIds, RESTAURANT_ID]);
      if (own.rows.length !== campaignIds.length) throw new RuleError('Choose campaigns from this restaurant.', 'bad_input', 400);
      await c.query(
        `insert into partner_clients (id, restaurant_id, name, scopes, daily_issue_limit, requests_per_minute, secret_hash) values ($1,$2,$3,$4,$5,$6,$7)`,
        [id, RESTAURANT_ID, name, scopes, daily, perMinute, hashSecret(secret)],
      );
      for (const campaignId of campaignIds) {
        await c.query(`insert into partner_client_campaigns (client_id, campaign_id) values ($1,$2)`, [id, campaignId]);
      }
      await c.query('commit');
    } catch (err) {
      await c.query('rollback');
      throw err;
    } finally {
      c.release();
    }
    return { client: await clientView(id), apiKey: `pk_${id}_${secret}` };
  });
}

async function clientView(id: string) {
  const { rows } = await pool.query(
    `select c.*, coalesce((select array_agg(campaign_id order by campaign_id) from partner_client_campaigns where client_id = c.id), '{}') as campaigns
     from partner_clients c where c.id = $1`,
    [id],
  );
  const r = rows[0];
  return {
    id: r.id as string,
    name: r.name as string,
    status: r.status as string,
    scopes: r.scopes as Scope[],
    dailyIssueLimit: r.daily_issue_limit as number,
    requestsPerMinute: r.requests_per_minute as number,
    campaignIds: r.campaigns as string[],
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function listPartnerClients() {
  const { rows } = await pool.query(`select id from partner_clients where restaurant_id = $1 order by created_at desc`, [RESTAURANT_ID]);
  return Promise.all(rows.map((r) => clientView(r.id)));
}

/** Gives the partner a new key. The old key stops working at once. */
export async function rotatePartnerKey(id: string) {
  const secret = randomBytes(32).toString('base64url');
  const { rows } = await pool.query(`update partner_clients set secret_hash = $2 where id = $1 and restaurant_id = $3 and status = 'active' returning id`, [id, hashSecret(secret), RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Partner not found, or revoked.', 'not_found', 404);
  return { client: await clientView(id), apiKey: `pk_${id}_${secret}` };
}

export async function revokePartnerClient(id: string) {
  const { rows } = await pool.query(
    `update partner_clients set status = 'revoked', revoked_at = now() where id = $1 and restaurant_id = $2 and status = 'active' returning id`,
    [id, RESTAURANT_ID],
  );
  if (!rows[0]) throw new RuleError('Partner not found, or already revoked.', 'not_found', 404);
  return clientView(id);
}

const UNAUTHORISED = 'Missing or invalid partner key.';

/** Reads the key, checks its secret against the stored hash, and returns the client. Anything wrong gives one answer. */
export async function authenticate(key: string | null): Promise<PartnerClient> {
  const token = key ?? '';
  const match = /^pk_([0-9a-f-]{36})_([A-Za-z0-9_-]{20,})$/.exec(token);
  if (!match) throw new RuleError(UNAUTHORISED, 'unauthorised', 401);
  const { rows } = await pool.query(`select * from partner_clients where id = $1 and status = 'active'`, [match[1]]);
  const row = rows[0];
  if (!row) throw new RuleError(UNAUTHORISED, 'unauthorised', 401);
  const given = Buffer.from(hashSecret(match[2]));
  const stored = Buffer.from(row.secret_hash as string);
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) throw new RuleError(UNAUTHORISED, 'unauthorised', 401);
  const campaigns = await pool.query(`select campaign_id from partner_client_campaigns where client_id = $1`, [row.id]);
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes as Scope[],
    dailyIssueLimit: row.daily_issue_limit,
    requestsPerMinute: row.requests_per_minute,
    status: row.status,
    campaignIds: campaigns.rows.map((r) => r.campaign_id as string),
  };
}

function requireScope(client: PartnerClient, scope: Scope) {
  if (!client.scopes.includes(scope)) throw new RuleError(`This partner key does not have the ${scope} permission.`, 'forbidden', 403);
}

function requireCampaign(client: PartnerClient, campaignId: unknown): string {
  const id = String(campaignId ?? '');
  if (!client.campaignIds.includes(id)) throw new RuleError('This partner cannot issue from that campaign.', 'forbidden', 403);
  return id;
}

/** Refuses any field the partner may not set, so a discount cannot be smuggled into a request. */
function onlyFields(body: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw new RuleError(`The field ${key} cannot be set by a partner. The campaign sets the value.`, 'unknown_field', 400);
  }
}

/** Per-minute request limit, counted from the audit log. */
async function checkRate(client: PartnerClient) {
  const { rows } = await pool.query(
    `select count(*)::int as n from partner_api_audit where client_id = $1 and created_at > now() - interval '1 minute'`,
    [client.id],
  );
  if (rows[0].n >= client.requestsPerMinute) throw new RuleError('Too many requests. Wait a minute and try again.', 'rate_limited', 429);
}

/** Codes requested in the last day, across single and bulk requests. */
async function requestedToday(clientId: string): Promise<number> {
  const { rows } = await pool.query(
    `select coalesce(sum(requested_quantity), 0)::int as n from voucher_batches where partner_client_id = $1 and created_at > now() - ($2 || ' hours')::interval`,
    [clientId, String(DAILY_WINDOW_HOURS)],
  );
  return rows[0].n;
}

async function checkQuota(client: PartnerClient, quantity: number) {
  if ((await requestedToday(client.id)) + quantity > client.dailyIssueLimit) {
    throw new RuleError('This partner has reached its daily limit of codes.', 'quota_exceeded', 429);
  }
}

/** The partner's view of a campaign's rule: the benefit, never the budget or the usage. */
function benefitOf(row: Record<string, any>) {
  return {
    type: row.offer_type as string,
    value: Number(row.value_int),
    minOrderMinor: Number(row.min_subtotal_minor),
    currency: row.currency as string,
  };
}

/** The campaign's active pool to issue from: the oldest one that is open. */
async function poolFor(campaignId: string) {
  const { rows } = await pool.query(
    `select p.id, p.offer_id from voucher_pools p join offers o on o.id = p.offer_id
     where p.campaign_id = $1 and p.status = 'active' and o.active
     order by p.created_at limit 1`,
    [campaignId],
  );
  if (!rows[0]) throw new RuleError('This campaign has no open code pool yet.', 'no_pool', 409);
  return rows[0] as { id: string; offer_id: string };
}

async function campaignEnd(campaignId: string): Promise<Date> {
  const { rows } = await pool.query(`select ends_at from campaigns where id = $1`, [campaignId]);
  return new Date(rows[0].ends_at);
}

function expiryFrom(body: Record<string, unknown>, end: Date): Date {
  if (body.expiresAt === undefined) return end;
  const d = new Date(String(body.expiresAt));
  if (Number.isNaN(d.getTime())) throw new RuleError('The expiry must be a date and time.', 'bad_input', 400);
  return d < end ? d : end;
}

/** Idempotent replay: the same key and the same body return the first answer; a different body is refused. */
async function replayOrRun(client: PartnerClient, key: string | null, body: Record<string, unknown>, run: () => Promise<{ status: number; body: unknown }>) {
  if (!key || key.length < 8 || key.length > 120) throw new RuleError('Send an Idempotency-Key header of 8 to 120 characters.', 'bad_input', 400);
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const { rows } = await pool.query(`select * from partner_idempotency where client_id = $1 and idempotency_key = $2`, [client.id, key]);
  if (rows[0]) {
    if (rows[0].request_hash !== hash) throw new RuleError('That key was used with a different request.', 'idempotency_conflict', 409);
    return { status: rows[0].response_status as number, body: rows[0].response_body, replayed: true };
  }
  const result = await run();
  await pool.query(
    `insert into partner_idempotency (client_id, idempotency_key, request_hash, response_status, response_body) values ($1,$2,$3,$4,$5)
     on conflict (client_id, idempotency_key) do nothing`,
    [client.id, key, hash, result.status, JSON.stringify(result.body)],
  );
  return { ...result, replayed: false };
}

/** Benefit and codes for the vouchers of a batch, read back for the partner. Codes are only returned here. */
async function vouchersOf(batchId: string, limit = 500) {
  const { rows } = await pool.query(
    `select v.id, v.code_hash, v.code_ciphertext, v.expires_at, v.status, o.offer_type, o.value_int, o.min_subtotal_minor, r.currency_code as currency
     from vouchers v join offers o on o.id = v.offer_id join restaurant r on r.id = $2
     where v.batch_id = $1 order by v.id limit $3`,
    [batchId, RESTAURANT_ID, limit],
  );
  return rows.map((r) => ({
    voucherId: r.id as string,
    code: codeOf(r),
    expiresAt: new Date(r.expires_at).toISOString(),
    benefit: benefitOf(r),
  }));
}

/** Issues one or a few vouchers from a campaign. The codes come back in the response, once. */
export async function issueVouchers(client: PartnerClient, body: Record<string, unknown>, key: string | null) {
  onlyFields(body, ISSUE_FIELDS);
  requireScope(client, 'vouchers:issue');
  const campaignId = requireCampaign(client, body.campaignId);
  const quantity = body.quantity === undefined ? 1 : Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new RuleError('A single request issues 1 to 100 vouchers. Use a batch for more.', 'bad_input', 400);
  const expiresAt = expiryFrom(body, await campaignEnd(campaignId));
  return replayOrRun(client, key, body, async () => {
    await checkQuota(client, quantity);
    const open = await poolFor(campaignId);
    const batch = await createBatch(open.id, { quantity, expiresAt }, partnerKey(client.id, key!), client.id);
    const vouchers = await vouchersOf(batch.id);
    return { status: 201, body: { batch: batchView(await batchRow(batch.id)), vouchers } };
  });
}

async function batchRow(id: string) {
  const { rows } = await pool.query(`select * from voucher_batches where id = $1`, [id]);
  return rows[0];
}

/** The batch key used for a partner request: stable for the partner and the key, and within the key length limit. */
function partnerKey(clientId: string, key: string | null): string {
  return 'p' + createHash('sha256').update(`${clientId}:${key}`).digest('hex');
}

/** Requests a bulk batch. Batches over 1,000 are queued; the partner's status polls finish them a few chunks at a time. */
export async function requestBatch(client: PartnerClient, body: Record<string, unknown>, key: string | null) {
  onlyFields(body, BATCH_FIELDS);
  requireScope(client, 'vouchers:issue');
  const campaignId = requireCampaign(client, body.campaignId);
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new RuleError('A batch is 1 to 10,000 codes.', 'bad_input', 400);
  const expiresAt = expiryFrom(body, await campaignEnd(campaignId));
  return replayOrRun(client, key, body, async () => {
    await checkQuota(client, quantity);
    const open = await poolFor(campaignId);
    const batch = await createBatch(open.id, { quantity, expiresAt }, partnerKey(client.id, key!), client.id);
    return { status: batch.status === 'completed' ? 201 : 202, body: { batch: batchView(await batchRow(batch.id)) } };
  });
}

/** A batch's status. While it is queued or running, each poll makes a few more chunks, so polling finishes the work. */
export async function batchStatus(client: PartnerClient, batchId: string) {
  requireScope(client, 'vouchers:read');
  const row = await ownBatch(client, batchId);
  if (row.status === 'queued' || row.status === 'running') {
    const view = await runBatch(batchId, 4);
    return { batch: view };
  }
  return { batch: batchView(row) };
}

async function ownBatch(client: PartnerClient, batchId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) throw new RuleError('Batch not found.', 'not_found', 404);
  const { rows } = await pool.query(`select * from voucher_batches where id = $1 and partner_client_id = $2`, [batchId, client.id]);
  if (!rows[0]) throw new RuleError('Batch not found.', 'not_found', 404);
  return rows[0];
}

/** The codes made so far for a batch, a page at a time. Every page is recorded as an export. */
export async function batchCodes(client: PartnerClient, batchId: string, after: string | null) {
  requireScope(client, 'codes:export');
  await ownBatch(client, batchId);
  const { rows } = await pool.query(
    `select v.id, v.code_hash, v.code_ciphertext, v.expires_at, v.status, o.offer_type, o.value_int, o.min_subtotal_minor, r.currency_code as currency
     from vouchers v join offers o on o.id = v.offer_id join restaurant r on r.id = $3
     where v.batch_id = $1 and ($2::uuid is null or v.id > $2) order by v.id limit 501`,
    [batchId, after, RESTAURANT_ID],
  );
  const more = rows.length > 500;
  const page = rows.slice(0, 500).map((r) => ({
    voucherId: r.id as string,
    code: codeOf(r),
    status: r.status as string,
    expiresAt: new Date(r.expires_at).toISOString(),
  }));
  if (page.length) {
    await pool.query(
      `insert into voucher_print_jobs (pool_id, batch_id, kind, format, voucher_count, requested_by)
       select pool_id, $1, 'export', 'csv', $2, $3 from voucher_batches where id = $1`,
      [batchId, page.length, `partner:${client.name}`],
    );
  }
  return { codes: page, nextAfter: more ? page[page.length - 1].voucherId : null };
}

/** Checks a code without using it, for codes in the partner's own campaigns. Same answer for unknown and not allowed. */
export async function validateCode(client: PartnerClient, raw: unknown) {
  requireScope(client, 'vouchers:validate');
  let code: string;
  try {
    code = normaliseCode(raw);
  } catch {
    return { valid: false };
  }
  const { rows } = await pool.query(
    `select v.status, v.expires_at, o.offer_type, o.value_int, o.min_subtotal_minor, r.currency_code as currency, p.campaign_id
     from vouchers v join offers o on o.id = v.offer_id join voucher_pools p on p.id = v.pool_id join restaurant r on r.id = $2
     where v.code_hash = $1`,
    [codeHash(code), RESTAURANT_ID],
  );
  const r = rows[0];
  if (!r || !client.campaignIds.includes(r.campaign_id)) return { valid: false };
  const state = r.status === 'redeemed' ? 'used' : r.status === 'revoked' ? 'unavailable' : new Date(r.expires_at) <= new Date() || r.status === 'expired' ? 'expired' : 'available';
  return { valid: state === 'available', state, expiresAt: new Date(r.expires_at).toISOString(), benefit: benefitOf(r) };
}

/** The campaigns the partner may issue from, with their rules and dates. No budgets, no usage. */
export async function campaignsFor(client: PartnerClient) {
  requireScope(client, 'campaigns:read');
  const { rows } = await pool.query(
    `select c.id, c.name, c.status, c.starts_at, c.ends_at,
       coalesce((select json_agg(json_build_object('type', o.offer_type, 'value', o.value_int, 'minOrderMinor', o.min_subtotal_minor, 'appliesTo', o.applies_to, 'audience', o.audience, 'startsAt', o.starts_at, 'endsAt', o.ends_at) order by o.starts_at)
          from offers o where o.campaign_id = c.id), '[]') as rules
     from campaigns c where c.id = any($1::uuid[]) and c.restaurant_id = $2 order by c.starts_at`,
    [client.campaignIds, RESTAURANT_ID],
  );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    status: r.status as string,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    rules: r.rules,
  }));
}

export type PartnerResult = { status: number; body: unknown; replayed: boolean };

/** The status and body for an error, in the same shape as the rest of the API. */
export function errorResult(error: unknown): { status: number; body: unknown } {
  if (error instanceof RuleError) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  console.error(error);
  return { status: 500, body: { error: { code: 'internal', message: 'Something went wrong.' } } };
}

/**
 * Runs one partner call: authenticates, checks the rate limit, runs the handler, and logs the answer. Errors come back
 * in the standard shape. The log is written whatever the answer is. The route turns the result into a response.
 */
export async function runPartnerCall(method: string, url: string, key: string | null, run: (client: PartnerClient) => Promise<{ status: number; body: unknown; replayed?: boolean }>): Promise<PartnerResult> {
  let clientId: string | null = null;
  let result: PartnerResult;
  try {
    const client = await authenticate(key);
    clientId = client.id;
    await checkRate(client);
    const out = await run(client);
    result = { status: out.status, body: out.body, replayed: out.replayed === true };
  } catch (error) {
    result = { ...errorResult(error), replayed: false };
  }
  await pool
    .query(`insert into partner_api_audit (client_id, method, path, status) values ($1,$2,$3,$4)`, [clientId, method, new URL(url).pathname, result.status])
    .catch(() => undefined);
  return result;
}
