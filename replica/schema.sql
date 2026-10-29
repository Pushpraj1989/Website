-- Food ordering for ONE restaurant (EN and AR). Postgres 15+ (Supabase).
-- Money: integer count of the currency's smallest unit (its decimal digits come from the currencies table),
-- plus a currency code. Never floats. Currency is data, not code: AED is the first pack, others are added as rows.
-- Times: timestamptz, stored in UTC. Restaurant local time (restaurant.timezone) is applied in the app.

create extension if not exists pgcrypto;

-- ---------- currencies and country packs (configuration, not code) ----------

-- ISO 4217 currencies. minor_digits is the number of decimal places the currency uses
-- (AED 2, SAR 2, OMR 3, KWD 3, BHD 3). Money is stored as an integer count of the smallest unit,
-- and the digits come from this table, so adding a currency is a data change.
create table currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name_en text not null,
  name_ar text not null,
  minor_digits smallint not null check (minor_digits between 0 and 3),
  active boolean not null default true
);

insert into currencies (code, name_en, name_ar, minor_digits) values
  ('AED', 'UAE dirham', 'درهم إماراتي', 2),
  ('SAR', 'Saudi riyal', 'ريال سعودي', 2),
  ('QAR', 'Qatari riyal', 'ريال قطري', 2),
  ('OMR', 'Omani rial', 'ريال عماني', 3),
  ('BHD', 'Bahraini dinar', 'دينار بحريني', 3),
  ('KWD', 'Kuwaiti dinar', 'دينار كويتي', 3),
  ('USD', 'US dollar', 'دولار أمريكي', 2),
  ('EUR', 'Euro', 'يورو', 2),
  ('GBP', 'Pound sterling', 'جنيه إسترليني', 2),
  ('INR', 'Indian rupee', 'روبية هندية', 2);

-- A country pack: everything that differs by country, set once per market.
-- The first pack is the UAE (AED, Asia/Dubai, +971). Other countries are added as rows.
create table countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),          -- ISO 3166-1 alpha-2
  name_en text not null,
  name_ar text not null,
  currency_code char(3) not null references currencies(code),
  timezone text not null,                                         -- IANA name, e.g. Asia/Dubai
  phone_code text not null check (phone_code ~ '^\+[0-9]{1,4}$'),
  tax_label text not null,                                        -- e.g. VAT
  tax_basis_points int not null check (tax_basis_points between 0 and 3000),  -- rate as basis points: 500 = 5%
  card_networks text[] not null default '{}',                     -- informational; the gateway decides
  active boolean not null default true
);

insert into countries (code, name_en, name_ar, currency_code, timezone, phone_code, tax_label, tax_basis_points) values
  ('AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'AED', 'Asia/Dubai', '+971', 'VAT', 500);
-- The rate is the public VAT rate for the UAE at the time of writing. Confirm it with the client's accountant
-- before launch. Other countries (OM, SA, QA, BH, KW) are added as packs with their own confirmed rates.

-- ---------- restaurant and settings ----------

create table restaurant (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  phone text not null,
  address_en text not null default '',
  address_ar text not null default '',
  country_code char(2) not null references countries(code),
  currency_code char(3) not null references currencies(code),    -- normally the country's currency; a restaurant may differ
  timezone text not null,                                         -- IANA name, copied from the country pack and editable
  tax_label text not null,
  tax_basis_points int not null check (tax_basis_points between 0 and 3000),
  prices_include_tax boolean not null default true,
  min_order_minor int not null default 0 check (min_order_minor >= 0),
  cash_limit_minor int not null default 0 check (cash_limit_minor >= 0),
  service_fee_minor int not null default 0 check (service_fee_minor >= 0),
  accepts_card boolean not null default true,
  accepts_cod boolean not null default true,
  accepts_pay_on_arrival boolean not null default true,
  updated_at timestamptz not null default now()
);

create table opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_local time not null,       -- in restaurant.timezone
  closes_local time not null,
  check (closes_local > opens_local)
);
create index on opening_hours (restaurant_id, weekday);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  on_date date not null,
  note_en text not null default '',
  note_ar text not null default '',
  unique (restaurant_id, on_date)
);

create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  polygon geography(polygon, 4326) not null,   -- PostGIS; check the Supabase extension is on
  fee_minor int not null default 0 check (fee_minor >= 0),
  min_order_minor int not null default 0 check (min_order_minor >= 0),
  active boolean not null default true
);
create index on delivery_zones using gist (polygon);

-- ---------- media ----------

create table media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image','video')),
  storage_key text not null unique,
  alt_en text not null default '',
  alt_ar text not null default '',
  width int, height int,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

-- ---------- menu ----------

create table categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  image_id uuid references media(id) on delete set null,
  sort_order int not null default 0,
  active boolean not null default true
);
create index on categories (restaurant_id, sort_order);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  name_en text not null,
  name_ar text not null,
  description_en text not null default '',
  description_ar text not null default '',
  base_price_minor int not null check (base_price_minor >= 0),
  image_id uuid references media(id) on delete set null,
  available boolean not null default true,
  sort_order int not null default 0,
  dietary_flags text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index on menu_items (category_id, sort_order);

