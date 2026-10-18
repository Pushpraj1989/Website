#!/usr/bin/env python3
"""Contact-form enquiries for kit sites: validate, store, and email them.

Standard library only. Runs behind nginx at /enquiry/ (see deploy/install.sh).

Environment (set in /etc/tier1-enquiry.env, never in the repo):
  ENQUIRY_DIR     where enquiries are stored (default /var/lib/tier1-enquiry)
  ENQUIRY_TO      comma-separated recipients, e.g. the company's sales inbox
  SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, ENQUIRY_FROM
  ENQUIRY_PORT    default 8788, bound to 127.0.0.1

Every enquiry is saved to enquiries.jsonl (mode 600) first. Email is sent when SMTP and ENQUIRY_TO
are set; if sending fails, the enquiry stays saved and the visitor still gets a thank-you.
The visitor's IP is stored only as a salted hash. A hidden honeypot field catches simple bots.
"""
import hashlib
import json
import os
import re
import smtplib
import ssl
import sys
import threading
import time
from datetime import datetime, timezone
from email import message_from_bytes, policy
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DATA = Path(os.environ.get("ENQUIRY_DIR", "/var/lib/tier1-enquiry"))
SALT = os.environ.get("ENQUIRY_SALT", "change-me")
WINDOW, MAX_PER_WINDOW = 600, 5
MAX_BODY = 32_000
SLUG = re.compile(r"^[a-z0-9-]{2,60}$")
hits, lock = {}, threading.Lock()


def clean(v, limit):
    return re.sub(r"[\x00-\x08\x0b-\x1f]", "", str(v or "")).strip()[:limit]


def rate_limited(key):
    now = time.time()
    with lock:
        recent = [t for t in hits.get(key, []) if now - t < WINDOW]
        recent.append(now)
        hits[key] = recent
        return len(recent) > MAX_PER_WINDOW


def parse_fields(raw, content_type):
    if content_type.startswith("application/x-www-form-urlencoded"):
        from urllib.parse import parse_qs
        return {k: v[0] for k, v in parse_qs(raw.decode("utf-8", "replace")).items()}
    if content_type.startswith("multipart/form-data"):
        msg = message_from_bytes(b"Content-Type: " + content_type.encode() + b"\r\nMIME-Version: 1.0\r\n\r\n" + raw,
                                 policy=policy.default)
        out = {}
        for part in msg.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if name and part.get_filename() is None:
                out[name] = part.get_content()
        return out
    raise ValueError("send the form as form data")


def validate(f):
    site = clean(f.get("site"), 60)
    if not SLUG.match(site):
        raise ValueError("unknown site")
    name = clean(f.get("name"), 80)
    contact = clean(f.get("contact"), 120)
    topic = clean(f.get("topic"), 80) or "General"
    message = clean(f.get("message"), 1000)
    if len(name) < 2:
        raise ValueError("Please enter your name.")
    if "@" in contact:
        if not re.fullmatch(r"\S+@\S+\.\S+", contact):
            raise ValueError("Enter a valid email address.")
    elif not re.fullmatch(r"\+?[\d\s-]{7,}", contact):
        raise ValueError("Enter an email address or phone number.")
    return {"site": site, "name": name, "contact": contact, "topic": topic, "message": message,
            "lang": clean(f.get("lang"), 5) or "en", "page": clean(f.get("page"), 200)}


def store(item, ip):
    DATA.mkdir(parents=True, exist_ok=True)
    rec = dict(item, at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
               ip_hash=hashlib.sha256((SALT + ip).encode()).hexdigest()[:16])
    path = DATA / "enquiries.jsonl"
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec


def email_it(rec):
    host, to = os.environ.get("SMTP_HOST"), os.environ.get("ENQUIRY_TO")
    if not host or not to:
        return "saved"
    msg = EmailMessage()
    msg["Subject"] = f"New enquiry: {rec['topic']} · {rec['site']}"
    msg["From"] = os.environ.get("ENQUIRY_FROM") or os.environ.get("SMTP_USER", "")
    msg["To"] = to
    if "@" in rec["contact"]:
        msg["Reply-To"] = rec["contact"]
    msg.set_content("\n".join([
        f"Site: {rec['site']} ({rec['lang']})", f"Topic: {rec['topic']}", f"Name: {rec['name']}",
        f"Contact: {rec['contact']}", f"Page: {rec['page']}", "", rec["message"] or "(no message)"]))
    try:
        with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=20) as s:
            s.starttls(context=ssl.create_default_context())
            if os.environ.get("SMTP_USER"):
                s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
            s.send_message(msg)
        return "emailed"
    except Exception as exc:  # the enquiry is already saved; the team can read it from the file
        print(f"email failed: {exc}", file=sys.stderr, flush=True)
        return "saved"


class Handler(BaseHTTPRequestHandler):
    server_version = "tier1-enquiry"

    def log_message(self, fmt, *args):
        print("%s %s" % (self.address_string(), fmt % args), flush=True)

    def send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
        if rate_limited(ip):
            return self.send(429, {"error": "Too many messages. Please try again later."})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                return self.send(413, {"error": "The form is too large."})
            fields = parse_fields(self.rfile.read(n), self.headers.get("Content-Type", ""))
            if clean(fields.get("website"), 200):  # honeypot: humans never fill it
                return self.send(202, {"ok": True})
            item = validate(fields)
        except ValueError as exc:
            return self.send(400, {"error": str(exc)})
        rec = store(item, ip)
        status = email_it(rec)
        self.send(202, {"ok": True, "status": status})


def main():
    port = int(os.environ.get("ENQUIRY_PORT", "8788"))
    print(f"enquiry api on 127.0.0.1:{port}, storing in {DATA}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
