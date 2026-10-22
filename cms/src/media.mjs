import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.mjs";

const MB = 1024 * 1024;

// Allowed uploads. The file's own bytes must match one of these signatures, so a renamed script
// or HTML file is refused even if its name ends in .jpg or .mp4.
const TYPES = [
  { ext: "jpg", kind: "image", max: 10 * MB, test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", kind: "image", max: 10 * MB, test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", kind: "image", max: 10 * MB, test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { ext: "mp4", kind: "video", max: 200 * MB, test: (b) => b.subarray(4, 8).toString() === "ftyp" },
  { ext: "webm", kind: "video", max: 200 * MB, test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
];

export const MEDIA_NAME = /^[a-z0-9][a-z0-9._-]{0,80}\.(jpg|png|webp|mp4|webm)$/i;

export function maxUploadBytes() {
  return 200 * MB;
}

// Reads the request body into memory with a hard size cap, then checks the bytes.
export function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(Object.assign(new Error("File is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function checkUpload(contentType, bytes) {
  const type = TYPES.find((t) => t.test(bytes) && typeof contentType === "string" && contentType.startsWith(mimeOf(t.ext)));
  if (!type) throw Object.assign(new Error("Upload a JPEG, PNG or WebP photo, or an MP4 or WebM film, with a matching file type."), { status: 415 });
  if (bytes.length > type.max) throw Object.assign(new Error(`That ${type.kind} is larger than ${Math.round(type.max / MB)} MB.`), { status: 413 });
  return type;
}

function mimeOf(ext) {
  return { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm" }[ext];
}

// Stores the file under a name built from its hash, so the same file is never stored twice and
// an upload can never overwrite an existing site image.
export function storeUpload(bytes, type) {
  const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const name = `up-${hash}.${type.ext}`;
  fs.mkdirSync(config.mediaDir, { recursive: true });
  const target = path.join(config.mediaDir, name);
  if (!fs.existsSync(target)) {
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, bytes, { mode: 0o644 });
    fs.renameSync(tmp, target);
  }
  return { name, key: `up-${hash}`, kind: type.kind };
}

export function listMedia(data) {
  const used = new Set();
  const images = data.images || {};
  for (const img of Object.values(images)) used.add(img.src);
  for (const p of data.promos || []) if (p.video) used.add(p.video);
  return fs
    .readdirSync(config.mediaDir)
    .filter((f) => MEDIA_NAME.test(f))
    .sort()
    .map((name) => {
      const key = Object.keys(images).find((k) => images[k].src === name) || null;
      const isVideo = /\.(mp4|webm)$/i.test(name);
      return { name, kind: isVideo ? "video" : "image", imageKey: key, inUse: used.has(name) };
    });
}

// Adds an uploaded photo to the site's image list so buildings and slides can use it.
export function registerImage(data, stored) {
  data.images = data.images || {};
  if (!data.images[stored.key]) data.images[stored.key] = { src: stored.name, alt: "", cap: "" };
  return data;
}
