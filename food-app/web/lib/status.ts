// Order state machine. A transition not listed here is refused by the data layer.
export const ORDER_STATUSES = [
  'awaiting_payment',
  'placed',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'shipped',
  'delivered',
  'collected',
  'rejected',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ['placed', 'cancelled'],
  placed: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'shipped', 'cancelled'],
  preparing: ['ready', 'shipped'],
  // A courier order is handed over as 'shipped' (with its tracking), then delivered.
  ready: ['out_for_delivery', 'collected', 'shipped'],
  out_for_delivery: ['delivered'],
  shipped: ['delivered'],
  delivered: [],
  collected: [],
  rejected: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}
