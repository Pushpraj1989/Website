import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "./config.mjs";
import { parseDecimal } from "./measures.mjs";

// The listing portal's content: site settings (site.json), one file per building and one per flat.
// The portal's build.py turns these into pages; this module validates and writes them.

export const PORTAL_SECTIONS = ["site", "buildings", "listings"];
const ID_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;
const MEDIA_RE = /^[a-z0-9][a-z0-9._-]{0,80}\.(jpg|jpeg|png|webp|mp4|webm)$/i;
const VIDEO_RE = /\.(mp4|webm)$/i;
const IMAGE_RE = /\.(jpg|jpeg|png|webp)$/i;
const AREA_MAX = 100000;
const AMOUNT_MAX = 1_000_000_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const contentDir = () => path.join(config.portalDir, "content");
const folder = (name) => path.join(contentDir(), name);

function readJsonDir(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")));
}

export function readPortal() {
  return {
    site: JSON.parse(fs.readFileSync(path.join(contentDir(), "site.json"), "utf-8")),
    buildings: readJsonDir(folder("buildings")),
    listings: readJsonDir(folder("listings")),
  };
}

export function portalMedia() {
  const dir = config.mediaDir;
  const used = new Set();
  const { site, buildings, listings } = readPortal();
  used.add(site.video);
  for (const b of buildings) { used.add(b.cover); used.add(b.video); for (const g of b.gallery || []) used.add(g); }
  for (const l of listings) { used.add(l.cover); used.add(l.video); for (const g of l.gallery || []) used.add(g); }
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => MEDIA_RE.test(f)).sort().map((name) => ({
        name,
        kind: VIDEO_RE.test(name) ? "video" : "image",
        imageKey: null,
        inUse: used.has(name),
      }))
    : [];
}

// ---- validation -----------------------------------------------------------------------------

function str(value, max, label, errors, required = false) {
  const clean = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (!clean) {
    if (required) errors.push(`${label} is required.`);
    return "";
  }
  if (clean.length > max) errors.push(`${label} is longer than ${max} characters.`);
  return clean.slice(0, max);
}

function media(value, label, errors, { required = false, kind = "any" } = {}) {
  const name = String(value ?? "");
  if (!name) {
    if (required) errors.push(`${label}: choose a file from Media.`);
    return "";
  }
  if (!MEDIA_RE.test(name)) errors.push(`${label}: "${name}" is not a valid file name.`);
  else if (kind === "image" && !IMAGE_RE.test(name)) errors.push(`${label} must be a photo.`);
  else if (kind === "video" && !VIDEO_RE.test(name)) errors.push(`${label} must be a film (mp4 or webm).`);
  else if (!fs.existsSync(path.join(config.mediaDir, name))) errors.push(`${label}: "${name}" is not in Media.`);
  return name;
}

