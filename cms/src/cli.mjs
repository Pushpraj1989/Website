// Command line, run on the server:
//   node src/cli.mjs invite you@example.com admin     first administrator, prints a one-time link
//   node src/cli.mjs invite you@example.com editor
import crypto from "node:crypto";
import { config } from "./config.mjs";
import { audit, openDb } from "./db.mjs";
import { linkFor } from "./links.mjs";
import { sha256 } from "./security.mjs";

const [, , command, email, roleArg] = process.argv;
if (command !== "invite" || !email) {
  console.error("Usage: node src/cli.mjs invite <email> [admin|editor]");
  process.exit(1);
}
const role = roleArg === "admin" ? "admin" : "editor";
const db = openDb(config.dbFile);
const token = crypto.randomBytes(32).toString("base64url");
db.prepare("INSERT INTO one_time_tokens (token_hash, purpose, email, role, expires_at) VALUES (?, 'invite', ?, ?, ?)")
  .run(sha256(token), email.trim().toLowerCase(), role, Date.now() + 72 * 3600_000);
audit(db, "cli", "invite_created", `${email} as ${role}`);
console.log(`Invitation for ${email} (${role}). Open once within 72 hours:\n${linkFor("invite", token, config.publicUrl)}`);
