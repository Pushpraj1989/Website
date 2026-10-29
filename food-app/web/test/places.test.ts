// Address search and reverse geocoding against a fake provider. No network is used.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { searchPlaces, reversePlace, resetPlacesForTests } from '../lib/places.ts';

process.env.PLACES_USER_AGENT = 'SampleKitchen-test/1.0 (test@example.com)';
process.env.PLACES_BASE_URL = 'https://places.test';

type Call = { url: string; headers: Record<string, string> };

function fakeFetch(body: unknown, status = 200, calls: Call[] = []) {
  return (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

beforeEach(() => resetPlacesForTests());

test('a search returns labels and coordinates, and drops results without coordinates', async () => {
  const body = [
    { display_name: 'Dubai Marina, Dubai, UAE', lat: '25.08', lon: '55.14', osm_id: 1, secret: 'x' },
    { display_name: 'No coordinates here' },
  ];
  const places = await searchPlaces('dubai marina', 'en', fakeFetch(body));
  assert.deepEqual(places, [{ label: 'Dubai Marina, Dubai, UAE', lat: 25.08, lng: 55.14 }]);
});

test('the provider gets the identifying User-Agent and the language asked for', async () => {
  const calls: Call[] = [];
  await searchPlaces('marina walk', 'ar', fakeFetch([], 200, calls));
  assert.equal(calls[0].headers['User-Agent'], process.env.PLACES_USER_AGENT);
  assert.match(calls[0].url, /accept-language=ar/);
});

test('a repeat search is answered from the cache without calling the provider again', async () => {
  const calls: Call[] = [];
  const fetchFn = fakeFetch([{ display_name: 'Abu Dhabi', lat: '24.45', lon: '54.37' }], 200, calls);
  await searchPlaces('abu dhabi', 'en', fetchFn);
  await searchPlaces('Abu Dhabi', 'en', fetchFn);
  assert.equal(calls.length, 1);
});

test('the provider is paced: two calls are at least a second apart', async () => {
  const start = Date.now();
  await searchPlaces('first place', 'en', fakeFetch([]));
  await searchPlaces('second place', 'en', fakeFetch([]));
  assert.ok(Date.now() - start >= 1000, 'the second call waited');
});

test('a provider failure gives a plain message and never its own text', async () => {
  await assert.rejects(searchPlaces('some place', 'en', fakeFetch({ error: 'key abc123 invalid' }, 500)), (error: { code?: string; message?: string }) => {
    assert.equal(error.code, 'places_unavailable');
    assert.doesNotMatch(error.message ?? '', /abc123|key/);
    return true;
  });
});

test('a network failure is reported the same plain way', async () => {
  const broken = (async () => { throw new Error('ECONNRESET'); }) as typeof fetch;
  await assert.rejects(searchPlaces('some place', 'en', broken), (error: { code?: string }) => error.code === 'places_unavailable');
});

test('a query that is too short is refused before any call', async () => {
  const calls: Call[] = [];
  await assert.rejects(searchPlaces('ab', 'en', fakeFetch([], 200, calls)), (error: { code?: string }) => error.code === 'bad_input');
  assert.equal(calls.length, 0);
});

test('without a User-Agent configured, search is refused rather than sent anonymously', async () => {
  const saved = process.env.PLACES_USER_AGENT;
  delete process.env.PLACES_USER_AGENT;
  try {
    await assert.rejects(searchPlaces('dubai mall', 'en', fakeFetch([])), (error: { code?: string }) => error.code === 'places_unavailable');
  } finally {
    process.env.PLACES_USER_AGENT = saved;
  }
});

test('a reverse lookup returns the label for the pinned point, with coordinates rounded to about 10 metres', async () => {
  const calls: Call[] = [];
  const place = await reversePlace(25.080712, 55.140999, 'en', fakeFetch({ display_name: 'Marina Walk, Dubai' }, 200, calls));
  assert.deepEqual(place, { label: 'Marina Walk, Dubai', lat: 25.0807, lng: 55.141 });
  assert.match(calls[0].url, /lat=25\.0807/);
});

test('a reverse lookup for coordinates outside the world is refused', async () => {
  await assert.rejects(reversePlace(95, 55, 'en', fakeFetch({})), (error: { code?: string }) => error.code === 'bad_input');
});
