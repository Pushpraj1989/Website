-- Retail mode: the same system for a shop (apparel, beauty, supplements...) as for a restaurant. Safe to re-run.

-- Restaurant or shop. It changes the words customers and staff see (menu/dishes or shop/products) and turns on
-- variants and stock in the console. Nothing else about ordering changes.
alter table restaurant add column if not exists business_type text not null default 'restaurant';
do $$ begin
  alter table restaurant add constraint restaurant_business_type check (business_type in ('restaurant', 'shop'));
exception when duplicate_object then null; end $$;

-- Stock for a product without variants: null means not counted (always available while switched on);
-- a number is how many are left, and the product shows as sold out at zero.
alter table menu_items add column if not exists stock int;
do $$ begin
  alter table menu_items add constraint menu_items_stock_not_negative check (stock is null or stock >= 0);
exception when duplicate_object then null; end $$;

-- Variants: one product in several versions (size, colour, shade, flavour), each with its own price and stock.
-- A product with active variants is ordered by variant; its own price is shown as "from" the lowest one.
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  name_en text not null check (length(name_en) between 1 and 60),
  name_ar text not null check (length(name_ar) between 1 and 60),
  sku text not null default '' check (length(sku) <= 40),
  price_minor int not null check (price_minor >= 0),
  stock int check (stock is null or stock >= 0),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists product_variants_item on product_variants (item_id, position);

-- Each order line remembers which variant was bought; the name it was sold under is kept in the line's name.
alter table order_lines add column if not exists variant_id uuid references product_variants(id) on delete set null;

-- Staff manage these through the API with the service role, as for products.
alter table product_variants enable row level security;
