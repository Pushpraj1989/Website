// Applies the schema from replica/schema.sql, then the sample seed. Usage:
//   DATABASE_URL=postgres://... node db/migrate.mjs            apply (safe to re-run)
//   DATABASE_URL=postgres://... node db/migrate.mjs --reset    drop the public schema first (local and test only)
// On Supabase the auth schema already exists; the stub below is only created when auth.uid() is missing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const schemaFile = fileURLToPath(new URL('../../../replica/schema.sql', import.meta.url));
const seedFile = fileURLToPath(new URL('./seed.sql', import.meta.url));
const AUTH_STUB = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
do $$ begin
  if to_regprocedure('auth.uid()') is null then
    create function auth.uid() returns uuid language sql stable as $f$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  end if;
end $$;`;

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL');
const reset = process.argv.includes('--reset');
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (reset) await client.query('drop schema public cascade; create schema public;');
  await client.query(AUTH_STUB);
  await client.query(readFileSync(schemaFile, 'utf8'));
  await client.query(readFileSync(seedFile, 'utf8'));
  console.log(`schema and seed applied${reset ? ' (after reset)' : ''}`);
} finally {
  await client.end();
}
