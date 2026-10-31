-- Retail mode, phase 2: courier shipping anywhere, not only inside the delivery areas drawn on the map. Safe to re-run.

-- A third way to receive an order: 'shipping' (by courier), beside 'delivery' (own riders, inside the areas) and
-- 'pickup'. A shipped order also has a step of its own, 'shipped', between ready and delivered.
alter table orders drop constraint if exists orders_channel_check;
alter table orders add constraint orders_channel_check check (channel in ('delivery', 'pickup', 'shipping'));
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in (
  'placed', 'awaiting_payment', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'shipped',
  'delivered', 'collected', 'cancelled', 'rejected'));

-- Shipping rates the business offers: a name ("Standard, 2-4 days"), a price, and optionally free above an amount.
create table if not exists shipping_rates (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (length(name_en) between 1 and 60),
  name_ar text not null check (length(name_ar) between 1 and 60),
  eta_en text not null default '' check (length(eta_en) <= 60),
  eta_ar text not null default '' check (length(eta_ar) <= 60),
  price_minor int not null check (price_minor >= 0),
  free_over_minor int check (free_over_minor is null or free_over_minor > 0),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table shipping_rates enable row level security;

-- The rate an order was shipped at, and the parcel's tracking once it is handed to the courier.
alter table orders add column if not exists shipping_rate_id uuid references shipping_rates(id) on delete set null;
alter table orders add column if not exists shipping_rate_name text not null default '';
alter table orders add column if not exists tracking_carrier text not null default '';
alter table orders add column if not exists tracking_number text not null default '';
alter table orders add column if not exists tracking_url text not null default '';

-- A shipping address has a city and a country instead of a delivery area on the map.
alter table addresses add column if not exists city text not null default '';
alter table addresses add column if not exists country text not null default '';
alter table addresses add column if not exists for_shipping boolean not null default false;
