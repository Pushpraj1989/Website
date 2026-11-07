// One entry per business type. Every screen is a real capture of the app or console set up as that business;
// every name, price, code and number on screen is the demo data that was entered for filming.

export type Shot = { src: string; kicker: string; title: string; body: string };
export type Clip = { src: string; kicker: string; title: string; body: string; seconds: number };

export type SectorFilm = {
  id: string;
  word: string; // "salon", "pharmacy": used in "Build your <word> app in a day."
  business: string; // the demo business shown in the screens
  palette: { accent: string; amber: string; saffron: string; cream: string; card: string; line: string };
  hook: { landscape: string; portrait: string; sub: string };
  meet: string[]; // beats before the sign-in phone appears
  meetLine: string;
  tour: Shot[];
  booking?: { kicker: string; title: string; body: string; note: string };
  console: Clip[];
  popupLink: { title: string; body: string };
  dashboard: { title: string; body: string };
  features: string[];
};

const appShots = (d: string, s: Record<string, [string, string, string]>): Shot[] =>
  Object.entries(s).map(([file, [kicker, title, body]]) => ({ src: `${d}/app/${file}.png`, kicker, title, body }));

export const FILMS: SectorFilm[] = [
  {
    id: 'salon',
    word: 'salon',
    business: 'Glow Studio',
    palette: { accent: '#9D174D', amber: '#F472B6', saffron: '#FBCFE8', cream: '#FFF8FB', card: '#FFFFFF', line: '#F3E1EA' },
    hook: { landscape: 'Your clients live\non their *phones.*', portrait: 'Your clients\nlive on their\n*phones.*', sub: 'Is your salon there?' },
    meet: ['Your salon.', 'Your *app.*'],
    meetLine: 'Your name, your colours, your products. Sign in with email, Face ID, or as a guest.',
    tour: appShots('salon', {
      'a02-popup': ['The app', 'Offers that pop', 'Your latest offer greets every client, with its code and terms.'],
      'a03-home': ['The app', 'A home that sells', 'Your photos, your categories, your best sellers.'],
      'a04-browse': ['The app', 'Easy to browse', 'Lips, face, brushes, nails: every category with its own photo.'],
      'a05-product': ['The app', 'Shades and sizes', 'Each option with its own price and stock.'],
      'a07-cart': ['The app', 'Codes that work', 'GLOW20 takes 20% off, with the limits you set.'],
      'a08-ship': ['The app', 'Delivery, pickup or courier', 'Shipping options with prices, and free over an amount.'],
      'a09-order': ['The app', 'Live order status', 'Clients see every step, from placed to collected.'],
      'a10-arabic': ['The app', 'English and Arabic', 'One tap switches the whole app, right to left.'],
    }),
    booking: { kicker: 'Coming on request', title: 'Appointments, *designed*', body: 'Pick a treatment, a stylist and a free time. The design is ready.', note: 'Booking is designed, and built when you ask for it.' },
    console: [
      { src: 'salon/console/product.mp4', kicker: 'The back office', title: 'Add a product', body: 'Name, price, shades with their own stock, and a photo.', seconds: 13 },
      { src: 'salon/console/coupon.mp4', kicker: 'The back office', title: 'Create a coupon', body: '20% off with GLOW20, a minimum spend and a cap.', seconds: 8 },
      { src: 'salon/console/campaign.mp4', kicker: 'The back office', title: 'Run a campaign', body: 'Dates, a budget, a rule and a code. Then start it.', seconds: 10 },
      { src: 'salon/console/popup.mp4', kicker: 'The back office', title: 'Put it in the app', body: 'A pop-up with your photo, linked to the offer.', seconds: 9 },
      { src: 'salon/console/orders.mp4', kicker: 'The back office', title: 'Take orders live', body: 'Accept, prepare and hand over, with a sound for each new order.', seconds: 6 },
    ],
    popupLink: { title: 'Saved in the console.\n*Live in the app.*', body: 'No developer, no app update.' },
    dashboard: { title: 'Watch it *grow.*', body: 'Sales, orders, average order and new clients, by day, week or month.' },
    features: ['English and Arabic', 'Guest checkout', 'Delivery, pickup, courier', 'Cash or card', 'Shades, sizes, stock', 'Returns and refunds', 'Coupons and campaigns', 'Web, iPhone, Android'],
  },
  {
    id: 'pharmacy',
    word: 'pharmacy',
    business: 'CityCare Pharmacy',
    palette: { accent: '#0F766E', amber: '#2DD4BF', saffron: '#99F6E4', cream: '#F5FBFA', card: '#FFFFFF', line: '#DCEFEC' },
    hook: { landscape: 'Your customers order\neverything *online.*', portrait: 'Your customers\norder everything\n*online.*', sub: 'Can they order from your pharmacy?' },
    meet: ['Your pharmacy.', 'Your *app.*'],
    meetLine: 'Your name, your colours, your products. Sign in with email, Face ID, or as a guest.',
    tour: appShots('pharmacy', {
      'a02-popup': ['The app', 'Offers that pop', 'This week’s offer greets every customer, with its code.'],
      'a03-home': ['The app', 'Your pharmacy, in a pocket', 'Vitamins, everyday care and skin care, with your photos.'],
      'a05-product': ['The app', 'Sizes and stock', 'Each size with its own price, and stock that counts down.'],
      'a07-cart': ['The app', 'Codes that work', 'CARE15 takes 15% off, with the limits you set.'],
      'a08-ship': ['The app', 'Delivery, pickup or courier', 'Shipping options with prices, and free over an amount.'],
      'a09-order': ['The app', 'Live order status', 'Customers see every step, from placed to collected.'],
      'a10-arabic': ['The app', 'English and Arabic', 'One tap switches the whole app, right to left.'],
    }),
    console: [
      { src: 'pharmacy/console/product.mp4', kicker: 'The back office', title: 'Add a product', body: 'Name, price, sizes with their own stock, and a photo.', seconds: 13 },
      { src: 'pharmacy/console/coupon.mp4', kicker: 'The back office', title: 'Create a coupon', body: '15% off with CARE15, a minimum spend and a cap.', seconds: 8 },
      { src: 'pharmacy/console/campaign.mp4', kicker: 'The back office', title: 'Run a campaign', body: 'Dates, a budget, a rule and a code. Then start it.', seconds: 10 },
      { src: 'pharmacy/console/popup.mp4', kicker: 'The back office', title: 'Put it in the app', body: 'A pop-up with your photo, linked to the offer.', seconds: 9 },
      { src: 'pharmacy/console/orders.mp4', kicker: 'The back office', title: 'Take orders live', body: 'Accept, prepare and hand over, with a sound for each new order.', seconds: 6 },
    ],
    popupLink: { title: 'Saved in the console.\n*Live in the app.*', body: 'No developer, no app update.' },
    dashboard: { title: 'Watch it *grow.*', body: 'Sales, orders, average order and new customers, by day, week or month.' },
    features: ['English and Arabic', 'Guest checkout', 'Delivery, pickup, courier', 'Cash or card', 'Sizes and stock', 'Returns and refunds', 'Coupons and campaigns', 'Web, iPhone, Android'],
  },
];
