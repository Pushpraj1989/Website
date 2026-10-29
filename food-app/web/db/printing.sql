-- Phase 4: batch links, resumable large batches, and an audit trail for every print and export.
-- Safe to re-run.
alter table vouchers add column if not exists batch_id uuid references voucher_batches(id) on delete restrict;
create index if not exists vouchers_batch on vouchers (batch_id) where batch_id is not null;

-- The expiry a batch's codes get, kept so a large batch can finish later with the same rules.
alter table voucher_batches add column if not exists expires_at timestamptz;

-- Every print and every export of redeemable codes is recorded: who, when, what, how many.
create table if not exists voucher_print_jobs (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references voucher_pools(id) on delete restrict,
  batch_id uuid references voucher_batches(id) on delete restrict,
  kind text not null check (kind in ('print','export')),
  format text not null check (format in ('a4','a5','card','csv')),
  voucher_count int not null check (voucher_count >= 0),
  requested_by text not null check (length(requested_by) between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists voucher_print_jobs_pool on voucher_print_jobs (pool_id, created_at);
alter table voucher_print_jobs enable row level security;
