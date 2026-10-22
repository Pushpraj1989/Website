import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CMS_DIR, config } from "./config.mjs";
import { audit, openDb } from "./db.mjs";
import { mailLinkText } from "./links.mjs";
import { sendMail } from "./mail.mjs";
import { MEDIA_NAME, checkUpload, listMedia, maxUploadBytes, readBody, registerImage, storeUpload } from "./media.mjs";
import { SECTIONS, publishNow, readData, registerUploadedImage, saveSection } from "./content.mjs";
import {
  DUMMY_HASH, checkPassword, hashPassword, newTotpSecret, randomToken, rateLimiter, sha256, verifyPassword, verifyTotp,
} from "./security.mjs";

const db = openDb(config.dbFile);
const PUBLIC = path.join(CMS_DIR, "public");
const ORIGIN = new URL(config.publicUrl).origin;
const LOGIN_LOCK_MS = 15 * 60_000;
const MAX_FAILURES = 5;

const loginByIp = rateLimiter({ windowMs: 15 * 60_000, max: 30 });
const forgotByIp = rateLimiter({ windowMs: 60 * 60_000, max: 6 });

const ADMIN_CSP = [
  "default-src 'self'", "img-src 'self' data: blob:", "media-src 'self' blob:", "style-src 'self'",
  "script-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'none'",
  "form-action 'self'", "object-src 'none'",
].join("; ");

function baseHeaders(extra = {}) {
  const h = {
    "Content-Security-Policy": ADMIN_CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
    ...extra,
  };
  if (config.cookieSecure) h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  return h;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, baseHeaders(headers));
  res.end(body);
}

const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
const fail = (res, status, message, extra = {}) => json(res, status, { ok: false, error: message, ...extra });

function clientIp(req) {
  // Behind nginx on the same host the real client is in X-Forwarded-For. Trust only the first hop.
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "unknown";
}

async function readJson(req, max = 64 * 1024) {
  const raw = await readBody(req, max);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf-8"));
  } catch {
    throw Object.assign(new Error("Bad request."), { status: 400 });
  }
}

function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "").split(";").map((c) => c.trim()).filter(Boolean).map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    }),
  );
}

function sessionCookie(token, maxAgeSec) {
  return `cms_sid=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${config.cookieSecure ? "; Secure" : ""}`;
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, totp_enabled: !!u.totp_enabled };
}

