#!/usr/bin/env python3
"""Local preview with the shop API: serves the repository and forwards /api/ to
server/shop_api.py, the same layout nginx gives on the server.

  python3 server/shop_api.py &          # port 8787 (set THAWANI_* env for card tests)
  python3 tools/serve.py                # http://localhost:8080/sites/<slug>/
"""
import http.server
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = os.environ.get("SHOP_API", "http://127.0.0.1:" + os.environ.get("SHOP_PORT", "8787"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def proxy(self):
        n = int(self.headers.get("Content-Length") or 0)
        req = urllib.request.Request(API + self.path, data=self.rfile.read(n) if n else None, method=self.command,
                                     headers={k: v for k, v in self.headers.items() if k.lower() in ("content-type", "x-admin-key")} |
                                     {"X-Forwarded-Host": self.headers.get("Host", ""), "X-Forwarded-Proto": "http"})
        try:
            r = urllib.request.urlopen(req, timeout=30)
            code, body, ctype = r.status, r.read(), r.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            code, body, ctype = e.code, e.read(), e.headers.get("Content-Type", "application/json")
        except OSError:
            code, body, ctype = 502, b'{"error": "shop api is not running"}', "application/json"
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        return self.proxy() if self.path.startswith("/api/") else super().do_GET()

    def do_POST(self):
        return self.proxy() if self.path.startswith("/api/") else self.send_error(405)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    print(f"http://localhost:{port}/sites/  (api -> {API})")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
