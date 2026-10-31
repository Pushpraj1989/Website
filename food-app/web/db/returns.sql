-- Retail mode, phase 3: returns. A customer asks to return items from a delivered order within the shop's window;
-- staff approve (with the refund and, optionally, putting the stock back) or reject. Safe to re-run.

-- How many days after delivery a customer can ask for a return. 0 = no returns. Only shops offer returns.
alter table restaurant add column if not exists return_days int not null default 14;
do $$ begin
  alter table restaurant add constraint restaurant_return_days check (return_days between 0 and 365);
exception when duplicate_object then null; end $$;

create table if not exists order_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'refunded')),
  reason text not null check (length(reason) between 3 and 300),
  -- The lines and quantities asked for: [{ "lineId": uuid, "qty": int, "name": {en, ar}, "unitMinor": int }].
  lines jsonb not null,
  refund_minor int check (refund_minor is null or refund_minor >= 0),
  -- card: refunded to the card through the payment provider; manual: staff pay it back (cash or transfer).
  refund_method text not null default '' check (refund_method in ('', 'card', 'manual')),
  refund_ref text not null default '',
  restocked boolean not null default false,
  staff_note text not null default '' check (length(staff_note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists order_returns_order on order_returns (order_id);
create index if not exists order_returns_status on order_returns (status, created_at);
-- One open request per order at a time.
create unique index if not exists order_returns_one_open on order_returns (order_id) where status = 'requested';
alter table order_returns enable row level security;
