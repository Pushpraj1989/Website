import { createHmac } from 'node:crypto';

const SECRET = 'whsec_slice_test_secret';

/** Builds a body and a Stripe-Signature header the way Stripe does, for webhook tests. */
export function signedStripeEvent(event: unknown, secret = SECRET) {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return { body, header: `t=${t},v1=${v1}` };
}
