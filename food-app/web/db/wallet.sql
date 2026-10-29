-- Phase 5: the customer wallet. Saving a voucher does not use it. Failed attempts to save a code are counted per
-- account, so a code cannot be guessed by trying many. Safe to re-run.
create table if not exists voucher_save_attempts (
  id bigint generated always as identity primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists voucher_save_attempts_recent on voucher_save_attempts (account_id, created_at);
alter table voucher_save_attempts enable row level security;