create table option_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select >= 1),
  check (max_select >= min_select)
);
create index on option_groups (item_id);

create table option_choices (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references option_groups(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  price_delta_minor int not null default 0,
  available boolean not null default true,
  sort_order int not null default 0
);
create index on option_choices (group_id);

-- ---------- offers and rules ----------

create table offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurant(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  offer_type text not null check (offer_type in ('percent','fixed','free_delivery','item_free','bundle')),
  value_int int not null default 0 check (value_int >= 0),         -- percent in basis points, or minor units
  applies_to text not null default 'order' check (applies_to in ('order','category','item')),
  applies_to_ids uuid[] not null default '{}',
  audience text not null default 'any' check (audience in ('guest','member','any')),
  min_subtotal_minor int not null default 0 check (min_subtotal_minor >= 0),
  code text unique,                                                -- null = automatic
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  usage_limit int check (usage_limit is null or usage_limit >= 0),
  used_count int not null default 0,
  per_customer_limit int check (per_customer_limit is null or per_customer_limit >= 1),
  max_discount_minor int check (max_discount_minor is null or max_discount_minor >= 0),  -- voucher cap, e.g. 3 OMR off at most
  stackable boolean not null default false,
  priority int not null default 100,
  active boolean not null default true,
  created_by uuid,
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (usage_limit is null or used_count <= usage_limit),
  check (offer_type <> 'percent' or value_int <= 10000)
);
create index on offers (restaurant_id, active, starts_at, ends_at);

-- Redemptions are written in the same transaction as the order. The counter is incremented with
-- "update offers set used_count = used_count + 1 where id = $1 and (usage_limit is null or used_count < usage_limit)"
-- and the order is refused if no row changes. This is the fix for two customers taking the last use.
create table offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete restrict,
  order_id uuid not null,               -- FK added after orders is created (below)
  customer_id uuid,                     -- null for guests
  guest_key text,                       -- anonymous key for a guest, for per-customer limits
  amount_minor int not null check (amount_minor >= 0),
  redeemed_at timestamptz not null default now(),
  check (customer_id is not null or guest_key is not null)
);
create index on offer_redemptions (offer_id, customer_id);
create index on offer_redemptions (offer_id, guest_key);

-- ---------- customers and addresses ----------

create table customers (
  id uuid primary key references auth.users(id) on delete cascade,  -- Supabase Auth (phone OTP)
  name text not null default '',
  email text,
  locale text not null default 'en' check (locale in ('en','ar')),
  marketing_consent boolean not null default false,
  consent_version text,
  consent_at timestamptz,
  deleted_at timestamptz,               -- soft delete for GDPR-style requests; purged by a job
  created_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text not null default 'home',
  line_1 text not null,
  line_2 text not null default '',
  location geography(point, 4326),
  zone_id uuid references delivery_zones(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index on addresses (customer_id);

-- A guest is a customer row with no login: id is a random uuid, not an auth user. Guests keep a
-- cart and their orders through a guest token kept on the device.
create table guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  guest_session_id uuid references guest_sessions(id) on delete cascade,
  items jsonb not null default '[]',
  promo_code text,
  updated_at timestamptz not null default now(),
  check (customer_id is not null or guest_session_id is not null)
);
create unique index on carts (customer_id) where customer_id is not null;
create unique index on carts (guest_session_id) where guest_session_id is not null;

-- ---------- orders ----------

create table orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                 -- human readable, from a sequence, e.g. R-20261029-0001
  restaurant_id uuid not null references restaurant(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  channel text not null check (channel in ('delivery','pickup')),
  status text not null default 'placed' check (status in (
    'placed','awaiting_payment','accepted','preparing','ready','out_for_delivery',
    'delivered','collected','cancelled','rejected')),
  address_id uuid references addresses(id) on delete set null,
  zone_id uuid references delivery_zones(id) on delete set null,
  scheduled_for timestamptz,
  locale text not null check (locale in ('en','ar')),
  subtotal_minor int not null check (subtotal_minor >= 0),
  discount_minor int not null default 0 check (discount_minor >= 0),
  delivery_fee_minor int not null default 0 check (delivery_fee_minor >= 0),
  delivery_option text not null default 'standard' check (delivery_option in ('standard','direct')),
  service_fee_minor int not null default 0 check (service_fee_minor >= 0),
  tip_minor int not null default 0 check (tip_minor >= 0),
  vat_minor int not null default 0 check (vat_minor >= 0),
  total_minor int not null check (total_minor >= 0),
  currency char(3) not null references currencies(code),
  payment_method text not null check (payment_method in ('card','wallet','cod','pay_on_arrival')),
  payment_status text not null default 'pending' check (payment_status in (
    'pending','authorised','captured','failed','refunded','partly_refunded','not_required')),
  note text not null default '',
  idempotency_key text not null,
  placed_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  cancel_reason text,
  unique (customer_id, idempotency_key),
  unique (guest_session_id, idempotency_key),
  check (customer_id is not null or guest_session_id is not null),
  check (total_minor = subtotal_minor - discount_minor + delivery_fee_minor + service_fee_minor + tip_minor),
  check (channel = 'pickup' or address_id is not null)
);
create index on orders (restaurant_id, status, placed_at);
create index on orders (customer_id, placed_at desc);
create index on orders (guest_session_id);

alter table offer_redemptions add constraint offer_redemptions_order_fk
  foreign key (order_id) references orders(id) on delete cascade;

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name_en text not null,                      -- snapshot at the time of the order
  name_ar text not null,
  unit_price_minor int not null check (unit_price_minor >= 0),
  options_minor int not null default 0,
  qty int not null check (qty between 1 and 50),
  line_total_minor int not null check (line_total_minor >= 0),
  options jsonb not null default '[]',
  note text not null default ''
);
create index on order_lines (order_id);

