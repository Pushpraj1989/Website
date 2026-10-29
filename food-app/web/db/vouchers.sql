-- Campaigns, voucher pools, unique vouchers, batches, the customer wallet, reservations and a ledger.
-- Phase 1 of the promotions brief. Discount rules are the existing `offers` rows: a voucher points at one offer,
-- and a redemption is recorded in the existing `offer_redemptions` table. Nothing here changes a price yet.
-- Money is integer minor units. Codes are stored as keyed hashes (HMAC, computed by the app), never in plain text.
-- Safe to re-run.

-- ---------- campaigns ----------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','completed','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Dubai',
  budget_minor int check (budget_minor is null or budget_minor >= 0),
  funding_source text not null default 'restaurant' check (funding_source in ('platform','restaurant','shared')),
  max_issuance int check (max_issuance is null or max_issuance > 0),
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists campaigns_restaurant_status on campaigns (restaurant_id, status);

-- An offer belongs to a campaign when it is part of one. Existing offers keep working without a campaign.
alter table offers add column if not exists campaign_id uuid references campaigns(id) on delete restrict;

-- ---------- voucher pools and vouchers ----------
create table if not exists voucher_pools (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  offer_id uuid not null references offers(id) on delete restrict,
  code_pattern text not null check (length(code_pattern) between 4 and 40),
  quantity_limit int check (quantity_limit is null or quantity_limit > 0),
  issued_count int not null default 0 check (issued_count >= 0),
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  check (quantity_limit is null or issued_count <= quantity_limit)
);
create index if not exists voucher_pools_campaign on voucher_pools (campaign_id);

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references voucher_pools(id) on delete restrict,
  offer_id uuid not null references offers(id) on delete restrict,
  code_hash text not null check (length(code_hash) = 64),          -- HMAC-SHA256 hex of the normalised code
  code_ciphertext text,                                           -- encrypted copy, only where printing or export needs it
  status text not null default 'available' check (status in ('available','reserved','redeemed','expired','revoked')),
  expires_at timestamptz not null,
  assigned_customer_id uuid references accounts(id) on delete set null,  -- set when a voucher is bound to one customer
  template_version int check (template_version is null or template_version > 0),
  version int not null default 1 check (version > 0),              -- optimistic lock for admin edits
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((status = 'revoked') = (revoked_at is not null))   -- a revoked voucher has a time, and only a revoked voucher has one
);
create unique index if not exists vouchers_code_hash_key on vouchers (code_hash);
create index if not exists vouchers_pool_status on vouchers (pool_id, status);
create index if not exists vouchers_expiry on vouchers (expires_at) where status in ('available','reserved');

-- ---------- batches (bulk generation) ----------
create table if not exists voucher_batches (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references voucher_pools(id) on delete restrict,
  requested_quantity int not null check (requested_quantity between 1 and 10000),
  generated_quantity int not null default 0,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 80),
  error_details text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (generated_quantity between 0 and requested_quantity)
);

-- ---------- customer wallet ----------
-- Saving a voucher does not consume it. Removing one keeps the row with removed_at, so history is kept.
create table if not exists voucher_wallet (
  customer_id uuid not null references accounts(id) on delete cascade,
  voucher_id uuid not null references vouchers(id) on delete cascade,
  saved_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (customer_id, voucher_id)
);
create index if not exists voucher_wallet_active on voucher_wallet (customer_id) where removed_at is null;

-- ---------- reservations ----------
-- A voucher is held while a checkout is pending. At most one hold per voucher at a time.
create table if not exists voucher_reservations (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references vouchers(id) on delete cascade,
  customer_id uuid references accounts(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  status text not null default 'held' check (status in ('held','consumed','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (status <> 'consumed' or order_id is not null)
);
create unique index if not exists voucher_reservations_one_hold on voucher_reservations (voucher_id) where status = 'held';
create index if not exists voucher_reservations_expiry on voucher_reservations (expires_at) where status = 'held';

-- A redemption is recorded in the existing offer_redemptions table. A voucher can be redeemed once.
alter table offer_redemptions add column if not exists voucher_id uuid references vouchers(id) on delete restrict;
create unique index if not exists offer_redemptions_one_per_voucher on offer_redemptions (voucher_id) where voucher_id is not null;

-- ---------- ledger (append-only) ----------
create table if not exists voucher_ledger (
  id bigint generated always as identity primary key,
  voucher_id uuid not null references vouchers(id) on delete restrict,
  event text not null check (event in ('issued','saved','removed','reserved','released','redeemed','reversed','revoked','expired')),
  customer_id uuid references accounts(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  amount_minor int check (amount_minor is null or amount_minor >= 0),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists voucher_ledger_voucher on voucher_ledger (voucher_id, id);

create or replace function voucher_ledger_is_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'voucher_ledger is append-only';
end $$;
drop trigger if exists voucher_ledger_no_change on voucher_ledger;
create trigger voucher_ledger_no_change before update or delete on voucher_ledger
  for each row execute function voucher_ledger_is_append_only();

-- Staff and customer tables are protected by row-level security the same way as the rest of the platform.
alter table campaigns enable row level security;
alter table voucher_pools enable row level security;
alter table vouchers enable row level security;
alter table voucher_batches enable row level security;
alter table voucher_wallet enable row level security;
alter table voucher_reservations enable row level security;
alter table voucher_ledger enable row level security;
