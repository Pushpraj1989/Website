// The bundled illustrations, by the illustration key each category carries (set in the admin's Categories page).
const FILES = {
  starters: 'dish-starters.svg',
  mains: 'dish-mains.svg',
  drinks: 'dish-drinks.svg',
  desserts: 'dish-desserts.svg',
  dish: 'dish-mains.svg',
};

export const ILLUSTRATION_LABELS = {
  dish: 'General dish',
  starters: 'Starters',
  mains: 'Mains',
  drinks: 'Drinks',
  desserts: 'Desserts',
};

export function illustrationSrc(key) {
  return `/illustrations/${FILES[key] ?? FILES.dish}`;
}
