import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite through Node's built-in driver (Node 22.13+). No native packages to build on the server.
export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
      password_hash TEXT,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_login INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS one_time_tokens (
      token_hash TEXT PRIMARY KEY,
      purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
      email TEXT NOT NULL COLLATE NOCASE,
      role TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS masters (
      kind TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      decimals INTEGER,
      PRIMARY KEY (kind, code)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY,
      at INTEGER NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT ''
    );
  `);
  return db;
}

export function audit(db, actor, action, detail = "") {
  db.prepare("INSERT INTO audit (at, actor, action, detail) VALUES (?, ?, ?, ?)").run(Date.now(), actor, action, String(detail).slice(0, 500));
}
