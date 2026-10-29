import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// Fresh schema and sample seed before the suite. Each run starts from the same data.
// Run from food-app/web (npm run test:e2e does this).
export default function globalSetup() {
  const migrate = join(process.cwd(), 'db', 'migrate.mjs');
  const result = spawnSync(process.execPath, [migrate, '--reset'], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test' },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('database reset failed');
}
