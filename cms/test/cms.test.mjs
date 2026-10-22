// Integration tests: start the real server against a temporary copy of the data, with the site
// builder replaced by a no-op (CMS_PYTHON=true), so the live site files are never touched.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { totpCode } from "../src/security.mjs";

const CMS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(CMS_DIR, "..");
const PORT = 8891;
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cms-test-"));
const env = {
  ...process.env,
  CMS_PORT: String(PORT),
  CMS_HOST: "127.0.0.1",
  CMS_PUBLIC_URL: BASE,
  CMS_COOKIE_SECURE: "false",
  CMS_DB: path.join(tmp, "cms.sqlite"),
  CMS_DATA: path.join(tmp, "azaiba-gardens.json"),
  CMS_IMG_DIR: "cms-test-media",
  CMS_PYTHON: "true",
  CMS_TARGET: "azaiba",
};
const mediaDir = path.join(REPO, "shared", "img", "cms-test-media");
fs.cpSync(path.join(REPO, "data", "azaiba-gardens.json"), env.CMS_DATA);
fs.mkdirSync(mediaDir, { recursive: true });
fs.copyFileSync(path.join(REPO, "shared", "img", "azaiba-gardens", "own-street.jpg"), path.join(mediaDir, "seed.jpg"));

let child;
let cookie = "";
let csrf = "";

