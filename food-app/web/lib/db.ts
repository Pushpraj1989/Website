import { Pool, type PoolClient } from 'pg';

// One pool per process, kept on globalThis so dev hot reloads do not open new pools.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });
if (process.env.NODE_ENV !== 'production') globalForDb.pgPool = pool;

/** Runs fn inside one transaction. Any throw rolls everything back. */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
