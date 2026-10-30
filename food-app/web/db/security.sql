-- Failed staff sign-ins, so the shared staff password cannot be guessed at speed. Only failures are kept, with a hash
-- of where they came from; old rows are cleared as new ones arrive.
create table if not exists staff_login_failures (
  id bigserial primary key,
  source_hash text not null,
  at timestamptz not null default now()
);
create index if not exists staff_login_failures_source on staff_login_failures (source_hash, at desc);
create index if not exists staff_login_failures_at on staff_login_failures (at);
alter table staff_login_failures enable row level security;