function currentSession(req) {
  const token = cookies(req).cms_sid;
  if (!token) return null;
  const row = db.prepare(`SELECT s.*, u.id AS uid, u.email, u.name, u.role, u.totp_enabled, u.disabled
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha256(token));
  if (!row) return null;
  const now = Date.now();
  const expired = now - row.created_at > config.sessionHours * 3600_000 || now - row.last_seen > config.idleMinutes * 60_000;
  if (expired || row.disabled) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    return null;
  }
  db.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ?").run(now, sha256(token));
  return { token, csrf: row.csrf, user: { id: row.uid, email: row.email, name: row.name, role: row.role, totp_enabled: !!row.totp_enabled } };
}

function requireUser(req, res, { role } = {}) {
  const session = currentSession(req);
  if (!session) {
    fail(res, 401, "Sign in to continue.");
    return null;
  }
  if (role === "admin" && session.user.role !== "admin") {
    fail(res, 403, "Only an administrator can do that.");
    return null;
  }
  return session;
}

// Every state-changing request must come from this site and carry the session's CSRF token.
function csrfOk(req, session) {
  const origin = req.headers.origin;
  if (origin && origin !== ORIGIN) return false;
  const sent = String(req.headers["x-csrf-token"] || "");
  return !!session && sent.length === session.csrf.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(session.csrf));
}

function startSession(res, userId) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const now = Date.now();
  db.prepare("INSERT INTO sessions (token_hash, user_id, csrf, created_at, last_seen) VALUES (?, ?, ?, ?, ?)").run(sha256(token), userId, csrf, now, now);
  res.setHeader("Set-Cookie", sessionCookie(token, config.sessionHours * 3600));
  return csrf;
}

function endAllSessions(userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

// ---- auth -----------------------------------------------------------------------------------

async function login(req, res) {
  if (!loginByIp.take(clientIp(req))) return fail(res, 429, "Too many sign-in attempts. Try again later.");
  const body = await readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const now = Date.now();
  // Same message for every failure, and a hash check even for unknown emails, so attackers learn nothing.
  const generic = () => fail(res, 401, "Email or password is wrong.");

  if (!user) {
    verifyPassword(password, DUMMY_HASH);
    return generic();
  }
  if (user.disabled || user.locked_until > now) {
    audit(db, email, "login_blocked", user.disabled ? "disabled" : "locked");
    verifyPassword(password, DUMMY_HASH);
    return generic();
  }
  if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
    const failures = user.failed_logins + 1;
    const lock = failures >= MAX_FAILURES ? now + LOGIN_LOCK_MS : 0;
    db.prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?").run(lock ? 0 : failures, lock, user.id);
    audit(db, email, "login_failed", `attempt ${failures}`);
    return generic();
  }
  if (user.totp_enabled) {
    if (!body.code) return json(res, 200, { ok: true, needs_code: true });
    if (!verifyTotp(user.totp_secret, String(body.code))) {
      db.prepare("UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ?").run(user.id);
      audit(db, email, "login_failed", "wrong 2FA code");
      return generic();
    }
  }
  db.prepare("UPDATE users SET failed_logins = 0, locked_until = 0, last_login = ? WHERE id = ?").run(now, user.id);
  const csrf = startSession(res, user.id);
  audit(db, email, "login", "");
  return json(res, 200, { ok: true, csrf, user: publicUser(user) });
}

async function forgot(req, res) {
  const body = await readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const ip = clientIp(req);
  const reply = () => json(res, 200, { ok: true, message: "If that email has an account, a reset link is on its way." });
  if (!forgotByIp.take(ip) || !forgotByIp.take(`email:${email}`)) return fail(res, 429, "Too many requests. Try again later.");
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND disabled = 0").get(email);
  if (!user) return reply();
  const token = randomToken(32);
  db.prepare("INSERT INTO one_time_tokens (token_hash, purpose, email, user_id, expires_at) VALUES (?, 'reset', ?, ?, ?)")
    .run(sha256(token), email, user.id, Date.now() + 30 * 60_000);
  await sendMail({ to: email, subject: "Reset your CMS password", text: mailLinkText("reset", token, config.publicUrl) });
  audit(db, email, "password_reset_requested", ip);
  return reply();
}

async function resetPassword(req, res) {
  const body = await readJson(req);
  const row = db.prepare("SELECT * FROM one_time_tokens WHERE token_hash = ? AND purpose = 'reset'").get(sha256(String(body.token || "")));
  if (!row || row.used_at || row.expires_at < Date.now()) return fail(res, 400, "This reset link has expired. Ask for a new one.");
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id);
  if (!user || user.disabled) return fail(res, 400, "This reset link has expired. Ask for a new one.");
  const problem = checkPassword(String(body.password || ""), user.email);
  if (problem) return fail(res, 400, problem);
  db.prepare("UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?").run(hashPassword(body.password), user.id);
  db.prepare("UPDATE one_time_tokens SET used_at = ? WHERE token_hash = ?").run(Date.now(), row.token_hash);
  endAllSessions(user.id);
  audit(db, user.email, "password_reset", "");
  return json(res, 200, { ok: true });
}

async function acceptInvite(req, res) {
  const body = await readJson(req);
  const row = db.prepare("SELECT * FROM one_time_tokens WHERE token_hash = ? AND purpose = 'invite'").get(sha256(String(body.token || "")));
  if (!row || row.used_at || row.expires_at < Date.now()) return fail(res, 400, "This invitation has expired. Ask an administrator for a new one.");
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(row.email)) return fail(res, 409, "An account for this email already exists. Sign in instead.");
  const name = String(body.name || "").trim().slice(0, 80);
  if (!name) return fail(res, 400, "Enter your name.");
  const problem = checkPassword(String(body.password || ""), row.email);
  if (problem) return fail(res, 400, problem);
  const info = db.prepare("INSERT INTO users (email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(row.email, name, row.role, hashPassword(body.password), Date.now());
  db.prepare("UPDATE one_time_tokens SET used_at = ? WHERE token_hash = ?").run(Date.now(), row.token_hash);
  audit(db, row.email, "invite_accepted", row.role);
  return json(res, 201, { ok: true, user_id: Number(info.lastInsertRowid) });
}

async function totpSetup(req, res, session) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user.id);
  if (user.totp_enabled) return fail(res, 409, "Two-step sign-in is already on.");
  const secret = newTotpSecret();
  db.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(secret, user.id);
  const label = encodeURIComponent(`Azaiba CMS:${user.email}`);
  return json(res, 200, { ok: true, secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=Azaiba%20CMS` });
}

async function totpEnable(req, res, session) {
  const body = await readJson(req);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user.id);
  if (!user.totp_secret || !verifyTotp(user.totp_secret, String(body.code || ""))) return fail(res, 400, "That code is not right. Check the time on your phone and try again.");
  db.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(user.id);
  audit(db, user.email, "2fa_enabled", "");
  return json(res, 200, { ok: true });
}

async function totpDisable(req, res, session) {
  const body = await readJson(req);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user.id);
  if (!verifyPassword(String(body.password || ""), user.password_hash)) return fail(res, 400, "Password is wrong.");
  db.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?").run(user.id);
  audit(db, user.email, "2fa_disabled", "");
  return json(res, 200, { ok: true });
}

