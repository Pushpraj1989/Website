// Everything the film says and shows, in one file. `tools/new_video.py` writes this from a brief; edit it by hand to
// fine-tune. Words wrapped in *stars* take the accent colour. "\n" starts a new line.
//
// Honest content only: every number, name, price and claim must come from the real product or the client's brief.

export const BRAND = {
  name: 'Your Product',
  wordmark: ['Your', 'Product'], // the name split over two lines for the logo lock-up
  tagline: 'Say what it does in one line.',
  repo: 'example.com/your-product', // the link typed on the end card; use the real one
  // The logo mark. 'monogram' (the first letter on a rounded square in the accent colour) works for any brand. 'bowl'
  // is the Business App Kit mark. For a real brand, draw its mark in LogoMark (components.tsx) or ask the client.
  logo: 'monogram',
};

export const COPY = {
  hook: {
    landscape: 'Still paying for\nthe wrong *thing?*',
    portrait: 'Still paying\nfor the\nwrong *thing?*',
  },
  // "Meet / your own / product." one beat at a time, then the logo draws on.
  brandBeats: ['Meet', 'your *own*', 'product *name.*'],
  promise: {
    line: 'Free. Open source.',
    from: 30, // the big number counts down from this...
    value: 0, // ...to this
    unit: '%',
    word: 'commission.',
    sub: 'No subscription. No per-order fee.',
  },
  deploy: {
    lead: 'Deploy on',
    words: ['your server.'],
    host: 'root@your-server',
    command: 'curl -fsSL …/install.sh | sudo DOMAIN=app.yourdomain.com bash',
    steps: ['Database', 'HTTPS certificate', 'Website · Console · App'],
    liveTitle: 'Your app is live',
    liveUrl: 'app.yourdomain.com',
    pills: ['Website', 'Admin console', 'Customer app'],
  },
  details: {
    lead: 'Add your',
    words: ['business.', 'products.'],
    sectionLabel: 'Business and look',
    nameLabel: 'Business name',
    colourLabel: 'Brand colour',
    productsLabel: 'Products',
    addLabel: '+ Add product',
  },
  offers: { lead: 'Run', words: ['offers.', 'vouchers.', 'campaigns.'] },
  dashboard: { headline: 'Watch it *grow.*' },
  stores: {
    lead: 'Ready for the',
    words: ['stores.'],
    chips: ['iOS', 'Android', 'Web'],
    fine: 'Built with Flutter. Publish under your own name with your Apple and Google developer accounts.',
  },
  sectors: { headline: 'One app. *Every business.*', before: 'Your', after: 'app is ready.' },
  end: {
    tagline: 'Build it in a day.',
    tags: ['0% commission', 'Free & open source', 'Apache 2.0'],
  },
};

// The demo data shown on screen (dishes, prices, monthly sales). Replace with the product's real demo data.
export const DEMO = {
  restaurant: 'Demo Business',
  currency: 'AED',
  dishes: [
    { name: 'Product one', cat: 'Category A', price: 18, img: 'dishes/product-1.png' },
    { name: 'Product two', cat: 'Category A', price: 15, img: 'dishes/product-1.png' },
    { name: 'Product three', cat: 'Category B', price: 45, img: 'dishes/product-1.png' },
  ],
  months: [
    { m: 'May', v: 182 }, { m: 'Jun', v: 420 }, { m: 'Jul', v: 270 }, { m: 'Aug', v: 635 }, { m: 'Sep', v: 449 }, { m: 'Oct', v: 281 },
  ],
  sales: 2237, orders: 40, collected: 32, average: 62.14, customers: 36,
};

// The businesses in the carousel scene: the real app set up for each, filmed into public/shots/sector-<key>.png.
export const SECTORS: { key: string; name: string; shot: string }[] = [
  { key: 'one', name: 'first business', shot: 'shots/sector-one.png' },
  { key: 'two', name: 'second business', shot: 'shots/sector-two.png' },
  { key: 'three', name: 'third business', shot: 'shots/sector-three.png' },
];

// The scene order and length in frames (30 fps). Remove a scene to drop it; the film's length follows.
// ids: hook, brand, promise, deploy, details, offers, dashboard, stores, sectors, end. Keep brand early (the corner
// logo appears from the third scene on) and end last.
export const SCENE_PLAN: { id: string; frames: number }[] = [
  { id: 'hook', frames: 96 },
  { id: 'brand', frames: 126 },
  { id: 'promise', frames: 96 },
  { id: 'deploy', frames: 174 },
  { id: 'details', frames: 186 },
  { id: 'offers', frames: 180 },
  { id: 'dashboard', frames: 198 },
  { id: 'stores', frames: 174 },
  { id: 'sectors', frames: 240 },
  { id: 'end', frames: 108 },
];
