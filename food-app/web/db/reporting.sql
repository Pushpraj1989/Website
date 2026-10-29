-- Phase 8: an append-only audit log of promotion changes: campaign transitions, voucher revocations, partner changes.
-- Safe to re-run.
create table if not exists promotion_audit_log (
  id bigint generated always as identity primary key,
  actor text not null check (length(actor) between 1 and 120),
  action text not null check (length(action) between 1 and 60),
  target_type text not null check (target_type in ('campaign','voucher','partner','batch')),
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists promotion_audit_log_target on promotion_audit_log (target_type, target_id, id);
create or replace function promotion_audit_is_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'promotion_audit_log is append-only';
end $$;
drop trigger if exists promotion_audit_no_change on promotion_audit_log;
create trigger promotion_audit_no_change before update or delete on promotion_audit_log
  for each row execute function promotion_audit_is_append_only();
alter table promotion_audit_log enable row level security;