create table order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  actor_kind text not null check (actor_kind in ('system','staff','customer','gateway')),
  actor_id uuid,
  at timestamptz not null default now()
);
create index on order_status_events (order_id, at);

-- ---------- payments ----------

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  provider text not null,
  provider_ref text not null,
  amount_minor int not null check (amount_minor > 0),
  currency char(3) not null references currencies(code),
  status text not null check (status in ('pending','authorised','captured','failed','cancelled')),
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index on payments (order_id);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete restrict,
  order_id uuid not null references orders(id) on delete restrict,
  amount_minor int not null check (amount_minor > 0),
  reason text not null,
  status text not null default 'requested' check (status in ('requested','succeeded','failed')),
  provider_ref text,
  created_at timestamptz not null default now()
);

-- Every webhook is stored once, before it is processed. The unique key makes a repeat harmless.
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

-- Points are a ledger: earned by orders, spent on vouchers. The balance is a sum, never a stored value.
create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  points int not null check (points <> 0),
  reason text not null check (reason in ('order','voucher','adjustment','expiry')),
  created_at timestamptz not null default now()
);
create index on points_ledger (customer_id, created_at);

-- ---------- staff and audit ----------

create table staff (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('owner','manager','cashier','kitchen')),
  mfa_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index on audit_log (entity, entity_id);
create index on audit_log (at);

-- ---------- order numbers ----------

create sequence order_number_seq start 1;

-- ---------- access rules (Supabase RLS) ----------
-- Customers read and write only their own rows (addresses, carts, orders, customers).
-- Guests have no auth user: they reach their cart and orders only through the API with the guest token
-- (no direct table access from the client).
-- Menu, offers and settings: public read of active rows only; write only for staff with role owner or manager.
-- Orders: staff with role owner, manager, cashier or kitchen can read the restaurant's orders; status changes
-- go through an API function that checks the role and writes status_events.
-- Payments, refunds and payment_events: no client access at all (server only, service role).
-- Audit log: append by the server; read by owner only.

alter table customers enable row level security;
alter table addresses enable row level security;
alter table carts enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table payments enable row level security;
alter table refunds enable row level security;
alter table payment_events enable row level security;
alter table staff enable row level security;
alter table audit_log enable row level security;

create policy customer_own_profile on customers for select using (id = auth.uid());
create policy customer_update_profile on customers for update using (id = auth.uid());
create policy customer_own_addresses on addresses for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy customer_own_cart on carts for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy customer_own_orders on orders for select using (customer_id = auth.uid());
create policy customer_own_order_lines on order_lines for select using (
  exists (select 1 from orders o where o.id = order_lines.order_id and o.customer_id = auth.uid()));
create policy staff_read_orders on orders for select using (
  exists (select 1 from staff s where s.id = auth.uid() and s.active));
create policy staff_read_order_lines on order_lines for select using (
  exists (select 1 from staff s where s.id = auth.uid() and s.active));
create policy staff_only_self on staff for select using (id = auth.uid());
-- No policies on payments, refunds, payment_events, audit_log: only the service role reaches them.

-- Menu tables: public read of active rows, staff write (owner or manager).
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table offers enable row level security;
create policy public_read_active_categories on categories for select using (active);
create policy public_read_available_items on menu_items for select using (available);
create policy public_read_live_offers on offers for select using (active and now() between starts_at and ends_at and audience in ('any','member','guest'));
create policy manager_write_categories on categories for all using (
  exists (select 1 from staff s where s.id = auth.uid() and s.role in ('owner','manager')));
create policy manager_write_items on menu_items for all using (
  exists (select 1 from staff s where s.id = auth.uid() and s.role in ('owner','manager')));
create policy manager_write_offers on offers for all using (
  exists (select 1 from staff s where s.id = auth.uid() and s.role in ('owner','manager')));
