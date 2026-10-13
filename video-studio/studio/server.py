#!/usr/bin/env python3
"""Team video maker: paste a LinkedIn post, get a narrated explainer video.

Environment (set on the server, e.g. in /etc/video-studio.env, never in the repo):
  VIDEO_STUDIO_PASSWORD_HASH   pbkdf2$<iterations>$<salt b64>$<hash b64> (team password)
  ANTHROPIC_API_KEY            Claude writes the scene script from the post
  VIDEO_STUDIO_MODEL           optional model id (default claude-sonnet-5-5)
  VIDEO_STUDIO_HOST / _PORT    default 127.0.0.1:8090 (put nginx in front of it for HTTPS)
  VIDEO_STUDIO_COOKIE_SECURE   set to 1 once the site is served over HTTPS
  CHROMIUM                     optional path to the Chromium executable

Run:  python3 studio/server.py
Only one video renders at a time; others wait in the queue.
"""
import base64
import hashlib
import hmac
import json
import os
import queue
import re
import secrets
import sys
import threading
import time
import traceback
import uuid
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pipeline  # noqa: E402
import script_writer  # noqa: E402

OUT = Path(os.environ.get("VIDEO_STUDIO_OUT", HERE.parent / "outputs"))
OUT.mkdir(parents=True, exist_ok=True)
SESSION_HOURS = 12
LOGIN_WINDOW, LOGIN_MAX = 900, 8          # 8 wrong tries per 15 minutes per address
MAX_POST = 4000

sessions = {}                              # token -> expiry (epoch seconds)
failures = {}                              # address -> [timestamps]
lock = threading.Lock()
jobs = {}                                  # id -> dict (also written to outputs/<id>/job.json)
work = queue.Queue()


def check_password(password):
    stored = os.environ.get("VIDEO_STUDIO_PASSWORD_HASH", "")
    try:
        scheme, iters, salt_b64, hash_b64 = stored.split("$")
        if scheme != "pbkdf2":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(hash_b64)
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iters))
        return hmac.compare_digest(got, expected)
    except (ValueError, TypeError):
        return False


def rate_limited(addr):
    now = time.time()
    with lock:
        recent = [t for t in failures.get(addr, []) if now - t < LOGIN_WINDOW]
        failures[addr] = recent
        return len(recent) >= LOGIN_MAX


def note_failure(addr):
    with lock:
        failures.setdefault(addr, []).append(time.time())


def new_session():
    token = secrets.token_urlsafe(32)
    with lock:
        sessions[token] = time.time() + SESSION_HOURS * 3600
    return token


def valid_session(token):
    if not token:
        return False
    with lock:
        exp = sessions.get(token)
        if exp and exp > time.time():
            return True
        sessions.pop(token, None)
        return False


def save_job(job):
    d = OUT / job["id"]
    d.mkdir(parents=True, exist_ok=True)
    (d / "job.json").write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")


def public_job(job):
    out = {k: job[k] for k in ("id", "title", "status", "stage", "pct", "created", "error") if k in job}
    if job["status"] == "done":
        out["video"] = f"/files/{job['id']}/video.mp4"
        out["cover"] = f"/files/{job['id']}/cover.jpg"
    return out


def worker():
    while True:
        job_id = work.get()
        job = jobs[job_id]
        try:
            job.update(status="running", stage="script", pct=0.0)
            save_job(job)
            script = script_writer.write_script(job["post"], job.get("title") or None)
            job["title"] = job.get("title") or script.get("title", "")[:120]

            def progress(stage, pct):
                job.update(stage=stage, pct=round(float(pct), 3))

            pipeline.run(script, OUT / job_id, progress=progress)
            job.update(status="done", stage="done", pct=1.0)
        except Exception as exc:  # shown to the team in plain words; details stay in the server log
            job.update(status="failed", error=str(exc)[:300] or "The video could not be made.")
            print(f"job {job_id} failed:\n{traceback.format_exc()}", file=sys.stderr, flush=True)
        finally:
            save_job(job)
            work.task_done()


