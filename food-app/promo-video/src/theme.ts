// The film's palette and type. Change the brand here and every scene follows.
export const C = {
  cream: '#FFFBF3',
  ink: '#1C1917',
  muted: '#6B625A',
  line: '#EFE6D8',
  card: '#FFFFFF',
  accent: '#C2410C', // saffron-orange: one accent word per line
  amber: '#F59E0B',
  saffron: '#F6B93B',
  chilli: '#DC2626',
  green: '#15803D',
  greenSoft: '#DCFCE7',
};
export const FONT = "'Inter', system-ui, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const BRAND = {
  name: 'Free Restaurant Ordering',
  repo: 'github.com/Pushpraj1989/free-restaurant-ordering',
};
// The demo restaurant, with the real demo data from the app.
export const DEMO = {
  restaurant: 'Saffron House',
  currency: 'AED',
  dishes: [
    { name: 'Garden salad', cat: 'Starters', price: 18, img: 'dishes/dish-starters.webp' },
    { name: 'Lentil soup', cat: 'Starters', price: 15, img: 'dishes/dish-starters.webp' },
    { name: 'Grilled chicken plate', cat: 'Mains', price: 45, img: 'dishes/dish-mains.webp' },
    { name: 'Beef kebab', cat: 'Mains', price: 52, img: 'dishes/dish-mains.webp' },
    { name: 'Mint lemonade', cat: 'Drinks', price: 12, img: 'dishes/dish-drinks.webp' },
  ],
  // Orders that were not cancelled, by month (AED), from the demo database.
  months: [
    { m: 'May', v: 182 }, { m: 'Jun', v: 420 }, { m: 'Jul', v: 270 }, { m: 'Aug', v: 635 }, { m: 'Sep', v: 449 }, { m: 'Oct', v: 281 },
  ],
  sales: 2237, orders: 40, collected: 32, average: 62.14, customers: 36,
};
