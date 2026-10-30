-- White-label settings: each restaurant that runs this product sets its own name, logo, colour and contact details in
-- the admin. The customer app and the admin read them from the API; nothing about the restaurant is built into code.
alter table restaurant add column if not exists brand_color text not null default '#B45309';
alter table restaurant add column if not exists tagline_en text not null default '';
alter table restaurant add column if not exists tagline_ar text not null default '';
alter table restaurant add column if not exists logo_media_id uuid references media(id) on delete set null;
do $$ begin
  alter table restaurant add constraint restaurant_brand_color_hex check (brand_color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

-- Settings changes are audited with the promotions trail.
alter table promotion_audit_log drop constraint if exists promotion_audit_log_target_type_check;
alter table promotion_audit_log add constraint promotion_audit_log_target_type_check
  check (target_type in ('campaign','voucher','partner','batch','restaurant'));

-- The look of the customer app and website, chosen by the restaurant in the admin. The brand colour goes on top.
alter table restaurant add column if not exists theme text not null default 'classic';
do $$ begin
  alter table restaurant add constraint restaurant_theme_known check (theme in ('classic','midnight','glass','glass_night'));
exception when duplicate_object then null; end $$;
