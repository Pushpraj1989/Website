import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, REPO_ROOT } from "./config.mjs";

// Only these parts of data/azaiba-gardens.json are editable from the CMS. Everything else in the
// file (sections, copy, colours, the builder's own settings) is left exactly as it is.
export const SECTIONS = ["hero", "promos", "contacts", "buildings"];

const TEXT = (max) => ({ max, required: false });
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,80}\.(mp4|webm)$/i;
const TEL_RE = /^\+\d{8,15}$/;
const HREF_RE = /^(?!.*\.\.)(?:[a-z0-9][a-z0-9._\-/]*(?:\?[^\s<>"']*)?(?:#[^\s<>"']*)?|https:\/\/[^\s<>"']{3,300}|tel:\+\d{8,15}|mailto:[^\s<>"']{3,120})$/i;

function str(value, max, label, errors, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${label} is required.`);
    return "";
  }
  if (typeof value !== "string") {
    errors.push(`${label} must be text.`);
    return "";
  }
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (clean.length > max) errors.push(`${label} is longer than ${max} characters.`);
  if (required && !clean) errors.push(`${label} is required.`);
  return clean.slice(0, max);
}

function href(value, label, errors) {
  const clean = str(value, 300, label, errors);
  if (clean && !HREF_RE.test(clean)) errors.push(`${label} must be a page on this site, an https link, a tel: or mailto: link.`);
  return clean;
}

// Accepts 265, "265" or the site's own text such as "OMR 265" and "52 sqm (dummy)": the first whole number.
function int(value, label, errors, min, max) {
  const match = String(value ?? "").match(/-?\d+/);
  const n = match ? Number(match[0]) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    errors.push(`${label} must be a whole number from ${min} to ${max}.`);
    return min;
  }
  return n;
}

function list(value, label, errors, min, max) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be a list.`);
    return [];
  }
  if (value.length < min || value.length > max) errors.push(`${label} needs ${min} to ${max} items.`);
  return value.slice(0, max);
}

function imageKey(value, label, images, errors) {
  if (!value) return "";
  if (!images[value]) errors.push(`${label}: unknown image "${value}". Upload it in Media first.`);
  return value;
}

function videoName(value, label, errors) {
  if (!value) return "";
  if (!NAME_RE.test(value)) errors.push(`${label} must be an .mp4 or .webm file name from Media.`);
  else if (!fs.existsSync(path.join(config.mediaDir, value))) errors.push(`${label}: "${value}" is not in Media.`);
  return value;
}

// Each validator returns { value, errors }. The value is the cleaned section, ready to write.
export function validateSection(name, input, data) {
  const errors = [];
  const images = data.images || {};
  if (name === "hero") {
    const h = input || {};
    const value = {
      ...data.hero,
      eyebrow: str(h.eyebrow, 60, "Eyebrow", errors),
      title: str(h.title, 140, "Title", errors, { required: true }),
      lede: str(h.lede, 400, "Lead text", errors),
      primary: { ...(data.hero?.primary || {}), label: str(h.primary?.label, 40, "Primary button label", errors), href: href(h.primary?.href, "Primary button link", errors) },
      secondary: { ...(data.hero?.secondary || {}), label: str(h.secondary?.label, 40, "Secondary button label", errors), href: href(h.secondary?.href, "Secondary button link", errors) },
    };
    return { value, errors };
  }
  if (name === "promos") {
    const items = list(input, "Hero slides", errors, 1, 8).map((s, i) => {
      const label = `Slide ${i + 1}`;
      const video = videoName(s.video, `${label} video`, errors);
      const image = imageKey(s.image, `${label} image`, images, errors);
      if (!video && !image) errors.push(`${label} needs an image or a video.`);
      return {
        ...(data.promos?.[i] || {}),
        image,
        video,
        tag: str(s.tag, 20, `${label} tag`, errors),
        kicker: str(s.kicker, 60, `${label} kicker`, errors),
        title: str(s.title, 120, `${label} title`, errors, { required: true }),
        text: str(s.text, 300, `${label} text`, errors),
        cta: { label: str(s.cta?.label, 40, `${label} button`, errors), href: href(s.cta?.href, `${label} button link`, errors) },
        cta2: { label: str(s.cta2?.label, 40, `${label} second button`, errors), href: href(s.cta2?.href, `${label} second button link`, errors) },
      };
    });
    return { value: items, errors };
  }
  if (name === "contacts") {
    const phones = list(input, "Phone numbers", errors, 1, 6).map((p, i) => {
      const label = `Contact ${i + 1}`;
      const number = str(p.number, 40, `${label} number`, errors, { required: true });
      const tel = str(p.tel, 16, `${label} dialling number`, errors, { required: true });
      if (tel && !TEL_RE.test(tel)) errors.push(`${label}: dialling number must look like +96812345678.`);
      return { label: str(p.label, 40, `${label} label`, errors), number, tel, whatsapp: p.whatsapp === true };
    });
    if (!phones.some((p) => p.whatsapp)) errors.push("Turn WhatsApp on for one number. It drives the WhatsApp button on every page.");
    return { value: phones, errors };
  }
  if (name === "buildings") {
    const items = list(input, "Buildings", errors, 1, 20).map((b, i) => {
      const label = b.name ? `Building "${b.name}"` : `Building ${i + 1}`;
      return {
        ...(data.buildings?.items?.[i] || {}),
        name: str(b.name, 80, `${label} name`, errors, { required: true }),
        area: str(b.area, 80, `${label} area`, errors),
        floors: int(b.floors, `${label} floors`, errors, 1, 60),
        units: int(b.units, `${label} units`, errors, 0, 5000),
        status: str(b.status, 40, `${label} status`, errors),
        text: str(b.text, 400, `${label} description`, errors),
        image: imageKey(b.image, `${label} photo`, images, errors),
        flats: list(b.flats || [], `${label} flats`, errors, 0, 12).map((f) => {
          const flatLabel = `${label}, ${f.type || "flat"}`;
          const rent = int(f.rent, `${flatLabel} rent (OMR per month)`, errors, 0, 10000);
          return {
            type: str(f.type, 20, `${flatLabel} type`, errors, { required: true }),
            size: `${int(f.size, `${flatLabel} size (sqm)`, errors, 1, 2000)} sqm`,
            rent: `OMR ${rent}`,
            image: imageKey(f.image, `${flatLabel} photo`, images, errors),
            href: href(f.href || "contact.html", `${flatLabel} link`, errors),
          };
        }),
      };
    });
    return { value: { ...(data.buildings || {}), items }, errors };
  }
  throw new Error(`Unknown section ${name}`);
}

export function readData() {
  return JSON.parse(fs.readFileSync(config.dataFile, "utf-8"));
}

function applySection(data, name, value) {
  if (name === "hero") return { ...data, hero: value };
  if (name === "promos") return { ...data, promos: value };
  if (name === "contacts") return { ...data, contact: { ...(data.contact || {}), phones: value } };
  if (name === "buildings") return { ...data, buildings: value };
  return data;
}

// Writes the new file atomically, keeps the previous version in data/history/, and rebuilds the site.
// If the build fails, the previous file is put back and the editor sees the build error.
let queue = Promise.resolve();
export function saveSection(name, input, actor) {
  const run = queue.then(() => doSave(name, input, actor));
  queue = run.catch(() => {});
  return run;
}

async function doSave(name, input, actor) {
  const current = readData();
  const { value, errors } = validateSection(name, input, current);
  if (errors.length) return { ok: false, errors };

  const previousText = fs.readFileSync(config.dataFile, "utf-8");
  fs.mkdirSync(config.historyDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(config.historyDir, `${stamp}-${name}.json`), previousText, { mode: 0o600 });

  const next = applySection(current, name, value);
  const tmp = `${config.dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, config.dataFile);

  const build = await runBuild();
  if (!build.ok) {
    fs.writeFileSync(config.dataFile, previousText, "utf-8");
    return { ok: false, errors: ["The site did not build, so the change was not published.", build.log.slice(-600)] };
  }
  return { ok: true, published: true, actor };
}

// Republish without changing data (used after uploads and by the "Publish" button).
export function publishNow() {
  const run = queue.then(() => runBuild());
  queue = run.catch(() => {});
  return run;
}

export function runBuild() {
  return new Promise((resolve) => {
    const child = spawn(config.python, ["build/build.py"], {
      cwd: REPO_ROOT,
      env: { ...process.env, ONLY: config.siteSlug },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 240_000);
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, log });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, log: String(err.message) });
    });
  });
}

// An uploaded photo becomes a named image the buildings and slides can use. This writes the image
// entry and republishes, so the site shows the photo as soon as the upload succeeds.
export function registerUploadedImage(stored, actor) {
  const run = queue.then(() => doRegister(stored, actor));
  queue = run.catch(() => {});
  return run;
}

async function doRegister(stored, actor) {
  const current = readData();
  const previousText = fs.readFileSync(config.dataFile, "utf-8");
  const next = {
    ...current,
    images: { ...(current.images || {}), [stored.key]: current.images?.[stored.key] || { src: stored.name, alt: "", cap: "" } },
  };
  fs.writeFileSync(`${config.dataFile}.tmp`, JSON.stringify(next, null, 2) + "\n", "utf-8");
  fs.renameSync(`${config.dataFile}.tmp`, config.dataFile);
  const build = await runBuild();
  if (!build.ok) {
    fs.writeFileSync(config.dataFile, previousText, "utf-8");
    return { ok: false, errors: ["The photo was saved, but the site did not rebuild.", build.log.slice(-600)] };
  }
  return { ok: true, actor };
}
