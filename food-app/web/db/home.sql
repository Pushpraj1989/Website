-- The customer home, managed from the admin. Promotions gain three places (an offers carousel, a welcome pop-up when
-- the app opens, and a slim offer strip) and the settings that decide how each one looks and arrives: entrance
-- animation, size, frame, colour, how long a slide stays and how often a pop-up shows. Carousel, welcome and strip
-- can run on colour and words alone, so a picture is required only where one fills the slot.
alter table promotions alter column media_id drop not null;
alter table promotions drop constraint if exists promotions_placement_check;
alter table promotions add constraint promotions_placement_check
  check (placement in ('hero','mid_feed','product_background','carousel','welcome','strip'));
do $$ begin
  alter table promotions add constraint promotions_media_needed
    check (media_id is not null or placement in ('carousel','welcome','strip'));
exception when duplicate_object then null; end $$;
alter table promotions add column if not exists kicker_en text not null default '' check (length(kicker_en) <= 40);
alter table promotions add column if not exists kicker_ar text not null default '' check (length(kicker_ar) <= 40);
alter table promotions add column if not exists body_en text not null default '' check (length(body_en) <= 200);
alter table promotions add column if not exists body_ar text not null default '' check (length(body_ar) <= 200);
alter table promotions add column if not exists offer_id uuid references offers(id) on delete set null;
alter table promotions add column if not exists animation text not null default 'slide_up'
  check (animation in ('slide_up','slide_down','slide_left','slide_right','zoom','fade'));
alter table promotions add column if not exists size text not null default 'standard'
  check (size in ('compact','standard','tall','full'));
alter table promotions add column if not exists frame text not null default 'rounded'
  check (frame in ('rounded','square','ticket','circle'));
alter table promotions add column if not exists colour text check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$');
alter table promotions add column if not exists duration_seconds int not null default 5 check (duration_seconds between 3 and 20);
alter table promotions add column if not exists frequency text not null default 'once_per_day'
  check (frequency in ('every_open','once_per_day','once'));

-- How buttons and icons look across the app and website, and when a dish starts showing its rating.
alter table restaurant add column if not exists button_style text not null default 'light'
  check (button_style in ('light','tonal','filled'));
alter table restaurant add column if not exists icon_style text not null default 'brand'
  check (icon_style in ('brand','neutral'));
alter table restaurant add column if not exists rating_min_count int not null default 5 check (rating_min_count between 1 and 1000);

-- A customer rates a delivered or collected order once (they may change it). Each dish's score is the average of the
-- ratings of the orders it was in.
create table if not exists order_ratings (
  order_id uuid primary key references orders(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text not null default '' check (length(comment) <= 300),
  rated_at timestamptz not null default now()
);
alter table order_ratings enable row level security;
