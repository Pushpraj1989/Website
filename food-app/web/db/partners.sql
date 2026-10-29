-- Phase 7: partner integrations. A partner client holds a secret that is stored only as a keyed hash, a set of scopes,
-- a list of campaigns it may issue from, quotas, and a log of every request. Safe to re-run.
create table if not exists partner_clients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  status text not null default 'active' check (status in ('active','revoked')),
  scopes text[] not null default '{}',
  daily_issue_limit int not null default 1000 check (daily_issue_limit >= 0),
  requests_per_minute int not null default 60 check (requests_per_minute > 0),
  secret_hash text not null check (length(secret_hash) = 64),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((status = 'revoked') = (revoked_at is not null))
);

-- The campaigns a partner may issue from, and nothing else.
create table if not exists partner_client_campaigns (
  client_id uuid not null references partner_clients(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  primary key (client_id, campaign_id)
);

-- Every voucher a partner caused to be issued, for their own reconciliation and for the daily quota.
create table if not exists partner_issuances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references partner_clients(id) on delete restrict,
  voucher_id uuid references vouchers(id) on delete restrict,
  batch_id uuid references voucher_batches(id) on delete restrict,
  external_reference text check (external_reference is null or length(external_reference) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists partner_issuances_client_day on partner_issuances (client_id, created_at);

-- Replayed requests return the first response. The same key with a different request is refused.
create table if not exists partner_idempotency (
  client_id uuid not null references partner_clients(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 8 and 120),
  request_hash text not null check (length(request_hash) = 64),
  response_status int not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (client_id, idempotency_key)
);

-- One line per partner request: who, what, the answer, and when. Used for the per-minute limit too.
create table if not exists partner_api_audit (
  id bigint generated always as identity primary key,
  client_id uuid references partner_clients(id) on delete set null,
  method text not null,
  path text not null,
  status int not null,
  created_at timestamptz not null default now()
);
create index if not exists partner_api_audit_client_time on partner_api_audit (client_id, created_at);

alter table partner_clients enable row level security;
alter table partner_client_campaigns enable row level security;
alter table partner_issuances enable row level security;
alter table partner_idempotency enable row level security;
alter table partner_api_audit enable row level security;

-- Batches a partner asked for. The daily quota counts the codes requested, so it covers single and bulk requests alike.
alter table voucher_batches add column if not exists partner_client_id uuid references partner_clients(id) on delete restrict;
create index if not exists voucher_batches_partner_day on voucher_batches (partner_client_id, created_at);
