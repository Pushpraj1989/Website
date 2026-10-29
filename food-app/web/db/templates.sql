-- Voucher templates (Phase 3 of the promotions brief). A template has one editable draft and immutable published
-- versions. A voucher keeps the version it was issued with, so changing a design later never changes old vouchers.
-- Safe to re-run.
create table if not exists voucher_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  draft jsonb not null,                       -- width_mm, height_mm, background_media_id, fields[]
  current_version int check (current_version is null or current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists voucher_templates_restaurant on voucher_templates (restaurant_id, status);

create table if not exists voucher_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references voucher_templates(id) on delete cascade,
  version int not null check (version > 0),
  layout jsonb not null,                      -- a copy of the draft at publish time; never changed
  published_at timestamptz not null default now(),
  unique (template_id, version)
);

create or replace function voucher_template_versions_are_fixed() returns trigger language plpgsql as $$
begin
  raise exception 'a published template version cannot be changed';
end $$;
drop trigger if exists voucher_template_versions_fixed on voucher_template_versions;
create trigger voucher_template_versions_fixed before update or delete on voucher_template_versions
  for each row execute function voucher_template_versions_are_fixed();

-- A pool can print with a template. Its vouchers record the template version they were issued with.
alter table voucher_pools add column if not exists template_id uuid references voucher_templates(id) on delete restrict;
alter table vouchers add column if not exists template_version_id uuid references voucher_template_versions(id) on delete restrict;

alter table voucher_templates enable row level security;
alter table voucher_template_versions enable row level security;
