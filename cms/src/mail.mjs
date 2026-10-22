import fs from "node:fs";
import path from "node:path";
import { CMS_DIR, config } from "./config.mjs";

// Sends through SMTP when configured. Without SMTP (local testing) the message goes to data/outbox.log,
// so the invite and reset links can still be read by the person running the CMS.
let transport = null;

async function getTransport() {
  if (transport) return transport;
  const { default: nodemailer } = await import("nodemailer");
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport;
}

export async function sendMail({ to, subject, text }) {
  if (config.smtp) {
    await (await getTransport()).sendMail({ from: config.smtp.from, to, subject, text });
    return "smtp";
  }
  const file = path.join(CMS_DIR, "data", "outbox.log");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `\n--- ${new Date().toISOString()} to ${to}: ${subject}\n${text}\n`, { mode: 0o600 });
  return "outbox";
}
