// Cart lines in the browser. A line is one product, or one option of a product (size, colour...): the same product in
// two sizes is two lines. Every change sends the whole cart back with each line's option, so none is ever lost.
export type CartLineIn = { itemId: string; variantId?: string | null; qty: number; note: string };

/** The line's identity: product and option together. */
export const lineKey = (l: { itemId: string; variantId?: string | null }) => `${l.itemId}:${l.variantId ?? ''}`;

/** A line as the cart API takes it. */
export const forPut = (l: CartLineIn) => (l.variantId ? { itemId: l.itemId, variantId: l.variantId, qty: l.qty, note: l.note } : { itemId: l.itemId, qty: l.qty, note: l.note });
