import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CMS_DIR = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(CMS_DIR, "..");

const env = process.env;

export const config = {
  host: env.CMS_HOST || "127.0.0.1",
  port: Number(env.CMS_PORT || 8800),
  publicUrl: (env.CMS_PUBLIC_URL || "http://localhost:8800").replace(/\/$/, ""),
  dbFile: env.CMS_DB || path.join(CMS_DIR, "data", "cms.sqlite"),
  siteSlug: env.CMS_SITE || "azaiba-gardens",
  dataFile: env.CMS_DATA || path.join(REPO_ROOT, "data", "azaiba-gardens.json"),
  historyDir: path.join(CMS_DIR, "data", "history"),
  mediaDir: path.join(REPO_ROOT, "shared", "img", env.CMS_IMG_DIR || "azaiba-gardens"),
  python: env.CMS_PYTHON || "python3",
  // Secure cookies are the default. Set CMS_COOKIE_SECURE=false only for plain-http local testing.
  cookieSecure: env.CMS_COOKIE_SECURE !== "false",
  sessionHours: 8,
  idleMinutes: 60,
  smtp: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: env.SMTP_SECURE === "true",
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM || env.SMTP_USER,
      }
    : null,
};
