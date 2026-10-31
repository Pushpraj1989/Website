// Passkeys (WebAuthn): after signing in once with an email code, a customer can add a passkey, then sign in with Face
// ID or Touch ID instead of a code. The browser keeps the private key; the server keeps the public key and checks
// each signature. The site's own address (PUBLIC_URL) is what a passkey is tied to, so it only works there.
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { pool } from './db.ts';
import { RuleError } from './orders.ts';
import { accountForToken, createSession, type Account } from './accounts.ts';

const CHALLENGE_MINUTES = 5;

/** The site a passkey belongs to: PUBLIC_URL on the server; the request's own address in development and tests. */
export function relyingParty(requestOrigin: string) {
  const origin = (process.env.PUBLIC_URL || requestOrigin).replace(/\/$/, '');
  return { origin, rpID: new URL(origin).hostname };
}

async function restaurantName(): Promise<string> {
  const { rows } = await pool.query('select name_en from restaurant limit 1');
  return rows[0]?.name_en || 'Restaurant';
}

async function saveChallenge(purpose: 'register' | 'login', challenge: string, accountId: string | null) {
  await pool.query('delete from passkey_challenges where expires_at < now()');
  const { rows } = await pool.query(
    `insert into passkey_challenges (purpose, account_id, challenge, expires_at) values ($1, $2, $3, now() + make_interval(mins => $4)) returning id`,
    [purpose, accountId, challenge, CHALLENGE_MINUTES],
  );
  return rows[0].id as string;
}

// Takes a challenge once. A challenge that is unknown, used, expired or for another purpose is refused.
async function takeChallenge(id: unknown, purpose: 'register' | 'login') {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new RuleError('Start again.', 'bad_challenge', 400);
  const { rows } = await pool.query(
    `update passkey_challenges set used_at = now() where id = $1 and purpose = $2 and used_at is null and expires_at > now()
     returning challenge, account_id`,
    [id, purpose],
  );
  if (!rows[0]) throw new RuleError('That took too long. Try again.', 'challenge_expired', 410);
  return rows[0] as { challenge: string; account_id: string | null };
}

/** Step 1 of adding a passkey, for the signed-in customer. */
export async function registrationOptions(account: Account, requestOrigin: string) {
  const { rpID } = relyingParty(requestOrigin);
  const existing = await pool.query('select id, transports from passkeys where account_id = $1', [account.id]);
  const options = await generateRegistrationOptions({
    rpName: await restaurantName(),
    rpID,
    userName: account.email ?? account.phone,
    userDisplayName: account.name,
    userID: new TextEncoder().encode(account.id),
    attestationType: 'none',
    excludeCredentials: existing.rows.map((r) => ({ id: r.id as string, transports: r.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  const challengeId = await saveChallenge('register', options.challenge, account.id);
  return { challengeId, options };
}

/** Step 2 of adding a passkey: checks what the device made and keeps its public key. */
export async function registerPasskey(account: Account, challengeId: unknown, response: unknown, requestOrigin: string) {
  const challenge = await takeChallenge(challengeId, 'register');
  if (challenge.account_id !== account.id) throw new RuleError('Start again.', 'bad_challenge', 400);
  const { origin, rpID } = relyingParty(requestOrigin);
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    throw new RuleError('Face ID could not be set up. Try again.', 'passkey_refused', 400);
  }
  if (!verified.verified || !verified.registrationInfo) throw new RuleError('Face ID could not be set up. Try again.', 'passkey_refused', 400);
  const { credential } = verified.registrationInfo;
  await pool.query(
    `insert into passkeys (id, account_id, public_key, counter, transports) values ($1, $2, $3, $4, $5)
     on conflict (id) do nothing`,
    [credential.id, account.id, Buffer.from(credential.publicKey), credential.counter, credential.transports ?? []],
  );
  return { ok: true };
}

/** Step 1 of signing in with a passkey. Nobody is named: the device offers the passkeys it holds for this site. */
export async function loginOptions(requestOrigin: string) {
  const { rpID } = relyingParty(requestOrigin);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  const challengeId = await saveChallenge('login', options.challenge, null);
  return { challengeId, options };
}

/** Step 2: checks the device's signature against the kept public key and opens a session for its customer. */
export async function loginWithPasskey(challengeId: unknown, response: unknown, requestOrigin: string) {
  const challenge = await takeChallenge(challengeId, 'login');
  const credentialId = (response as { id?: unknown })?.id;
  if (typeof credentialId !== 'string') throw new RuleError('Face ID did not work. Sign in with your email instead.', 'passkey_refused', 400);
  const { rows } = await pool.query('select id, account_id, public_key, counter, transports from passkeys where id = $1', [credentialId]);
  const passkey = rows[0];
  if (!passkey) throw new RuleError('This Face ID is not set up for an account here. Sign in with your email, then turn on Face ID.', 'passkey_unknown', 404);
  const { origin, rpID } = relyingParty(requestOrigin);
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response: response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: passkey.id, publicKey: new Uint8Array(passkey.public_key), counter: Number(passkey.counter), transports: passkey.transports },
      requireUserVerification: true,
    });
  } catch {
    throw new RuleError('Face ID did not work. Sign in with your email instead.', 'passkey_refused', 400);
  }
  if (!verified.verified) throw new RuleError('Face ID did not work. Sign in with your email instead.', 'passkey_refused', 400);
  await pool.query('update passkeys set counter = $2, last_used_at = now() where id = $1', [passkey.id, verified.authenticationInfo.newCounter]);
  const token = await createSession(passkey.account_id);
  return { token, account: await accountForToken(token) };
}
