// Applies the schema from replica/schema.sql, then the sample seed. Usage:
//   DATABASE_URL=postgres://... node db/migrate.mjs            new database: schema and seed; existing: later files only
//   DATABASE_URL=postgres://... node db/migrate.mjs --reset    drop the public schema first (local and test only)
// On Supabase the auth schema already exists; the stub below is only created when auth.uid() is missing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const schemaFile = fileURLToPath(new URL('../../../replica/schema.sql', import.meta.url));
const seedFile = fileURLToPath(new URL('./seed.sql', import.meta.url));
const authFile = fileURLToPath(new URL('./auth.sql', import.meta.url));
const platformFile = fileURLToPath(new URL('./platform.sql', import.meta.url));
const vouchersFile = fileURLToPath(new URL('./vouchers.sql', import.meta.url));
const templatesFile = fileURLToPath(new URL('./templates.sql', import.meta.url));
const printingFile = fileURLToPath(new URL('./printing.sql', import.meta.url));
const walletFile = fileURLToPath(new URL('./wallet.sql', import.meta.url));
const checkoutFile = fileURLToPath(new URL('./checkout.sql', import.meta.url));
const partnersFile = fileURLToPath(new URL('./partners.sql', import.meta.url));
const reportingFile = fileURLToPath(new URL('./reporting.sql', import.meta.url));
const brandingFile = fileURLToPath(new URL('./branding.sql', import.meta.url));
const securityFile = fileURLToPath(new URL('./security.sql', import.meta.url));
const homeFile = fileURLToPath(new URL('./home.sql', import.meta.url));
const emailSigninFile = fileURLToPath(new URL('./email-signin.sql', import.meta.url));
const passkeysFile = fileURLToPath(new URL('./passkeys.sql', import.meta.url));
const retailFile = fileURLToPath(new URL('./retail.sql', import.meta.url));
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
  // A database that already has the schema only gets the later files, which are written to run again safely. The base
  // schema and the sample seed run once, on a new database, so a deploy never touches a restaurant's own data.
  const existing = (await client.query("select to_regclass('public.restaurant') is not null as present")).rows[0].present;
  await client.query(AUTH_STUB);
  if (!existing) await client.query(readFileSync(schemaFile, 'utf8'));
  await client.query(readFileSync(authFile, 'utf8'));
  await client.query(readFileSync(platformFile, 'utf8'));
  await client.query(readFileSync(vouchersFile, 'utf8'));
  await client.query(readFileSync(templatesFile, 'utf8'));
  await client.query(readFileSync(printingFile, 'utf8'));
  await client.query(readFileSync(walletFile, 'utf8'));
  await client.query(readFileSync(checkoutFile, 'utf8'));
  await client.query(readFileSync(partnersFile, 'utf8'));
  await client.query(readFileSync(reportingFile, 'utf8'));
  await client.query(readFileSync(brandingFile, 'utf8'));
  await client.query(readFileSync(securityFile, 'utf8'));
  await client.query(readFileSync(homeFile, 'utf8'));
  await client.query(readFileSync(emailSigninFile, 'utf8'));
  await client.query(readFileSync(passkeysFile, 'utf8'));
  await client.query(readFileSync(retailFile, 'utf8'));
  if (!existing) await client.query(readFileSync(seedFile, 'utf8'));
  console.log(existing ? 'database brought up to date (existing data kept)' : `schema and seed applied${reset ? ' (after reset)' : ''}`);
} finally {
  await client.end();
}