class Handler(BaseHTTPRequestHandler):
    server_version = "VideoStudio"

    def log_message(self, fmt, *args):  # keep the log to errors and job events only
        if int(args[1]) >= 400:
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def _send(self, code, body, ctype="application/json", headers=None):
        data = body if isinstance(body, bytes) else (json.dumps(body).encode() if ctype == "application/json" else body.encode())
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") or ctype == "application/json" else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _token(self):
        raw = self.headers.get("Cookie", "")
        c = SimpleCookie()
        try:
            c.load(raw)
        except Exception:
            return None
        return c["vs_session"].value if "vs_session" in c else None

    def _authed(self):
        return valid_session(self._token())

    def _json_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 20000:
            raise ValueError("send a JSON body of up to 20 KB")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            return self._send(200, (HERE / "team.html").read_bytes(), "text/html")
        if path == "/api/me":
            return self._send(200, {"ok": self._authed()})
        if not self._authed():
            return self._send(401, {"error": "Please sign in with the team password."})
        if path == "/api/jobs":
            items = sorted(jobs.values(), key=lambda j: j["created"], reverse=True)
            return self._send(200, {"jobs": [public_job(j) for j in items[:50]]})
        m = re.fullmatch(r"/api/jobs/([a-z0-9]{12})", path)
        if m and m.group(1) in jobs:
            return self._send(200, public_job(jobs[m.group(1)]))
        m = re.fullmatch(r"/files/([a-z0-9]{12})/(video\.mp4|cover\.jpg)", path)
        if m:
            f = OUT / m.group(1) / m.group(2)
            if f.exists():
                ctype = "video/mp4" if f.suffix == ".mp4" else "image/jpeg"
                return self._send(200, f.read_bytes(), ctype, {"Content-Disposition": f'inline; filename="{m.group(1)}-{f.name}"'})
        return self._send(404, {"error": "Not found."})

    def do_POST(self):
        path = self.path.split("?")[0]
        addr = self.client_address[0]
        if path == "/api/login":
            if rate_limited(addr):
                return self._send(429, {"error": "Too many attempts. Wait 15 minutes and try again."})
            try:
                password = str(self._json_body().get("password", ""))
            except ValueError:
                return self._send(400, {"error": "Bad request."})
            if not check_password(password):
                note_failure(addr)
                time.sleep(1)  # slows guessing down further
                return self._send(401, {"error": "That password is not right."})
            token = new_session()
            secure = "; Secure" if os.environ.get("VIDEO_STUDIO_COOKIE_SECURE") == "1" else ""
            cookie = f"vs_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_HOURS * 3600}{secure}"
            return self._send(200, {"ok": True}, headers={"Set-Cookie": cookie})
        if path == "/api/logout":
            with lock:
                sessions.pop(self._token() or "", None)
            return self._send(200, {"ok": True}, headers={"Set-Cookie": "vs_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"})
        if not self._authed():
            return self._send(401, {"error": "Please sign in with the team password."})
        if path == "/api/jobs":
            try:
                body = self._json_body()
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            post = str(body.get("post", "")).strip()
            if not 40 <= len(post) <= MAX_POST:
                return self._send(400, {"error": f"Paste a post of 40 to {MAX_POST} characters."})
            title = str(body.get("title", "")).strip()[:120]
            job_id = uuid.uuid4().hex[:12]
            job = {"id": job_id, "post": post, "title": title, "status": "queued", "stage": "queued", "pct": 0.0,
                   "created": time.time()}
            jobs[job_id] = job
            save_job(job)
            work.put(job_id)
            return self._send(202, public_job(job))
        return self._send(404, {"error": "Not found."})


def load_jobs():
    for f in OUT.glob("*/job.json"):
        try:
            job = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if job.get("status") in ("queued", "running"):
            job.update(status="failed", error="The server restarted before this video finished. Submit the post again.")
        jobs[job["id"]] = job
        save_job(job)


def main():
    if not os.environ.get("VIDEO_STUDIO_PASSWORD_HASH"):
        sys.exit("Set VIDEO_STUDIO_PASSWORD_HASH first (see the README).")
    load_jobs()
    threading.Thread(target=worker, daemon=True).start()
    host = os.environ.get("VIDEO_STUDIO_HOST", "127.0.0.1")
    port = int(os.environ.get("VIDEO_STUDIO_PORT", "8090"))
    print(f"video studio on http://{host}:{port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
