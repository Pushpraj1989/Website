// FAKE DATA LAYER for the slice. Same function names and shapes as the Supabase layer will use, so screens
// and route handlers do not change when it is swapped. Backed by one JSON file; single process only.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { OrderStatus } from './status.ts';
import type { Channel, Quote } from './pricing.ts';

export type CartLine = { itemId: string; qty: number; note: string };

export type OrderLine = { itemId: string; name: { en: string; ar: string }; unitMinor: number; qty: number; note: string };

export type OrderRecord = {
  id: string;
  number: number;
  ownerHash: string;
  idempotencyKey: string;
  channel: Channel;
  method: 'card' | 'cod' | 'pay_on_arrival';
  status: OrderStatus;
  address: string | null;
  lines: OrderLine[];
  quote: Quote;
  stripePaymentIntentId: string | null;
  etaMinutes: number | null;
  history: { status: OrderStatus; at: string }[];
  createdAt: string;
};

type Store = {
  sequence: number;
  guests: Record<string, { createdAt: string }>;
  carts: Record<string, CartLine[]>;
  orders: OrderRecord[];
  paymentEvents: { id: string; type: string; receivedAt: string; orderId: string | null }[];
};

// Relative to the app root (next dev / next start run from web/).
const FILE = join(process.cwd(), 'data', 'store.json');

function load(): Store {
  if (!existsSync(FILE)) return { sequence: 1000, guests: {}, carts: {}, orders: [], paymentEvents: [] };
  return JSON.parse(readFileSync(FILE, 'utf8')) as Store;
}

function save(store: Store) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2));
}

/** Runs one read-modify-write. The fake layer has no transactions, so this is only safe in one process. */
function withStore<T>(fn: (store: Store) => T): T {
  const store = load();
  const result = fn(store);
  save(store);
  return result;
}

export function guestExists(ownerHash: string): boolean {
  return withStore((s) => ownerHash in s.guests);
}

export function createGuest(ownerHash: string) {
  withStore((s) => {
    s.guests[ownerHash] = { createdAt: new Date().toISOString() };
  });
}

export function getCart(ownerHash: string): CartLine[] {
  return withStore((s) => s.carts[ownerHash] ?? []);
}

export function setCart(ownerHash: string, lines: CartLine[]) {
  withStore((s) => {
    s.carts[ownerHash] = lines;
  });
}

export function clearCart(ownerHash: string) {
  setCart(ownerHash, []);
}

export function insertOrder(input: Omit<OrderRecord, 'id' | 'number'>): OrderRecord {
  return withStore((s) => {
    s.sequence += 1;
    const order: OrderRecord = { ...input, id: `ord_${s.sequence}_${Math.random().toString(36).slice(2, 8)}`, number: s.sequence };
    s.orders.push(order);
    return order;
  });
}

export function getOrder(id: string): OrderRecord | null {
  return withStore((s) => s.orders.find((o) => o.id === id) ?? null);
}

export function findOrderByKey(ownerHash: string, idempotencyKey: string): OrderRecord | null {
  return withStore((s) => s.orders.find((o) => o.ownerHash === ownerHash && o.idempotencyKey === idempotencyKey) ?? null);
}

export function findOrderByPaymentIntent(intentId: string): OrderRecord | null {
  return withStore((s) => s.orders.find((o) => o.stripePaymentIntentId === intentId) ?? null);
}

export function listOrders(): OrderRecord[] {
  return withStore((s) => [...s.orders].sort((a, b) => b.number - a.number));
}

export function updateOrder(id: string, patch: Partial<OrderRecord>): OrderRecord | null {
  return withStore((s) => {
    const order = s.orders.find((o) => o.id === id);
    if (!order) return null;
    Object.assign(order, patch);
    return order;
  });
}

/** Stores a payment event once. Returns false when the event id was already stored (a retry). */
export function recordPaymentEvent(eventId: string, type: string, orderId: string | null): boolean {
  return withStore((s) => {
    if (s.paymentEvents.some((e) => e.id === eventId)) return false;
    s.paymentEvents.push({ id: eventId, type, receivedAt: new Date().toISOString(), orderId });
    return true;
  });
}
