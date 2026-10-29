import { NextRequest, NextResponse } from 'next/server';
import * as data from '@/lib/data.ts';
import { currentGuestId, ensureGuest, withGuestCookie, errorResponse, readJson } from '@/lib/http.ts';
import { pricedLines, quoteFor, validateCart, RuleError } from '@/lib/orders.ts';

type Channel = 'delivery' | 'pickup';

function channelFrom(value: unknown): Channel {
  return value === 'pickup' ? 'pickup' : 'delivery';
}

// The cart shows what is in it, with server prices. A quote is only given when every line can be sold.
async function viewFor(guestId: string, channel: Channel) {
  const lines = await data.getCart(guestId);
  const items = await data.getItems(lines.map((l) => l.itemId));
  let quote = null;
  let problem: string | null = null;
  if (lines.length) {
    try {
      await pricedLines(lines);
      quote = await quoteFor(guestId, channel);
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      problem = error.message;
    }
  }
  const restaurant = await data.getRestaurant();
  return {
    currency: restaurant.currency,
    lines: lines.map((line) => {
      const item = items.get(line.itemId);
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
    const guestId = await currentGuestId();
    if (!guestId) return NextResponse.json({ currency: 'AED', lines: [], quote: null, problem: null });
    return NextResponse.json(await viewFor(guestId, channel));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJson(request);
    const lines = validateCart(body.items);
    const items = await data.getItems(lines.map((l) => l.itemId));
    for (const line of lines) {
      const item = items.get(line.itemId);
      if (!item) throw new RuleError('That item is not on the menu.', 'item_missing', 422);
      if (item.soldOut) throw new RuleError(`${item.name.en} is sold out.`, 'sold_out', 422);
    }
    const { id, newToken } = await ensureGuest(await currentGuestId());
    await data.setCart(id, lines);
    return withGuestCookie(NextResponse.json(await viewFor(id, channelFrom(body.channel))), newToken);
  } catch (error) {
    return errorResponse(error);
  }
}
