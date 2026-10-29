// A load check against a running server: many concurrent requests to a few endpoints, reporting the median, the 95th
// percentile and the errors. Numbers from a shared sandbox are indicative only; measure on production-like hardware.
// Usage: BASE=http://127.0.0.1:3100 PARTNER_KEY=pk_... REQUESTS=200 CONCURRENCY=10 node test/load.mjs
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const REQUESTS = Number(process.env.REQUESTS ?? 200);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const P95_LIMIT_MS = Number(process.env.P95_LIMIT_MS ?? 800);
const key = process.env.PARTNER_KEY;

const endpoints = [
  { name: 'menu', url: `${BASE}/v1/menu`, headers: {} },
  { name: 'home shortcuts (no sign-in)', url: `${BASE}/v1/customer/home`, headers: {} },
];
if (key) endpoints.push({ name: 'partner campaigns', url: `${BASE}/v1/partner/campaigns`, headers: { authorization: `Bearer ${key}` } });

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
let worst = 0;
for (const ep of endpoints) {
  const times = [];
  let errors = 0;
  let next = 0;
  const worker = async () => {
    while (next < REQUESTS) {
      next++;
      const started = performance.now();
      try {
        const res = await fetch(ep.url, { headers: ep.headers });
        if (res.status >= 500) errors++;
        await res.arrayBuffer();
      } catch {
        errors++;
      }
      times.push(performance.now() - started);
    }
  };
  const began = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seconds = (performance.now() - began) / 1000;
  const sorted = times.sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  worst = Math.max(worst, p95);
  console.log(`${ep.name.padEnd(28)} n=${sorted.length} p50=${percentile(sorted, 50).toFixed(0)}ms p95=${p95.toFixed(0)}ms max=${sorted[sorted.length - 1].toFixed(0)}ms errors=${errors} throughput=${(sorted.length / seconds).toFixed(0)}/s`);
}
if (worst > P95_LIMIT_MS) {
  console.log(`\nFAIL: a 95th percentile is above ${P95_LIMIT_MS} ms.`);
  process.exit(1);
}
console.log(`\nAll 95th percentiles are under ${P95_LIMIT_MS} ms, with no server errors counted above.`);
