// The pilot's daily check. Run once a day (for example at 06:00 Gulf time) on staging:
//   DATABASE_URL=... VOUCHER_CODE_SECRET=... node --experimental-strip-types scripts/daily-check.ts
// It moves campaigns along their dates, finishes any queued batches, prints the day's figures and the reconciliation
// checks, and exits with status 1 if any check is not zero, so a scheduler can raise an alert.
import { pool } from '../lib/db.ts';
import { refreshCampaignStatuses, runBatch } from '../lib/campaigns.ts';
import { promotionsReport } from '../lib/reports.ts';
import { recordAudit } from '../lib/audit.ts';

const aed = (minor: number) => `AED ${(minor / 100).toFixed(2)}`;

async function main() {
  await refreshCampaignStatuses();
  const queued = await pool.query(`select id from voucher_batches where status in ('queued','running') order by created_at limit 20`);
  for (const b of queued.rows) {
    try {
      await runBatch(b.id, 20);
    } catch (err) {
      console.log(`Batch ${b.id} stopped: ${err instanceof Error ? err.message : err}`);
    }
  }
  const report = await promotionsReport();
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Promotion daily check, ${today}`);
  console.log(`Issued ${report.summary.issued} · still usable ${report.summary.available} · used ${report.summary.redeemed} · expired ${report.summary.expired} · revoked ${report.summary.revoked}`);
  console.log(`Redemptions ${report.summary.redemptions} · discount given ${aed(report.summary.discountMinor)}`);
  console.log('\nCampaigns');
  for (const cm of report.campaigns) {
    console.log(`  ${cm.name} [${cm.status}] issued ${cm.issued}, used ${cm.redeemed}, redemptions ${cm.redemptions}, discount ${aed(cm.discountMinor)}, paid by ${cm.fundedBy}`);
  }
  console.log('\nChecks');
  for (const check of report.reconciliation) console.log(`  ${check.count === 0 ? 'OK ' : 'LOOK'} ${check.meaning}: ${check.count}`);
  if (report.failedBatches.length) {
    console.log('\nBatches that stopped');
    for (const b of report.failedBatches) console.log(`  ${b.campaign}: ${b.generated} of ${b.requested}. ${b.reason}`);
  }
  await recordAudit(pool, 'daily-check', 'daily_check', 'campaign', null, { date: today, reconciled: report.reconciled, summary: report.summary });
  console.log(report.reconciled ? '\nAll checks are zero.' : '\nSome checks are not zero. Look at them before the next report.');
  if (!report.reconciled) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
