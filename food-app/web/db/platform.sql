-- Platform tables: AI settings, multiple product pictures and videos, promotions, and an AI usage log.
-- The AI log stores counts and categories, never the text of a customer's message.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Media gets a MIME type and, for video, a duration. Kind already allows 'video'.
alter table media add column if not exists mime text;
alter table media add column if not exists duration_ms int check (duration_ms is null or duration_ms >= 0);

-- A product has many pictures and videos, in an order the admin chooses. One is primary (the cover).
create table if not exists product_media (
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  position int not null default 0 check (position >= 0),
  is_primary boolean not null default false,
  primary key (menu_item_id, media_id)
);
create index if not exists product_media_order on product_media (menu_item_id, position);
-- At most one primary picture per product.
create unique index if not exists product_media_one_primary on product_media (menu_item_id) where is_primary;

-- Promotions put a picture or video in a place on the customer app.
--   hero:               the top of the home screen
--   mid_feed:           between sections of the home screen
--   product_background: plays behind a product's page when the customer opens the product
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('hero','mid_feed','product_background')),
  menu_item_id uuid references menu_items(id) on delete cascade,
  media_id uuid not null references media(id) on delete restrict,
  title_en text not null default '' check (length(title_en) <= 120),
  title_ar text not null default '' check (length(title_ar) <= 120),
  cta_en text not null default '' check (length(cta_en) <= 40),
  cta_ar text not null default '' check (length(cta_ar) <= 40),
  position int not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  check (ends_at > starts_at),
  check (placement <> 'product_background' or menu_item_id is not null)
);
create index if not exists promotions_live on promotions (placement, active, starts_at, ends_at);

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner_kind text not null check (owner_kind in ('guest','account')),
  provider text not null,
  model text not null,
  intent text not null,
  refused boolean not null default false,
  input_chars int not null default 0,
  output_chars int not null default 0
);
create index if not exists ai_usage_time on ai_usage (created_at);

alter table app_settings enable row level security;
alter table product_media enable row level security;
alter table promotions enable row level security;
alter table ai_usage enable row level security;

-- ---------- saved addresses ----------
-- A customer's saved addresses are saved = true. Each order keeps its own copy with saved = false, so editing or
-- deleting a saved address never changes an earlier order. At most one saved address is the default per owner.
alter table addresses add column if not exists is_default boolean not null default false;
alter table addresses add column if not exists saved boolean not null default true;
create unique index if not exists addresses_default_per_guest on addresses (guest_session_id) where is_default;
create unique index if not exists addresses_default_per_customer on addresses (customer_id) where is_default;
create index if not exists addresses_saved_per_guest on addresses (guest_session_id) where saved;

-- ---------- favourites ----------
-- Dishes a guest saved from the home screen. Server-only access, like the other platform tables.
create table if not exists favourites (
  guest_session_id uuid not null references guest_sessions(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guest_session_id, menu_item_id)
);
alter table favourites enable row level security;

-- ---------- membership ----------
-- A paid plan with its benefits. Plans and benefits are data, edited in the admin. A plan stays inactive until its
-- price is confirmed; the app shows the benefits but does not offer to buy an inactive plan.
create table if not exists membership_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  price_minor int not null default 0 check (price_minor >= 0),
  currency char(3) not null default 'AED',
  period text not null default 'year' check (period in ('month', 'year')),
  active boolean not null default false,
  position int not null default 0
);
create table if not exists membership_benefits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references membership_plans(id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  summary_en text not null default '',
  summary_ar text not null default '',
  icon text not null default 'star',                  -- a key the app maps to its icon set
  accent text not null default 'lilac',               -- a key the app maps to its colour tokens
  points jsonb not null default '[]',                 -- [{"en": "...", "ar": "..."}]
  active boolean not null default true,
  position int not null default 0
);
create table if not exists memberships (
  guest_session_id uuid not null references guest_sessions(id) on delete cascade,
  plan_id uuid not null references membership_plans(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  started_at timestamptz not null default now(),
  primary key (guest_session_id, plan_id)
);
alter table membership_plans enable row level security;
alter table membership_benefits enable row level security;
alter table memberships enable row level security;

insert into membership_plans (id, code, name_en, name_ar, price_minor, currency, period, active, position)
values ('00000000-0000-4000-8000-000000000701', 'solo', 'Solo', 'الفردية', 0, 'AED', 'year', false, 1)
on conflict (id) do nothing;

insert into membership_benefits (id, plan_id, title_en, title_ar, summary_en, summary_ar, icon, accent, points, position) values
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000701',
   'Free delivery', 'توصيل مجاني', 'No delivery fee on your member orders.', 'لا رسوم توصيل على طلباتك كعضو.', 'delivery', 'lilac',
   '[{"en":"No delivery fee on orders from any served area","ar":"بدون رسوم توصيل على الطلبات من أي منطقة نخدمها"},{"en":"Applies to every order you place while the plan is active","ar":"ينطبق على كل طلب تقدمه ما دامت العضوية فعالة"}]', 1),
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-000000000701',
   'Member deals', 'عروض الأعضاء', 'Offers that only members can use.', 'عروض يستخدمها الأعضاء فقط.', 'tag', 'peach',
   '[{"en":"Limited-time offers made for members","ar":"عروض محدودة المدة مخصصة للأعضاء"},{"en":"Extra discount on selected dishes","ar":"خصم إضافي على أطباق مختارة"}]', 2),
  ('00000000-0000-4000-8000-000000000713', '00000000-0000-4000-8000-000000000701',
   'Member days', 'أيام الأعضاء', 'Bigger savings on selected days.', 'وفورات أكبر في أيام مختارة.', 'calendar', 'mint',
   '[{"en":"Bigger discounts on the days we announce","ar":"خصومات أكبر في الأيام التي نعلن عنها"},{"en":"New member offers each time a day is announced","ar":"عروض جديدة للأعضاء مع كل إعلان"}]', 3)
on conflict (id) do nothing;
