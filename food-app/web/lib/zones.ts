// Delivery areas, drawn by staff. Each area is a polygon, a fee and a minimum order. Customers' addresses are
// matched to the area that covers them, so the restaurant changes its coverage here and nowhere in the code.
import type { PoolClient } from 'pg';
import { pool, withTx } from './db.ts';
import { restaurantId } from './data.ts';
import { RuleError } from './orders.ts';

export type ZoneInput = { nameEn: string; nameAr: string; feeMinor: number; minOrderMinor: number; active: boolean; polygon: [number, number][] };

const MAX_MONEY = 1_000_000_00;
const MAX_POINTS = 200;

function text(value: unknown, max: number, field: string): string {
  const out = typeof value === 'string' ? value.trim().slice(0, max) : '';
  if (!out) throw new RuleError(`Enter the ${field}.`, 'bad_input', 400);
  return out;
}

function money(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_MONEY) {
    throw new RuleError(`The ${field} is not a valid amount.`, 'bad_input', 400);
  }
  return value as number;
}

export function validateZone(raw: unknown): ZoneInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const points = Array.isArray(body.polygon) ? body.polygon : [];
  if (points.length < 3 || points.length > MAX_POINTS) {
    throw new RuleError('An area needs at least three corner points.', 'bad_input', 400);
  }
  const polygon = points.map((p) => {
    const pair = Array.isArray(p) ? p : [];
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (pair.length !== 2 || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      throw new RuleError('Each corner point needs a longitude from -180 to 180 and a latitude from -90 to 90.', 'bad_input', 400);
    }
    return [lng, lat] as [number, number];
  });
  return {
    nameEn: text(body.nameEn, 80, 'name in English'),
    nameAr: text(body.nameAr, 80, 'name in Arabic'),
    feeMinor: money(body.feeMinor, 'delivery fee'),
    minOrderMinor: money(body.minOrderMinor, 'minimum order'),
    active: body.active !== false,
    polygon,
  };
}

/** Well-known text for the polygon. Every number was validated above, so nothing else can reach the query. */
function polygonWkt(points: [number, number][]): string {
  const ring = [...points, points[0]];
  return `SRID=4326;POLYGON((${ring.map(([x, y]) => `${x} ${y}`).join(', ')}))`;
}

async function checkShape(c: PoolClient, wkt: string): Promise<void> {
  const { rows } = await c.query('select ST_IsValid(ST_GeogFromText($1)::geometry) as ok', [wkt]);
  if (!rows[0].ok) throw new RuleError('The outline of this area crosses itself. Draw it again with its corners in order.', 'bad_input', 400);
}

export type ZoneRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  feeMinor: number;
  minOrderMinor: number;
  active: boolean;
  polygon: [number, number][];
};

export async function listZones(): Promise<ZoneRow[]> {
  const { rows } = await pool.query(
    `select id, name_en, name_ar, fee_minor, min_order_minor, active, ST_AsGeoJSON(polygon::geometry) as shape
     from delivery_zones where restaurant_id = $1 order by name_en`,
    [restaurantId],
  );
  return rows.map((r) => ({
    id: r.id,
    nameEn: r.name_en,
    nameAr: r.name_ar,
    feeMinor: r.fee_minor,
    minOrderMinor: r.min_order_minor,
    active: r.active,
    polygon: (JSON.parse(r.shape).coordinates[0] as [number, number][]).slice(0, -1),
  }));
}

export async function createZone(input: ZoneInput): Promise<string> {
  const wkt = polygonWkt(input.polygon);
  return withTx(async (c: PoolClient) => {
    await checkShape(c, wkt);
    const { rows } = await c.query(
      `insert into delivery_zones (restaurant_id, name_en, name_ar, polygon, fee_minor, min_order_minor, active)
       values ($1, $2, $3, ST_GeogFromText($4), $5, $6, $7) returning id`,
      [restaurantId, input.nameEn, input.nameAr, wkt, input.feeMinor, input.minOrderMinor, input.active],
    );
    return rows[0].id;
  });
}

export async function updateZone(id: string, input: ZoneInput): Promise<void> {
  const wkt = polygonWkt(input.polygon);
  await withTx(async (c: PoolClient) => {
    await checkShape(c, wkt);
    const { rowCount } = await c.query(
      `update delivery_zones set name_en = $3, name_ar = $4, polygon = ST_GeogFromText($5), fee_minor = $6,
         min_order_minor = $7, active = $8
       where id = $1 and restaurant_id = $2`,
      [id, restaurantId, input.nameEn, input.nameAr, wkt, input.feeMinor, input.minOrderMinor, input.active],
    );
    if (!rowCount) throw new RuleError('Area not found.', 'not_found', 404);
  });
}
