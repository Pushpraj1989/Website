// Address search and reverse geocoding, behind one adapter. The app never calls a map provider directly: the
// provider, its key and its limits are set here. Default provider: OpenStreetMap Nominatim, which asks for an
// identifying User-Agent and at most one request a second. Results are cached, so repeat lookups cost nothing.
import { RuleError } from './orders.ts';

export type Place = { label: string; lat: number; lng: number };

type Fetch = typeof fetch;
const CACHE_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 1100;
const cache = new Map<string, { at: number; value: Place[] }>();
let lastCall = 0;

function baseUrl(): string {
  return process.env.PLACES_BASE_URL ?? 'https://nominatim.openstreetmap.org';
}

function userAgent(): string {
  const value = process.env.PLACES_USER_AGENT;
  if (!value) throw new RuleError('Address search is not configured yet.', 'places_unavailable', 503);
  return value;
}

/** Waits so the provider sees at most one request a second from this server. */
async function paced(): Promise<void> {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
}

async function call(url: URL, fetchFn: Fetch): Promise<unknown> {
  await paced();
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new RuleError('Address search is not available right now. Try again or pin the address on the map.', 'places_unavailable', 503);
  }
  if (!response.ok) {
    throw new RuleError('Address search is not available right now. Try again or pin the address on the map.', 'places_unavailable', 503);
  }
  return response.json();
}

function toPlace(raw: { display_name?: unknown; lat?: unknown; lon?: unknown }): Place | null {
  const lat = Number(raw.lat);
  const lng = Number(raw.lon);
  if (typeof raw.display_name !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label: raw.display_name.slice(0, 200), lat, lng };
}

export async function searchPlaces(query: string, locale: 'en' | 'ar', fetchFn: Fetch = fetch): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3 || q.length > 100) throw new RuleError('Type at least three letters to search.', 'bad_input', 400);
  const key = `search:${locale}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const url = new URL('/search', baseUrl());
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('accept-language', locale === 'ar' ? 'ar' : 'en');
  const raw = (await call(url, fetchFn)) as unknown[];
  const value = (Array.isArray(raw) ? raw : []).flatMap((r) => {
    const place = toPlace(r as Record<string, unknown>);
    return place ? [place] : [];
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function reversePlace(lat: number, lng: number, locale: 'en' | 'ar', fetchFn: Fetch = fetch): Promise<Place | null> {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    throw new RuleError('The location is not valid.', 'bad_input', 400);
  }
  // Round to about 10 metres so nearby taps share one cached answer.
  const rLat = Math.round(lat * 10000) / 10000;
  const rLng = Math.round(lng * 10000) / 10000;
  const key = `reverse:${locale}:${rLat}:${rLng}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value[0] ?? null;
  const url = new URL('/reverse', baseUrl());
  url.searchParams.set('lat', String(rLat));
  url.searchParams.set('lon', String(rLng));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('accept-language', locale === 'ar' ? 'ar' : 'en');
  const raw = (await call(url, fetchFn)) as Record<string, unknown>;
  const place = toPlace({ display_name: raw.display_name, lat: rLat, lon: rLng });
  cache.set(key, { at: Date.now(), value: place ? [place] : [] });
  return place;
}

/** For tests: forget cached answers and the pacing clock. */
export function resetPlacesForTests(): void {
  cache.clear();
  lastCall = 0;
}
