import { NextRequest } from 'next/server';
import { ordersPlacedAfter } from '@/lib/alerts.ts';
import { isStaff } from '@/lib/http.ts';

export const dynamic = 'force-dynamic';

const POLL_MS = 3000;
const HEARTBEAT_MS = 15000;

// A server-sent stream of new orders for the kitchen. Staff only. The first event says the stream is open; then one
// "order" event per new order, and a comment line every 15 seconds so the connection stays open through proxies.
export async function GET(request: NextRequest) {
  if (!(await isStaff())) {
    return new Response(JSON.stringify({ error: { code: 'unauthorised', message: 'Sign in as staff.' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const encoder = new TextEncoder();
  let since = new Date();
  let timers: ReturnType<typeof setInterval>[] = [];
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string) => { if (!closed) controller.enqueue(encoder.encode(text)); };
      send(`event: ready\ndata: {"since":"${since.toISOString()}"}\n\n`);
      const poll = setInterval(async () => {
        try {
          const { orders, latest } = await ordersPlacedAfter(since);
          since = latest;
          for (const order of orders) send(`event: order\ndata: ${JSON.stringify(order)}\n\n`);
        } catch {
          // A failed poll is tried again on the next tick; the stream stays open. The error is not sent to the browser.
        }
      }, POLL_MS);
      const beat = setInterval(() => send(': keep-alive\n\n'), HEARTBEAT_MS);
      timers = [poll, beat];
      request.signal.addEventListener('abort', () => {
        closed = true;
        timers.forEach(clearInterval);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      closed = true;
      timers.forEach(clearInterval);
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' },
  });
}
