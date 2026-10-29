// PLACEHOLDER CONTENT. Names, prices and Arabic text here are sample data for the slice, written fresh.
// Replace with the client's menu before launch (see the TODO list in ../README.md).
import type { PricingSettings } from './pricing.ts';

export const RESTAURANT = {
  id: 'rest_sample',
  name: { en: 'Sample Kitchen', ar: 'مطبخ تجريبي' },
  countryCode: 'AE',
  timezone: 'Asia/Dubai',
  // Values from the AE country pack (schema.sql). The VAT rate is 5% and must be confirmed before launch.
  pricing: {
    currency: 'AED',
    taxLabel: 'VAT',
    taxBasisPoints: 500,
    deliveryFeeMinor: 1000, // placeholder: AED 10.00
    serviceFeeMinor: 0, // placeholder: no service fee until the client decides
    pricesIncludeTax: true,
  } satisfies PricingSettings & { pricesIncludeTax: true },
  // Cash on delivery and pay on arrival are switched by the restaurant in admin (A07). Card needs Stripe keys.
  payments: { cod: true, payOnArrival: true, card: true },
};

export type SeedItem = {
  id: string;
  categoryId: string;
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  priceMinor: number;
  soldOut: boolean;
};

export const CATEGORIES = [
  { id: 'cat_starters', name: { en: 'Starters', ar: 'المقبلات' } },
  { id: 'cat_mains', name: { en: 'Mains', ar: 'الأطباق الرئيسية' } },
  { id: 'cat_drinks', name: { en: 'Drinks', ar: 'المشروبات' } },
] as const;

export const ITEMS: SeedItem[] = [
  {
    id: 'itm_salad',
    categoryId: 'cat_starters',
    name: { en: 'Garden salad', ar: 'سلطة الحديقة' },
    description: { en: 'Crisp leaves, tomato, cucumber and lemon.', ar: 'أوراق خضراء طازجة وطماطم وخيار وليمون.' },
    priceMinor: 1800,
    soldOut: false,
  },
  {
    id: 'itm_soup',
    categoryId: 'cat_starters',
    name: { en: 'Lentil soup', ar: 'شوربة العدس' },
    description: { en: 'Red lentils with cumin, served warm.', ar: 'عدس أحمر بالكمون يقدم دافئاً.' },
    priceMinor: 1500,
    soldOut: false,
  },
  {
    id: 'itm_chicken',
    categoryId: 'cat_mains',
    name: { en: 'Grilled chicken plate', ar: 'طبق دجاج مشوي' },
    description: { en: 'Chicken, rice and grilled vegetables.', ar: 'دجاج وأرز وخضار مشوية.' },
    priceMinor: 4500,
    soldOut: false,
  },
  {
    id: 'itm_stew',
    categoryId: 'cat_mains',
    name: { en: 'Vegetable stew', ar: 'يخنة الخضار' },
    description: { en: 'Seasonal vegetables slow-cooked in tomato.', ar: 'خضار الموسم مطهوة ببطء في الطماطم.' },
    priceMinor: 3800,
    soldOut: false,
  },
  {
    id: 'itm_kebab',
    categoryId: 'cat_mains',
    name: { en: 'Beef kebab', ar: 'كباب لحم' },
    description: { en: 'Charcoal-grilled beef skewers.', ar: 'أسياخ لحم بقري مشوية على الفحم.' },
    priceMinor: 5200,
    soldOut: true, // shows the sold-out state in the slice
  },
  {
    id: 'itm_lemonade',
    categoryId: 'cat_drinks',
    name: { en: 'Mint lemonade', ar: 'ليموناضة بالنعناع' },
    description: { en: 'Fresh lemon with mint.', ar: 'ليمون طازج مع النعناع.' },
    priceMinor: 1200,
    soldOut: false,
  },
  {
    id: 'itm_water',
    categoryId: 'cat_drinks',
    name: { en: 'Still water', ar: 'مياه معدنية' },
    description: { en: 'Bottled water, 500 ml.', ar: 'مياه معبأة، 500 مل.' },
    priceMinor: 500,
    soldOut: false,
  },
];