async function changePassword(req, res, session) {
  const body = await readJson(req);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user.id);
  if (!verifyPassword(String(body.current || ""), user.password_hash)) return fail(res, 400, "Current password is wrong.");
  const problem = checkPassword(String(body.password || ""), user.email);
  if (problem) return fail(res, 400, problem);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(body.password), user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(user.id, sha256(session.token));
  audit(db, user.email, "password_changed", "");
  return json(res, 200, { ok: true });
}

// ---- users (administrators) --------------------------------------------------------------------

async function inviteUser(req, res, session) {
  const body = await readJson(req);
  const email = String(body.email || "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "editor";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return fail(res, 400, "Enter a valid email address.");
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return fail(res, 409, "That email already has an account.");
  const token = randomToken(32);
  db.prepare("INSERT INTO one_time_tokens (token_hash, purpose, email, role, expires_at) VALUES (?, 'invite', ?, ?, ?)")
    .run(sha256(token), email, role, Date.now() + 72 * 3600_000);
  const sent = await sendMail({ to: email, subject: "You are invited to the site content manager", text: mailLinkText("invite", token, config.publicUrl) });
  audit(db, session.user.email, "invite_sent", `${email} as ${role}`);
  return json(res, 201, { ok: true, sent });
}

function listUsers(res) {
  const rows = db.prepare("SELECT id, email, name, role, totp_enabled, disabled, last_login FROM users ORDER BY email").all();
  json(res, 200, { ok: true, users: rows.map((r) => ({ ...r, totp_enabled: !!r.totp_enabled, disabled: !!r.disabled })) });
}

async function changeUser(req, res, session, id, action) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) return fail(res, 404, "No such user.");
  if (user.id === session.user.id && action !== "reset") return fail(res, 400, "You cannot change your own access here.");
  const body = await readJson(req);
  const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0").get().n;

  if (action === "role") {
    const role = body.role === "admin" ? "admin" : "editor";
    if (user.role === "admin" && role === "editor" && admins <= 1) return fail(res, 400, "Keep at least one administrator.");
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  } else if (action === "disable") {
    const disabled = body.disabled === true ? 1 : 0;
    if (disabled && user.role === "admin" && admins <= 1) return fail(res, 400, "Keep at least one administrator.");
    db.prepare("UPDATE users SET disabled = ? WHERE id = ?").run(disabled, id);
    if (disabled) endAllSessions(id);
  } else if (action === "delete") {
    if (user.role === "admin" && admins <= 1) return fail(res, 400, "Keep at least one administrator.");
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  } else if (action === "reset") {
    const token = randomToken(32);
    db.prepare("INSERT INTO one_time_tokens (token_hash, purpose, email, user_id, expires_at) VALUES (?, 'reset', ?, ?, ?)")
      .run(sha256(token), user.email, id, Date.now() + 30 * 60_000);
    await sendMail({ to: user.email, subject: "Reset your CMS password", text: mailLinkText("reset", token, config.publicUrl) });
  } else {
    return fail(res, 404, "Unknown action.");
  }
  audit(db, session.user.email, `user_${action}`, `${user.email}`);
  return json(res, 200, { ok: true });
}

// ---- content ------------------------------------------------------------------------------------

function contentView() {
  const data = readData();
  return {
    ok: true,
    hero: data.hero,
    promos: data.promos,
    contacts: data.contact?.phones || [],
    buildings: data.buildings?.items || [],
    images: Object.fromEntries(Object.entries(data.images || {}).map(([k, v]) => [k, { src: v.src, alt: v.alt || "" }])),
    site: data.name,
    publicUrl: config.publicUrl,
  };
}

async function putSection(req, res, session, section) {
  if (!SECTIONS.includes(section)) return fail(res, 404, "Unknown section.");
  const body = await readJson(req, 256 * 1024);
  const result = await saveSection(section, body.value, session.user.email);
  if (!result.ok) return json(res, 422, { ok: false, errors: result.errors });
  audit(db, session.user.email, "content_saved", section);
  return json(res, 200, { ok: true, published: true });
}

async function publish(res, session) {
  const result = await publishNow();
  audit(db, session.user.email, result.ok ? "published" : "publish_failed", "");
  return result.ok ? json(res, 200, { ok: true }) : fail(res, 500, "The site did not build.", { log: result.log.slice(-600) });
}

async function uploadMedia(req, res, session) {
  const type = req.headers["content-type"] || "";
  const bytes = await readBody(req, maxUploadBytes());
  const kind = checkUpload(type, bytes);
  const stored = storeUpload(bytes, kind);
  let published = false;
  if (stored.kind === "image") {
    const result = await registerUploadedImage(stored, session.user.email);
    if (!result.ok) return json(res, 422, { ok: false, errors: result.errors });
    published = true;
  }
  audit(db, session.user.email, "media_uploaded", stored.name);
  return json(res, 201, { ok: true, ...stored, published });
}

