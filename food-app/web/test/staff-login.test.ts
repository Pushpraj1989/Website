// Staff sign-in limits: one source is stopped after repeated wrong passwords; another source can still try.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertCanTry, recordFailure, sourceOf, MAX_PER_SOURCE } from '../lib/staff-login.ts';
import { RuleError } from '../lib/orders.ts';

const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: process.env, stdio: 'ignore' });
});

test('repeated wrong passwords from one source are refused for a while; other sources are not', async () => {
  const one = sourceOf(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }));
  const other = sourceOf(new Headers({ 'x-forwarded-for': '198.51.100.4' }));
  for (let i = 0; i < MAX_PER_SOURCE; i++) {
    await assertCanTry(one);
    await recordFailure(one);
  }
  await assert.rejects(assertCanTry(one), (e: unknown) => e instanceof RuleError && e.code === 'too_many_attempts' && e.status === 429);
  await assertCanTry(other);
});

test('the source is stored only as a hash', () => {
  const hash = sourceOf(new Headers({ 'x-forwarded-for': '203.0.113.7' }));
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes('203.0.113.7'));
});
