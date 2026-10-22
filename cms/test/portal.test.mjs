// Integration tests for the listing portal target. Runs against a temporary copy of the portal's
// content, with the portal build replaced by a no-op, so the real portal files are never changed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CMS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(CMS_DIR, "..");
const PORT = 8892;
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cms-portal-test-"));
const portalCopy = path.join(tmp, "portal");
fs.cpSync(path.join(REPO, "portals", "azaiba-portal", "content"), path.join(portalCopy, "content"), { recursive: true });
fs.mkdirSync(path.join(portalCopy, "content", "media"), { recursive: true });
fs.copyFileSync(path.join(REPO, "portals", "azaiba-portal", "content", "media", "own-street.jpg"), path.join(portalCopy, "content", "media", "own-street.jpg"));
const env = {
  ...process.env,
  CMS_PORT: String(PORT),
  CMS_HOST: "127.0.0.1",
  CMS_PUBLIC_URL: BASE,
  CMS_COOKIE_SECURE: "false",
  CMS_DB: path.join(tmp, "cms.sqlite"),
  CMS_PORTAL_DIR: portalCopy,
  CMS_PYTHON: "true",
  CMS_TARGET: "portal",
};
const PASSWORD = "river-stone-harbour-42";
let child;
let cookie = "";
let csrf = "";

before(async () => {
  const out = spawnSync(process.execPath, ["src/cli.mjs", "invite", "owner@example.com", "admin"], { cwd: CMS_DIR, env, encoding: "utf-8" });
  const token = new URL(out.stdout.match(/https?:\S+/)[0]).hash.match(/token=([^&]+)/)[1];
  child = spawn(process.execPath, ["src/server.mjs"], { cwd: CMS_DIR, env, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/admin/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  const acc = await call("POST", "/api/auth/accept-invite", { token, name: "Owner", password: PASSWORD });
  assert.equal(acc.status, 201);
  const login = await call("POST", "/api/auth/login", { email: "owner@example.com", password: PASSWORD });
  assert.equal(login.status, 200);
  csrf = login.data.csrf;
});

after(() => {
  child?.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function call(method, route, body, { raw, contentType } = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(csrf && method !== "GET" ? { "X-CSRF-Token": csrf } : {}), ...(raw ? { "Content-Type": contentType || "" } : body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie && setCookie.startsWith("cms_sid=")) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(portalCopy, "content", f), "utf-8"));

test("the content manager opens the portal: site, buildings and flats are all there", async () => {
  const r = await call("GET", "/api/content");
  assert.equal(r.status, 200);
  assert.equal(r.data.target, "portal");
  assert.equal(r.data.buildings.length, 5);
  assert.equal(r.data.listings.length, 15);
  assert.equal(r.data.site.name, "Azaiba Gardens");
});

test("site settings save and the rest of site.json is kept", async () => {
  const current = (await call("GET", "/api/content")).data.site;
  const edited = { ...current, hero_lede: "Updated lead text for the portal." };
  const r = await call("PUT", "/api/content/site", { value: edited });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const saved = readJson("site.json");
  assert.equal(saved.hero_lede, "Updated lead text for the portal.");
  assert.equal(saved.currency, "OMR");
});

test("site settings refuse a missing home title and a bad email", async () => {
  const current = (await call("GET", "/api/content")).data.site;
  assert.equal((await call("PUT", "/api/content/site", { value: { ...current, hero_title: "" } })).status, 422);
  assert.equal((await call("PUT", "/api/content/site", { value: { ...current, email: "not-an-email" } })).status, 422);
});

test("a flat's rent is saved as a structured amount with its currency and period", async () => {
  const listings = (await call("GET", "/api/content")).data.listings;
  const edited = JSON.parse(JSON.stringify(listings));
  edited[0].price = { amount: "280.500", currency: "OMR", period: "month" };
  const r = await call("PUT", "/api/content/listings", { value: edited });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const saved = readJson(`listings/${edited[0].id}.json`);
  assert.equal(saved.price.amount, 280.5);
  assert.equal(saved.price.currency, "OMR");
});

test("flats refuse a flat type, currency, status or decimal places that are not allowed", async () => {
  const listings = (await call("GET", "/api/content")).data.listings;
  const cases = [
    (f) => { f.bhk = "5 BHK"; }, // not in the flat types list
    (f) => { f.price.currency = "ZZZ"; },
    (f) => { f.status = "Sold"; },
    (f) => { f.price.amount = "12.3456"; }, // OMR allows 3 decimals
    (f) => { f.measures = { build: null, carpet: null }; }, // no area
  ];
  for (const change of cases) {
    const edited = JSON.parse(JSON.stringify(listings));
    change(edited[0]);
    const r = await call("PUT", "/api/content/listings", { value: edited });
    assert.equal(r.status, 422, change.toString());
  }
});

test("a flat cannot point at a building that does not exist", async () => {
  const listings = (await call("GET", "/api/content")).data.listings;
  const edited = JSON.parse(JSON.stringify(listings));
  edited[0].building = "no-such-building";
  assert.equal((await call("PUT", "/api/content/listings", { value: edited })).status, 422);
});

test("a building that still has flats cannot be removed", async () => {
  const data = (await call("GET", "/api/content")).data;
  const onlyFirst = data.buildings.slice(1);
  const r = await call("PUT", "/api/content/buildings", { value: onlyFirst });
  assert.equal(r.status, 422, "removing a building that holds flats must be refused by the link check");
  assert.ok(fs.existsSync(path.join(portalCopy, "content", "buildings", `${data.buildings[0].id}.json`)), "the building file is kept");
});

test("an uploaded photo is stored in the portal's media folder and can be picked", async () => {
  const bytes = fs.readFileSync(path.join(REPO, "portals", "azaiba-portal", "content", "media", "own-street.jpg"));
  const r = await call("POST", "/api/media", undefined, { raw: bytes, contentType: "image/jpeg" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(fs.existsSync(path.join(portalCopy, "content", "media", r.data.name)));
  const media = (await call("GET", "/api/media")).data.files;
  assert.ok(media.some((f) => f.name === r.data.name));
});

test("a photo is refused as a building cover if it is not in Media", async () => {
  const buildings = (await call("GET", "/api/content")).data.buildings;
  const edited = JSON.parse(JSON.stringify(buildings));
  edited[0].cover = "missing-photo.jpg";
  assert.equal((await call("PUT", "/api/content/buildings", { value: edited })).status, 422);
});

test("editors can read the portal but not change the lists", async () => {
  cookie = "";
  csrf = "";
  const login = await call("POST", "/api/auth/login", { email: "owner@example.com", password: PASSWORD });
  assert.equal(login.status, 200);
  csrf = login.data.csrf;
  const list = await call("GET", "/api/masters");
  assert.equal(list.status, 200);
  assert.ok(list.data.values.some((v) => v.kind === "flat_status"));
});
