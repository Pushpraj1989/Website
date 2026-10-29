-- App accounts for sign-up and sign-in by phone one-time code, then email. Separate from `customers`, which
-- links to Supabase Auth; see README "Decisions" for why both exist until the auth provider is chosen.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz not null default now(),
  email text unique check (email is null or length(email) <= 254),
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- A code is stored as an HMAC, never in plain text. Attempts and expiry are enforced on every check.
create table if not exists otp_challenges (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signup_phone','login_phone','verify_email')),
  target text not null,                          -- the phone number or the email address
  account_id uuid references accounts(id) on delete cascade,
  name text,                                     -- signup only: the name typed before the phone was checked
  code_hash text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists otp_challenges_target on otp_challenges (target, purpose, created_at desc);

-- Session tokens are random; only their hash is stored.
create table if not exists sessions (
  token_hash text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index if not exists sessions_account on sessions (account_id);

-- The server reads and writes these tables as the owner. No client policy exists, so a client key sees nothing.
alter table accounts enable row level security;
alter table otp_challenges enable row level security;
alter table sessions enable row level security;