function serveMedia(res, name) {
  if (!MEDIA_NAME.test(name)) return fail(res, 404, "Not found.");
  const file = path.join(config.mediaDir, name);
  if (path.dirname(file) !== config.mediaDir || !fs.existsSync(file)) return fail(res, 404, "Not found.");
  const ext = path.extname(name).slice(1).toLowerCase();
  const types = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm" };
  send(res, 200, fs.readFileSync(file), { "Content-Type": types[ext], "Cache-Control": "private, max-age=3600" });
}

// ---- static admin -------------------------------------------------------------------------------

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function serveAdmin(res, pathname) {
  const rel = pathname === "/admin" || pathname === "/admin/" ? "index.html" : pathname.replace(/^\/admin\//, "");
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || !TYPES[path.extname(file)] || !fs.existsSync(file)) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
  send(res, 200, fs.readFileSync(file), { "Content-Type": TYPES[path.extname(file)] });
}

// ---- router -----------------------------------------------------------------------------------

async function route(req, res) {
  const url = new URL(req.url, config.publicUrl);
  const p = url.pathname;
  const m = req.method;

  if (p === "/" && m === "GET") return send(res, 302, "", { Location: "/admin/" });
  if (p.startsWith("/admin") && m === "GET") return serveAdmin(res, p);

  if (p.startsWith("/api/media/file/") && m === "GET") {
    if (!currentSession(req)) return fail(res, 401, "Sign in to continue.");
    return serveMedia(res, decodeURIComponent(p.slice("/api/media/file/".length)));
  }

  if (p === "/api/auth/login" && m === "POST") return login(req, res);
  if (p === "/api/auth/forgot" && m === "POST") return forgot(req, res);
  if (p === "/api/auth/reset" && m === "POST") return resetPassword(req, res);
  if (p === "/api/auth/accept-invite" && m === "POST") return acceptInvite(req, res);

  if (p === "/api/me" && m === "GET") {
    const session = currentSession(req);
    if (!session) return fail(res, 401, "Sign in to continue.");
    return json(res, 200, { ok: true, csrf: session.csrf, user: session.user });
  }

  // Everything below needs a session. Changing requests also need the CSRF token.
  const session = requireUser(req, res);
  if (!session) return;
  if (m !== "GET" && !csrfOk(req, session)) return fail(res, 403, "Your session expired. Reload the page and try again.");

  if (p === "/api/auth/logout" && m === "POST") {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(session.token));
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return json(res, 200, { ok: true });
  }
  if (p === "/api/auth/totp/setup" && m === "POST") return totpSetup(req, res, session);
  if (p === "/api/auth/totp/enable" && m === "POST") return totpEnable(req, res, session);
  if (p === "/api/auth/totp/disable" && m === "POST") return totpDisable(req, res, session);
  if (p === "/api/account/password" && m === "POST") return changePassword(req, res, session);

  if (p === "/api/content" && m === "GET") return json(res, 200, contentView());
  const section = p.match(/^\/api\/content\/([a-z]+)$/);
  if (section && m === "PUT") return putSection(req, res, session, section[1]);
  if (p === "/api/publish" && m === "POST") return publish(res, session);

  if (p === "/api/media" && m === "GET") return json(res, 200, { ok: true, files: listMedia(readData()) });
  if (p === "/api/media" && m === "POST") return uploadMedia(req, res, session);

  if (p === "/api/users" && m === "GET") {
    if (session.user.role !== "admin") return fail(res, 403, "Only an administrator can do that.");
    return listUsers(res);
  }
  if (p === "/api/users/invite" && m === "POST") {
    if (session.user.role !== "admin") return fail(res, 403, "Only an administrator can do that.");
    return inviteUser(req, res, session);
  }
  const userAction = p.match(/^\/api\/users\/(\d+)\/(role|disable|delete|reset)$/);
  if (userAction && m === "POST") {
    if (session.user.role !== "admin") return fail(res, 403, "Only an administrator can do that.");
    return changeUser(req, res, session, Number(userAction[1]), userAction[2]);
  }
  if (p === "/api/audit" && m === "GET") {
    if (session.user.role !== "admin") return fail(res, 403, "Only an administrator can do that.");
    return json(res, 200, { ok: true, rows: db.prepare("SELECT at, actor, action, detail FROM audit ORDER BY id DESC LIMIT 200").all() });
  }

  return fail(res, 404, "Not found.");
}

export const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error("cms error:", err);
    if (!res.headersSent) fail(res, status, status === 500 ? "Something went wrong. Try again." : err.message);
  }
});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  server.listen(config.port, config.host, () => console.log(`CMS on http://${config.host}:${config.port}/admin/`));
}
