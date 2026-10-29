import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Checks a Stripe webhook signature header ("t=...,v1=...") against the raw request body.
 * Signed payload is `${t}.${rawBody}` with HMAC-SHA256 keyed by the endpoint secret (whsec_...).
 * Rejects timestamps outside the tolerance window to block replays.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = value ?? '';
    if (key === 'v1' && value) signatures.push(value);
  }
  const t = Number(timestamp);
  if (!Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return signatures.some((sig) => {
    const candidate = Buffer.from(sig, 'utf8');
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}
