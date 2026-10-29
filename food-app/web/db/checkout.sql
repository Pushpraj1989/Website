-- Phase 6: offers and vouchers in the cart and at checkout. Safe to re-run.
-- The cart remembers the one code the customer applied (a voucher, or a shared offer code). The order records what
-- was applied, so the release and the confirmation later act on exactly what was held.
alter table carts add column if not exists applied_voucher_id uuid references vouchers(id) on delete set null;
alter table carts add column if not exists applied_offer_id uuid references offers(id) on delete set null;
alter table orders add column if not exists applied_voucher_id uuid references vouchers(id) on delete restrict;
alter table orders add column if not exists applied_offer_id uuid references offers(id) on delete restrict;
-- A shared offer's usage is counted on the order while it is pending. This records that the count was taken, so a
-- release gives it back exactly once.
alter table orders add column if not exists offer_reserved boolean not null default false;
alter table orders add column if not exists offer_finalised boolean not null default false;
-- The signed-in customer who applied the offer, if any. Recorded so the redemption names the customer; the webhook
-- that confirms a card payment does not know who the customer is.
alter table orders add column if not exists applied_account_id uuid references accounts(id) on delete set null;