function list(value, label, errors, max) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${label} must be a list.`);
    return [];
  }
  return value.slice(0, max);
}

export function validateSite(input, current, ctx) {
  const errors = [];
  const i = input || {};
  const value = {
    ...current,
    group: str(i.group, 40, "Group name", errors, true),
    name: str(i.name, 60, "Site name", errors, true),
    location: str(i.location, 80, "Location", errors),
    tagline: str(i.tagline, 120, "Tagline", errors),
    hero_title: str(i.hero_title, 140, "Home title", errors, true),
    hero_lede: str(i.hero_lede, 400, "Home lead text", errors),
    about_title: str(i.about_title, 120, "About title", errors),
    about_text: str(i.about_text, 2000, "About text", errors),
    phone: str(i.phone, 80, "Phone", errors),
    whatsapp: str(i.whatsapp, 80, "WhatsApp", errors),
    email: str(i.email, 120, "Enquiries email", errors),
    address: str(i.address, 200, "Office address", errors),
    video: media(i.video, "Home film", errors, { kind: "video" }) || "",
    currency: String(i.currency || ""),
  };
  // Placeholders that start with TODO stay as they are until the client sends the real value.
  const placeholder = (v) => v.startsWith("TODO");
  if (value.email && !placeholder(value.email) && !EMAIL_RE.test(value.email)) errors.push("Enquiries email must look like name@example.com.");
  if (value.whatsapp && !placeholder(value.whatsapp) && !/^\d{8,15}$/.test(value.whatsapp)) errors.push("WhatsApp must be digits only, with the country code, for example 96812345678.");
  if (!ctx.allowed("currency", value.currency)) errors.push("Pick a currency from the list.");
  return { value, errors };
}

export function validateBuildings(input, ctx, current = []) {
  const errors = [];
  const items = list(input, "Buildings", errors, 30);
  const ids = new Set();
  const value = items.map((b, idx) => {
    const label = b.name ? `Building "${b.name}"` : `Building ${idx + 1}`;
    const id = String(b.id || "");
    if (!ID_RE.test(id)) errors.push(`${label}: ID must use lowercase letters, numbers and dashes.`);
    if (ids.has(id)) errors.push(`${label}: ID "${id}" is used twice.`);
    ids.add(id);
    const status = str(b.status, 40, `${label} status`, errors, true);
    if (status && !ctx.allowed("building_status", status, current[idx]?.status)) errors.push(`${label}: pick a status from the list.`);
    const floors = parseDecimal(b.floors, { label: `${label} floors`, min: 1, max: 60, decimals: 0, errors });
    const units = parseDecimal(b.units, { label: `${label} units`, min: 0, max: 5000, decimals: 0, errors });
    return {
      id,
      name: str(b.name, 80, `${label} name`, errors, true),
      area: str(b.area, 80, `${label} area`, errors),
      floors,
      units,
      status,
      description: str(b.description, 400, `${label} description`, errors),
      cover: media(b.cover, `${label} cover photo`, errors, { required: true, kind: "image" }),
      gallery: list(b.gallery, `${label} gallery`, errors, 20).map((g, k) => media(g, `${label} photo ${k + 1}`, errors, { kind: "image" })),
      video: media(b.video, `${label} film`, errors, { kind: "video" }),
    };
  });
  return { value, errors, ids };
}

export function validateListings(input, ctx, buildingIds, current = []) {
  const errors = [];
  const items = list(input, "Flats", errors, 200);
  const ids = new Set();
  const value = items.map((l, idx) => {
    const label = l.title ? `Flat "${l.title}"` : `Flat ${idx + 1}`;
    const id = String(l.id || "");
    if (!ID_RE.test(id)) errors.push(`${label}: ID must use lowercase letters, numbers and dashes.`);
    if (ids.has(id)) errors.push(`${label}: ID "${id}" is used twice.`);
    ids.add(id);
    const building = String(l.building || "");
    if (!buildingIds.has(building)) errors.push(`${label}: pick a building.`);
    const prev = current[idx] || {};
    const bhk = String(l.bhk || "");
    if (!ctx.allowed("bedroom_type", bhk, prev.bhk)) errors.push(`${label}: pick a flat type from the list.`);
    const measures = {};
    for (const key of ["build", "carpet"]) {
      const m = l.measures?.[key];
      if (!m || (m.value === "" && !m.unit)) { measures[key] = null; continue; }
      const unit = String(m.unit || "");
      if (!ctx.allowed("area_unit", unit, prev.measures?.[key]?.unit)) errors.push(`${label}: pick a unit for the ${key} area.`);
      const value = parseDecimal(m.value, { label: `${label} ${key} area`, min: 1, max: AREA_MAX, decimals: ctx.decimals("area_unit", unit), errors });
      measures[key] = { value, unit };
    }
    if (!measures.build && !measures.carpet) errors.push(`${label}: enter the build area, the carpet area, or both.`);
    const currency = String(l.price?.currency || "");
    const period = String(l.price?.period || "");
    if (!ctx.allowed("currency", currency, prev.price?.currency)) errors.push(`${label}: pick a currency from the list.`);
    if (!ctx.allowed("rent_period", period, prev.price?.period)) errors.push(`${label}: pick a rent period from the list.`);
    const amount = parseDecimal(l.price?.amount, { label: `${label} rent`, min: 0.001, max: AMOUNT_MAX, decimals: ctx.decimals("currency", currency), errors });
    const status = String(l.status || "");
    if (!ctx.allowed("flat_status", status, prev.status)) errors.push(`${label}: pick a status from the list.`);
    return {
      id,
      title: str(l.title, 120, `${label} title`, errors, true),
      building,
      bhk,
      measures: { build: measures.build, carpet: measures.carpet },
      price: { amount, currency, period },
      status,
      available_from: str(l.available_from, 40, `${label} available from`, errors),
      cover: media(l.cover, `${label} cover photo`, errors, { required: true, kind: "image" }),
      gallery: list(l.gallery, `${label} gallery`, errors, 20).map((g, k) => media(g, `${label} photo ${k + 1}`, errors, { kind: "image" })),
      video: media(l.video, `${label} film`, errors, { kind: "video" }),
      description: str(l.description, 400, `${label} description`, errors),
      featured: l.featured === true,
    };
  });
  return { value, errors };
}

// ---- writing --------------------------------------------------------------------------------

let queue = Promise.resolve();
function serial(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

// Replaces one folder's records. Files for removed records are deleted; the old files are kept in
// memory so a failed build can restore them.
function writeFolder(name, records) {
  const dir = folder(name);
  const before = new Map(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, fs.readFileSync(path.join(dir, f), "utf-8")]));
  const wanted = new Set(records.map((r) => `${r.id}.json`));
  for (const r of records) {
    const tmp = path.join(dir, `${r.id}.json.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(r, null, 2) + "\n", "utf-8");
    fs.renameSync(tmp, path.join(dir, `${r.id}.json`));
  }
  for (const f of before.keys()) if (!wanted.has(f)) fs.unlinkSync(path.join(dir, f));
  return before;
}

