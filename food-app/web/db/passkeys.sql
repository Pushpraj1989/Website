-- Passkeys: sign-in with Face ID, Touch ID or a phone's screen lock in the browser (WebAuthn). The private key never
-- leaves the customer's device; only its public key is kept. Safe to re-run.
create table if not exists passkeys (
  id text primary key,                                  -- the credential id, base64url
  account_id uuid not null references accounts(id) on delete cascade,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_account on passkeys (account_id);

-- One challenge per ceremony, used once and only for a few minutes.
create table if not exists passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('register', 'login')),
  account_id uuid references accounts(id) on delete cascade,
  challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists passkey_challenges_expiry on passkey_challenges (expires_at);
