#!/usr/bin/env python3
"""Creative platform, prototype P1: brief + photos in, Towers-style film out.

  python3 platform/server.py            # http://127.0.0.1:8095  (set PLATFORM_HOST to expose)

Prototype limits (see briefs/platform/PRODUCT-SPEC.md):
- no Google sign-in yet (P2); local use only, bound to 127.0.0.1 by default
- renders the deterministic film only; generated video needs a provider key (P3)
- API keys are read from the environment and never returned to the browser
"""
import base64
import json
import os
import re
import sys
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from queue import Queue
import subprocess

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import render  # noqa: E402

OUT = HERE / "outputs"
OUT.mkdir(exist_ok=True)
MAX_BYTES = 15 * 1024 * 1024
ALLOWED = {"jpg", "jpeg", "png", "webp"}
KEYS = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY", "GOOGLE_OAUTH_CLIENT_ID"]
jobs, lock, work = {}, threading.Lock(), Queue()


def save_job(job):
    (OUT / job["id"]).mkdir(exist_ok=True)
    (OUT / job["id"] / "job.json").write_text(json.dumps(job, indent=1, ensure_ascii=False), encoding="utf-8")


def worker():
    while True:
        jid = work.get()
        job = jobs[jid]
        try:
            d = OUT / jid
            job.update(status="running", stage="intake", pct=0.0)
            save_job(job)
            probes = []
            for name in job["inputs"]:
                res = subprocess.run([sys.executable, str(HERE.parent / "tools" / "intake_media.py"), "probe", str(d / name)],
                                     capture_output=True, text=True, check=True)
                probes.append({"file": name, **json.loads(res.stdout)})
            job["probes"] = probes
            site = d / job["inputs"][0]
            finished = d / job["inputs"][1] if len(job["inputs"]) > 1 else site
            logo = os.environ.get("TOWERS_LOGO_PNG")
            job.update(stage="render")
            save_job(job)

            def progress(p):
                job.update(pct=round(p, 3))

            render.render_film(str(site), str(finished), d / "film.mp4", logo_png=logo, progress=progress)
            job.update(status="done", stage="done", pct=1.0, video=f"/files/{jid}/film.mp4",
                       single_photo=len(job["inputs"]) == 1, logo=bool(logo))
        except Exception as exc:  # shown in plain words; the traceback goes to the server log
            job.update(status="failed", error=str(exc)[:300])
            print(f"job {jid} failed:\n{traceback.format_exc()}", file=sys.stderr, flush=True)
        finally:
            save_job(job)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else (json.dumps(body, ensure_ascii=False).encode() if ctype == "application/json" else body.encode())
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") or ctype == "application/json" else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            return self._send(200, (HERE / "index.html").read_bytes(), "text/html")
        if path == "/api/status":
            return self._send(200, {"keys": {k: bool(os.environ.get(k)) for k in KEYS},
                                    "logo": bool(os.environ.get("TOWERS_LOGO_PNG")), "sign_in": "not enabled (P2)"})
        if path == "/api/jobs":
            with lock:
                items = sorted(jobs.values(), key=lambda j: j["created"], reverse=True)
            return self._send(200, {"jobs": items[:30]})
        m = re.fullmatch(r"/files/([a-f0-9]{12})/(film\.mp4)", path)
        if m and (OUT / m.group(1) / m.group(2)).exists():
            return self._send(200, (OUT / m.group(1) / m.group(2)).read_bytes(), "video/mp4")
        return self._send(404, {"error": "Not found."})

    def do_POST(self):
        if self.path.split("?")[0] != "/api/jobs":
            return self._send(404, {"error": "Not found."})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)).decode("utf-8"))
        except ValueError:
            return self._send(400, {"error": "Send JSON."})
        brief = str(body.get("brief", "")).strip()[:2000]
        files = body.get("files") or []
        if body.get("rights") is not True:
            return self._send(400, {"error": "Confirm that you have the rights to every photo you upload."})
        if not 1 <= len(files) <= 2:
            return self._send(400, {"error": "Upload one photo, or two: the site photo and the finished image."})
        jid = uuid.uuid4().hex[:12]
        d = OUT / jid
        d.mkdir(parents=True)
        names = []
        for i, f in enumerate(files, 1):
            ext = str(f.get("name", "")).rsplit(".", 1)[-1].lower()
            if ext not in ALLOWED:
                return self._send(400, {"error": "Photos must be JPG, PNG or WebP."})
            raw = base64.b64decode(f.get("data", "").split(",")[-1], validate=True)
            if len(raw) > MAX_BYTES:
                return self._send(400, {"error": "Each photo must be 15 MB or less."})
            name = f"input{i}.{ext}"
            (d / name).write_bytes(raw)
            names.append(name)
        job = {"id": jid, "brief": brief, "inputs": names, "status": "queued", "stage": "queued", "pct": 0.0,
               "created": time.time(), "rights_confirmed": True}
        with lock:
            jobs[jid] = job
        save_job(job)
        work.put(jid)
        return self._send(202, job)


if __name__ == "__main__":
    for i, p in enumerate(OUT.glob("*/job.json")):
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
            if j.get("status") in ("queued", "running"):
                j.update(status="failed", error="The server restarted before this job finished.")
            jobs[j["id"]] = j
        except ValueError:
            pass
    threading.Thread(target=worker, daemon=True).start()
    host = os.environ.get("PLATFORM_HOST", "127.0.0.1")
    port = int(os.environ.get("PLATFORM_PORT", "8095"))
    print(f"platform prototype on http://{host}:{port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