function restoreFolder(name, before) {
  const dir = folder(name);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) fs.unlinkSync(path.join(dir, f));
  for (const [f, text] of before) fs.writeFileSync(path.join(dir, f), text, "utf-8");
}

function backup(name, text) {
  const dir = path.join(config.historyDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-portal-${name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "snapshot.json"), text, { mode: 0o600 });
}

export function savePortalSection(section, input, actor, ctx) {
  return serial(async () => {
    const current = readPortal();
    let result;
    let snapshot;
    if (section === "site") {
      result = validateSite(input, current.site, ctx);
    } else if (section === "buildings") {
      result = validateBuildings(input, ctx, current.buildings);
      // A building cannot disappear while flats still point at it.
      const kept = new Set(result.value.map((b) => b.id));
      for (const flat of current.listings) {
        if (!kept.has(flat.building)) result.errors.push(`Flat "${flat.title}" is in building "${flat.building}". Move or remove the flat first.`);
      }
    } else if (section === "listings") {
      const buildingIds = new Set(current.buildings.map((b) => b.id));
      result = validateListings(input, ctx, buildingIds, current.listings);
    } else {
      return { ok: false, errors: ["Unknown section."] };
    }
    if (result.errors.length) return { ok: false, errors: result.errors };

    snapshot = JSON.stringify(current);
    backup(section, snapshot);
    let before = null;
    if (section === "site") {
      const file = path.join(contentDir(), "site.json");
      before = fs.readFileSync(file, "utf-8");
      fs.writeFileSync(file, JSON.stringify(result.value, null, 2) + "\n", "utf-8");
    } else {
      before = writeFolder(section, result.value);
    }

    const build = await runPortalBuild();
    if (!build.ok) {
      if (section === "site") fs.writeFileSync(path.join(contentDir(), "site.json"), before, "utf-8");
      else restoreFolder(section, before);
      return { ok: false, errors: ["The portal did not build, so the change was not published.", build.log.slice(-600)] };
    }
    return { ok: true, published: true, actor };
  });
}

export function publishPortal() {
  return serial(() => runPortalBuild());
}

export function runPortalBuild() {
  return new Promise((resolve) => {
    const child = spawn(config.python, ["build.py"], {
      cwd: config.portalDir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 240_000);
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, log }); });
    child.on("error", (err) => { clearTimeout(timer); resolve({ ok: false, log: String(err.message) }); });
  });
}
