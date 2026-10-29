import { NextRequest, NextResponse } from 'next/server';
import * as data from '@/lib/data.ts';
import { guestHash, ensureGuest, withGuestCookie, errorResponse, readJson } from '@/lib/http.ts';
import { menuItem, pricedLines, quoteFor, validateCart, RuleError } from '@/lib/orders.ts';
import { RESTAURANT } from '@/lib/seed.ts';

type Channel = 'delivery' | 'pickup';

function channelFrom(value: unknown): Channel {
  return value === 'pickup' ? 'pickup' : 'delivery';
}

// The cart shows what is in it, with server prices. A quote is only given when every line can be sold.
function viewFor(owner: string, channel: Channel) {
  const lines = data.getCart(owner);
  let quote = null;
  let problem: string | null = null;
  if (lines.length) {
    try {
      pricedLines(lines);
      quote = quoteFor(owner, channel);
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      problem = error.message;
    }
  }
  return {
    currency: RESTAURANT.pricing.currency,
    lines: lines.map((line) => {
      const item = menuItem(line.itemId);
      return {
        itemId: line.itemId,
        qty: line.qty,
        note: line.note,
        name: item?.name ?? null,
        unitMinor: item?.priceMinor ?? null,
        soldOut: item?.soldOut ?? false,
      };
    }),
    quote,
    problem,
  };
}

export async function GET(request: NextRequest) {
  try {
    const channel = channelFrom(request.nextUrl.searchParams.get('channel'));
    const owner = await guestHash();
    if (!owner) return NextResponse.json({ currency: RESTAURANT.pricing.currency, lines: [], quote: null, problem: null });
    return NextResponse.json(viewFor(owner, channel));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJson(request);
    const lines = validateCart(body.items);
    for (const line of lines) {
      const item = menuItem(line.itemId);
      if (!item) throw new RuleError('That item is not on the menu.', 'item_missing', 422);
      if (item.soldOut) throw new RuleError(`${item.name.en} is sold out.`, 'sold_out', 422);
    }
    const { hash, newToken } = await ensureGuest(await guestHash());
    data.setCart(hash, lines);
    return withGuestCookie(NextResponse.json(viewFor(hash, channelFrom(body.channel))), newToken);
  } catch (error) {
    return errorResponse(error);
  }
}