before(async () => {
  child = spawn(process.execPath, ["src/server.mjs"], { cwd: CMS_DIR, env, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/admin/`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("server did not start");
});

after(() => {
  child?.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(mediaDir, { recursive: true, force: true });
});

async function call(method, route, body, { headers = {}, raw } = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(csrf && method !== "GET" ? { "X-CSRF-Token": csrf } : {}), ...(raw ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie && setCookie.startsWith("cms_sid=")) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data, headers: res.headers };
}

function inviteFor(email, role) {
  const out = spawnSync(process.execPath, ["src/cli.mjs", "invite", email, role], { cwd: CMS_DIR, env, encoding: "utf-8" });
  assert.equal(out.status, 0, out.stderr);
  return new URL(out.stdout.match(/https?:\S+/)[0]).hash.match(/token=([^&]+)/)[1];
}

const PASSWORD = "river-stone-harbour-42";
let adminEmail = "owner@example.com";
let editorEmail = "editor@example.com";

test("security headers on the admin page", async () => {
  const r = await call("GET", "/admin/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("accounts exist only by invitation; the first admin accepts the CLI invite", async () => {
  const token = inviteFor(adminEmail, "admin");
  const weak = await call("POST", "/api/auth/accept-invite", { token, name: "Owner", password: "short" });
  assert.equal(weak.status, 400);
  const ok = await call("POST", "/api/auth/accept-invite", { token, name: "Owner", password: PASSWORD });
  assert.equal(ok.status, 201);
  const reused = await call("POST", "/api/auth/accept-invite", { token, name: "Owner", password: PASSWORD });
  assert.equal(reused.status, 400, "an invitation works once");
});

test("sign-in gives the same error for an unknown email and a wrong password", async () => {
  cookie = "";
  const unknown = await call("POST", "/api/auth/login", { email: "nobody@example.com", password: PASSWORD });
  const wrong = await call("POST", "/api/auth/login", { email: adminEmail, password: "not-the-password-1" });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.data.error, wrong.data.error);
});

test("sign-in works, sets an HttpOnly session cookie and returns a CSRF token", async () => {
  const r = await call("POST", "/api/auth/login", { email: adminEmail, password: PASSWORD });
  assert.equal(r.status, 200);
  assert.ok(cookie.startsWith("cms_sid="));
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
  csrf = r.data.csrf;
  assert.ok(csrf.length > 20);
});

test("changing requests need the CSRF token and must not come from another origin", async () => {
  const saved = csrf;
  csrf = "";
  const noToken = await call("PUT", "/api/content/hero", { value: {} });
  assert.equal(noToken.status, 403);
  csrf = saved;
  const cross = await call("PUT", "/api/content/hero", { value: {} }, { headers: { Origin: "https://evil.example" } });
  assert.equal(cross.status, 403);
});

test("content is validated and nothing is saved when a check fails", async () => {
  const before = fs.readFileSync(env.CMS_DATA, "utf-8");
  const emptyTitle = await call("PUT", "/api/content/hero", { value: { title: "", lede: "x" } });
  assert.equal(emptyTitle.status, 422);
  const badLink = await call("PUT", "/api/content/hero", { value: { title: "Ok", primary: { label: "Go", href: "javascript:alert(1)" } } });
  assert.equal(badLink.status, 422);
  const noWhatsApp = await call("PUT", "/api/content/contacts", { value: [{ label: "Office", number: "+968 2271 7171", tel: "+96822717171", whatsapp: false }] });
  assert.equal(noWhatsApp.status, 422);
  assert.equal(fs.readFileSync(env.CMS_DATA, "utf-8"), before);
});

test("a valid edit is saved, keeps the other sections, and leaves a backup", async () => {
  const r = await call("PUT", "/api/content/contacts", {
    value: [{ label: "Leasing office", number: "+968 9999 0000", tel: "+96899990000", whatsapp: true }],
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const saved = JSON.parse(fs.readFileSync(env.CMS_DATA, "utf-8"));
  assert.equal(saved.contact.phones[0].tel, "+96899990000");
  assert.ok(saved.buildings.items.length >= 5, "buildings are untouched");
  assert.ok(saved.intro, "other sections are untouched");
  assert.ok(fs.readdirSync(path.join(CMS_DIR, "data", "history")).some((f) => f.endsWith("-contacts.json")));
});

function flatFrom(current, patch) {
  const copy = JSON.parse(JSON.stringify(current));
  Object.assign(copy[0].flats[0], patch);
  return copy;
}

test("flats store area and price as structured values and the site gets matching text", async () => {
  const current = (await call("GET", "/api/content")).data.buildings;
  assert.equal(current[0].flats[0].measures.build.value, 52, "older text values are read as numbers");
  const edited = flatFrom(current, {
    measures: { build: { value: "88.5", unit: "sqm" }, carpet: { value: "75", unit: "sqm" } },
    price: { amount: "375.250", currency: "OMR", period: "month" },
  });
  const ok = await call("PUT", "/api/content/buildings", { value: edited });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const saved = JSON.parse(fs.readFileSync(env.CMS_DATA, "utf-8")).buildings.items[0].flats[0];
  assert.equal(saved.measures.build.value, 88.5);
  assert.equal(saved.size, "Build 88.5 sq m · Carpet 75 sq m");
  assert.equal(saved.rent, "OMR 375.25");
  assert.equal(saved.period_text, "/ month");
});

test("a yearly rent and square yards are shown with their own labels", async () => {
  const current = (await call("GET", "/api/content")).data.buildings;
  const edited = flatFrom(current, {
    measures: { build: { value: "1000", unit: "sqyd" }, carpet: null },
    price: { amount: "4500", currency: "OMR", period: "year" },
  });
  assert.equal((await call("PUT", "/api/content/buildings", { value: edited })).status, 200);
  const saved = JSON.parse(fs.readFileSync(env.CMS_DATA, "utf-8")).buildings.items[0].flats[0];
  assert.equal(saved.size, "Build 1,000 sq yd");
  assert.equal(saved.rent, "OMR 4,500");
  assert.equal(saved.period_text, "/ year");
});

test("invalid numbers, units, currencies and periods are refused with a clear message", async () => {
  const current = (await call("GET", "/api/content")).data.buildings;
  const cases = [
    { measures: { build: { value: "88", unit: "sqm" }, carpet: null }, price: { amount: "12.3456", currency: "OMR", period: "month" }, why: "too many decimals for OMR" },
    { measures: { build: { value: "88", unit: "sqm" }, carpet: null }, price: { amount: "12.345", currency: "USD", period: "month" }, why: "USD allows 2 decimals" },
    { measures: { build: { value: "88", unit: "acre" }, carpet: null }, price: { amount: "100", currency: "OMR", period: "month" }, why: "unit not in the list" },
    { measures: { build: null, carpet: null }, price: { amount: "100", currency: "OMR", period: "month" }, why: "no area" },
    { measures: { build: { value: "88", unit: "sqm" }, carpet: null }, price: { amount: "100", currency: "ZZZ", period: "month" }, why: "unknown currency" },
    { measures: { build: { value: "88", unit: "sqm" }, carpet: null }, price: { amount: "-5", currency: "OMR", period: "month" }, why: "negative rent" },
    { measures: { build: { value: "8x", unit: "sqm" }, carpet: null }, price: { amount: "100", currency: "OMR", period: "month" }, why: "letters in a number" },
    { measures: { build: { value: "88", unit: "sqm" }, carpet: null }, price: { amount: "100", currency: "OMR", period: "week" }, why: "period not in the list" },
  ];
  for (const c of cases) {
    const r = await call("PUT", "/api/content/buildings", { value: flatFrom(current, c) });
    assert.equal(r.status, 422, c.why);
  }
});

test("administrators maintain the lists; a value hidden from new entries still displays on old ones", async () => {
  const add = await call("POST", "/api/masters/bedroom_type", { code: "Duplex", label: "Duplex" });
  assert.equal(add.status, 200, JSON.stringify(add.data));
  const badCurrency = await call("POST", "/api/masters/currency", { code: "usd", label: "Dollar", decimals: 2 });
  assert.equal(badCurrency.status, 400, "currency codes are three capital letters");
  const hide = await call("PUT", "/api/masters/bedroom_type/Duplex", { active: false });
  assert.equal(hide.status, 200);
  const current = (await call("GET", "/api/content")).data.buildings;
  const useHidden = await call("PUT", "/api/content/buildings", { value: flatFrom(current, { type: "Duplex" }) });
  assert.equal(useHidden.status, 422, "a hidden value cannot be chosen for a new entry");
  const lists = (await call("GET", "/api/masters")).data.values;
  assert.ok(lists.some((r) => r.kind === "currency" && r.code === "OMR" && r.decimals === 3));
});

test("uploads are checked by content: a renamed text file is refused", async () => {
  const fake = await call("POST", "/api/media", undefined, { headers: { "Content-Type": "image/jpeg" }, raw: "<script>alert(1)</script>" });
  assert.equal(fake.status, 415);
});

test("a real photo uploads, is stored under a hashed name and becomes a usable image", async () => {
  const bytes = fs.readFileSync(path.join(REPO, "shared", "img", "azaiba-gardens", "own-living.jpg"));
  const r = await call("POST", "/api/media", undefined, { headers: { "Content-Type": "image/jpeg" }, raw: bytes });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.data.name, /^up-[0-9a-f]{12}\.jpg$/);
  assert.ok(fs.existsSync(path.join(mediaDir, r.data.name)));
  const content = await call("GET", "/api/content");
  assert.ok(content.data.images[r.data.key], "the photo is registered in the site's image list");
});

test("a served file cannot escape the media folder", async () => {
  const r = await call("GET", "/api/media/file/..%2F..%2Fdata%2Fcms.sqlite");
  assert.equal(r.status, 404);
});

test("only administrators can manage people; an editor gets 403", async () => {
  csrf = "";
  cookie = "";
  const token = inviteFor(editorEmail, "editor");
  const setup = await call("POST", "/api/auth/accept-invite", { token, name: "Editor", password: "harbour-lantern-quartz-7" });
  assert.equal(setup.status, 201);
  await call("POST", "/api/auth/login", { email: editorEmail, password: "harbour-lantern-quartz-7" }).then((r) => (csrf = r.data.csrf));
  const list = await call("GET", "/api/users");
  assert.equal(list.status, 403);
  const readLists = await call("GET", "/api/masters");
  assert.equal(readLists.status, 200, "editors can read the lists");
  const changeLists = await call("POST", "/api/masters/currency", { code: "CNY", label: "Yuan", decimals: 2 });
  assert.equal(changeLists.status, 403, "editors cannot change the lists");
  const invite = await call("POST", "/api/users/invite", { email: "x@example.com", role: "admin" });
  assert.equal(invite.status, 403);
  const content = await call("GET", "/api/content");
  assert.equal(content.status, 200, "editors can still edit content");
});

test("forgot-password gives the same reply for unknown and known emails", async () => {
  cookie = "";
  const unknown = await call("POST", "/api/auth/forgot", { email: "nobody@example.com" });
  const known = await call("POST", "/api/auth/forgot", { email: editorEmail });
  assert.equal(unknown.status, 200);
  assert.equal(known.status, 200);
  assert.equal(unknown.data.message, known.data.message);
});

test("two-step sign-in: a password alone is not enough once 2FA is on", async () => {
  await call("POST", "/api/auth/login", { email: adminEmail, password: PASSWORD }).then((r) => (csrf = r.data.csrf));
  const setup = await call("POST", "/api/auth/totp/setup", {});
  assert.equal(setup.status, 200);
  const code = totpCode(setup.data.secret);
  const enable = await call("POST", "/api/auth/totp/enable", { code });
  assert.equal(enable.status, 200);
  cookie = "";
  const noCode = await call("POST", "/api/auth/login", { email: adminEmail, password: PASSWORD });
  assert.equal(noCode.data.needs_code, true);
  assert.equal(noCode.headers.get("set-cookie"), null, "no session without the second step");
  const wrong = await call("POST", "/api/auth/login", { email: adminEmail, password: PASSWORD, code: "000000" });
  assert.equal(wrong.status, 401);
  const right = await call("POST", "/api/auth/login", { email: adminEmail, password: PASSWORD, code: totpCode(setup.data.secret) });
  assert.equal(right.status, 200);
  csrf = right.data.csrf;
});

test("signing out ends the session", async () => {
  const out = await call("POST", "/api/auth/logout", {});
  assert.equal(out.status, 200);
  const after = await call("GET", "/api/content");
  assert.equal(after.status, 401);
});
