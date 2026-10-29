// Membership plans and their benefits, as the app shows them. Only active plans can be bought; inactive plans
// are shown as a preview of what members get.
import { pool } from './db.ts';
import type { Localised } from './data.ts';

export type Benefit = { id: string; title: Localised; summary: Localised; icon: string; accent: string; points: Localised[] };
export type Plan = { id: string; code: string; name: Localised; price: { amountMinor: number; currency: string; period: string }; active: boolean; benefits: Benefit[] };

export async function listPlans(guestId: string | null): Promise<{ plans: Plan[]; membership: { planId: string; status: string; startedAt: string } | null }> {
  const plans = await pool.query('select id, code, name_en, name_ar, price_minor, currency, period, active from membership_plans order by position');
  const benefits = await pool.query(
    `select id, plan_id, title_en, title_ar, summary_en, summary_ar, icon, accent, points
     from membership_benefits where active order by position`,
  );
  const byPlan = new Map<string, Benefit[]>();
  for (const b of benefits.rows) {
    const list = byPlan.get(b.plan_id) ?? [];
    list.push({
      id: b.id,
      title: { en: b.title_en, ar: b.title_ar },
      summary: { en: b.summary_en, ar: b.summary_ar },
      icon: b.icon,
      accent: b.accent,
      points: (b.points as { en: string; ar: string }[]).map((p) => ({ en: p.en, ar: p.ar })),
    });
    byPlan.set(b.plan_id, list);
  }
  let membership: { planId: string; status: string; startedAt: string } | null = null;
  if (guestId) {
    const { rows } = await pool.query(
      `select plan_id, status, started_at from memberships where guest_session_id = $1 and status = 'active'
       order by started_at desc limit 1`,
      [guestId],
    );
    if (rows[0]) membership = { planId: rows[0].plan_id, status: rows[0].status, startedAt: rows[0].started_at.toISOString() };
  }
  return {
    plans: plans.rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: { en: p.name_en, ar: p.name_ar },
      price: { amountMinor: p.price_minor, currency: p.currency, period: p.period },
      active: p.active,
      benefits: byPlan.get(p.id) ?? [],
    })),
    membership,
  };
}
