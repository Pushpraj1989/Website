-- SAMPLE DATA for local development and tests. Names, prices and Arabic text are placeholders, written fresh.
-- Replace with the client's menu before launch. Safe to run twice (on conflict do nothing).

insert into restaurant (id, name_en, name_ar, phone, address_en, address_ar, country_code, currency_code, timezone,
  tax_label, tax_basis_points, prices_include_tax, min_order_minor, cash_limit_minor, service_fee_minor,
  accepts_card, accepts_cod, accepts_pay_on_arrival)
values ('00000000-0000-4000-8000-000000000001', 'Sample Kitchen', 'مطبخ تجريبي', '+971000000000',
  'Placeholder address', 'عنوان تجريبي', 'AE', 'AED', 'Asia/Dubai',
  'VAT', 500, true, 0, 30000, 0, true, true, true)
on conflict (id) do nothing;

insert into categories (id, restaurant_id, name_en, name_ar, sort_order) values
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'Starters', 'المقبلات', 1),
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001', 'Mains', 'الأطباق الرئيسية', 2),
  ('00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000001', 'Drinks', 'المشروبات', 3)
on conflict (id) do nothing;

insert into menu_items (id, category_id, name_en, name_ar, description_en, description_ar, base_price_minor, available, sort_order) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000010', 'Garden salad', 'سلطة الحديقة', 'Crisp leaves, tomato, cucumber and lemon.', 'أوراق خضراء طازجة وطماطم وخيار وليمون.', 1800, true, 1),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000010', 'Lentil soup', 'شوربة العدس', 'Red lentils with cumin, served warm.', 'عدس أحمر بالكمون يقدم دافئاً.', 1500, true, 2),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000020', 'Grilled chicken plate', 'طبق دجاج مشوي', 'Chicken, rice and grilled vegetables.', 'دجاج وأرز وخضار مشوية.', 4500, true, 1),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000020', 'Vegetable stew', 'يخنة الخضار', 'Seasonal vegetables slow-cooked in tomato.', 'خضار الموسم مطهوة ببطء في الطماطم.', 3800, true, 2),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000020', 'Beef kebab', 'كباب لحم', 'Charcoal-grilled beef skewers.', 'أسياخ لحم بقري مشوية على الفحم.', 5200, false, 3),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000030', 'Mint lemonade', 'ليموناضة بالنعناع', 'Fresh lemon with mint.', 'ليمون طازج مع النعناع.', 1200, true, 1),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000030', 'Still water', 'مياه معدنية', 'Bottled water, 500 ml.', 'مياه معبأة، 500 مل.', 500, true, 2)
on conflict (id) do nothing;

-- One delivery zone, covering a box around central Dubai (placeholder). Real zones are drawn in admin (A07).
insert into delivery_zones (id, restaurant_id, name_en, name_ar, polygon, fee_minor, min_order_minor, active)
values ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', 'Central (sample)', 'الوسط (تجريبي)',
  ST_GeogFromText('SRID=4326;POLYGON((55.0 24.8, 55.6 24.8, 55.6 25.4, 55.0 25.4, 55.0 24.8))'), 1000, 0, true)
on conflict (id) do nothing;

-- Sample category pictures (the admin changes these): starters, mains and drinks show their own illustration.
update categories set illustration = 'starters' where name_en = 'Starters';
update categories set illustration = 'mains' where name_en = 'Mains';
update categories set illustration = 'drinks' where name_en = 'Drinks';
