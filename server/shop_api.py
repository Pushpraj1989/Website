#!/usr/bin/env python3
"""Order and payment service for kit sites that have a "shop" block.

Standard library only. Runs behind nginx at /api/ (see deploy/install.sh):

  GET  /api/health                     -> {"ok": true, "card": bool, "mode": "uat"}
  POST /api/order                      -> validate cart against the site's own price list,
                                          save the order, and for card payments create a
                                          Thawani Pay checkout session and return its URL
  GET  /api/order/<id>?site=<slug>     -> order status (asks Thawani when a card order is unpaid)
  POST /api/thawani/webhook            -> signed payment events from the Thawani merchant portal
  GET  /api/admin/orders?site=<slug>   -> order list for the restaurant (needs ORDERS_ADMIN_KEY)

Prices never come from the browser: every line is re-priced from
sites/<slug>/assets/shop.json, the file the build writes from data/<slug>.json.

Environment (put these in /etc/tier1-shop.env, never in the repository):
  THAWANI_SECRET_KEY, THAWANI_PUBLISHABLE_KEY   keys from the Thawani merchant portal
  THAWANI_MODE=uat|live                         uat until the merchant account is live
  THAWANI_WEBHOOK_SECRET                        optional, from the merchant portal
  ORDERS_ADMIN_KEY                              password for /api/admin/orders
  SHOP_SITES_DIR (default: ../sites), SHOP_DATA_DIR (default: /var/lib/tier1-shop)
  SHOP_PUBLIC_URL e.g. https://example.com/healthy-lab  (base for success/cancel links)
  SHOP_PORT (default 8787)
"""
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
SITES = Path(os.environ.get("SHOP_SITES_DIR") or ROOT / "sites")
DATA = Path(os.environ.get("SHOP_DATA_DIR") or "/var/lib/tier1-shop")
MODE = os.environ.get("THAWANI_MODE", "uat").lower()
BASE = "https://checkout.thawani.om" if MODE == "live" else "https://uatcheckout.thawani.om"
SECRET = os.environ.get("THAWANI_SECRET_KEY", "")
PUBLISHABLE = os.environ.get("THAWANI_PUBLISHABLE_KEY", "")
WEBHOOK_SECRET = os.environ.get("THAWANI_WEBHOOK_SECRET", "")
ADMIN_KEY = os.environ.get("ORDERS_ADMIN_KEY", "")
LOCK = threading.Lock()
SLUG = re.compile(r"^[a-z0-9-]{1,60}$")


def catalogue(site):
    if not SLUG.match(site or ""):
        raise ValueError("unknown site")
    path = SITES / site / "assets" / "shop.json"
    if not path.exists():
        raise ValueError("this site has no shop")
    return json.loads(path.read_text(encoding="utf-8"))


def orders_file(site):
    DATA.mkdir(parents=True, exist_ok=True)
    return DATA / f"{site}.jsonl"


def load_orders(site):
    f = orders_file(site)
    out = {}
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                o = json.loads(line)
                out[o["id"]] = o  # later lines are updates
    return out


def save_order(site, order):
    with LOCK, orders_file(site).open("a", encoding="utf-8") as f:
        f.write(json.dumps(order, ensure_ascii=False) + "\n")


def thawani(method, path, body=None):
    req = urllib.request.Request(BASE + "/api/v1" + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", "thawani-api-key": SECRET,
                                          "User-Agent": "tier1-shop/1.0"})  # Cloudflare rejects the default urllib agent
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read())
        except Exception:
            detail = {"description": str(e)}
        raise RuntimeError(detail.get("description") or "payment service error") from None


def clean(value, limit=200):
    return re.sub(r"[\x00-\x1f]", " ", str(value or "")).strip()[:limit]


def build_order(payload):
    site = payload.get("site", "")
    shop = catalogue(site)
    lines, total = [], 0
    for row in (payload.get("cart") or [])[:30]:  # Thawani accepts at most 30 product lines
        item = shop["items"].get(str(row.get("sku")))
        qty = int(row.get("qty") or 0)
        if not item or not item.get("a") or not 1 <= qty <= 50:
            raise ValueError("an item in your cart is no longer available online")
        baisa = round(item["a"] * 1000)
        lines.append({"sku": row["sku"], "name": item["t"], "qty": qty, "baisa": baisa, "note": clean(row.get("opt"), 80)})
        total += baisa * qty
    if not lines:
        raise ValueError("your cart is empty")
    c = payload.get("customer") or {}
    customer = {"name": clean(c.get("name"), 80), "phone": clean(c.get("phone"), 30), "email": clean(c.get("email"), 120)}
    if not customer["name"] or len(re.sub(r"\D", "", customer["phone"])) < 8:
        raise ValueError("please add your name and a phone number")
    fulfil = payload.get("fulfilment") if payload.get("fulfilment") in ("delivery", "pickup") else "pickup"
    pay = payload.get("payment") if payload.get("payment") in ("card", "cod", "counter") else "cod"
    return site, shop, {
        "id": time.strftime("%y%m%d") + "-" + secrets.token_hex(3).upper(), "site": site, "created": int(time.time()),
        "lines": lines, "total_baisa": total, "currency": shop.get("currency", "OMR"), "customer": customer,
        "fulfilment": fulfil, "address": clean(payload.get("address"), 300), "area": clean(payload.get("area"), 80),
        "when": clean(payload.get("when"), 60), "notes": clean(payload.get("notes"), 300), "payment": pay,
        "status": "awaiting_payment" if pay == "card" else "new"}


def public_base(handler, site, base):
    """Where Thawani sends the customer back. SHOP_PUBLIC_URL wins; otherwise the page's own
    folder as the browser reported it, accepted only when it is on the host that called us."""
    if os.environ.get("SHOP_PUBLIC_URL"):
        return os.environ["SHOP_PUBLIC_URL"].rstrip("/")
    host = handler.headers.get("X-Forwarded-Host") or handler.headers.get("Host", "")
    u = urlparse(base or "")
    if u.scheme in ("http", "https") and u.netloc == host and u.path.rstrip("/").endswith("/" + site):
        return f"{u.scheme}://{u.netloc}{u.path.rstrip('/')}"
    proto = handler.headers.get("X-Forwarded-Proto", "http")
    return f"{proto}://{host}/sites/{site}"


def line_text(l):
    return f"{l['qty']} x {l['name']}" + (f" ({l['note']})" if l.get("note") else "")


class Handler(BaseHTTPRequestHandler):
    server_version = "tier1-shop"

    def log_message(self, fmt, *args):
        print("%s %s" % (self.address_string(), fmt % args), flush=True)

    def send(self, code, obj, ctype="application/json"):
        body = obj if isinstance(obj, bytes) else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self, limit=64_000):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError("request too large")
        return self.rfile.read(n)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        path = u.path.removeprefix("/api")
        try:
            if path == "/health":
                return self.send(200, {"ok": True, "card": bool(SECRET and PUBLISHABLE), "mode": MODE})
            m = re.fullmatch(r"/order/(P?[0-9]{6}-[0-9A-F]{6})", path)
            if m:
                return self.order_status(q.get("site", ""), m[1])
            if path == "/admin/orders":
                return self.admin(q)
            self.send(404, {"error": "not found"})
        except ValueError as e:
            self.send(400, {"error": str(e)})

    def do_POST(self):
        path = urlparse(self.path).path.removeprefix("/api")
        try:
            raw = self.body()
            if path == "/order":
                return self.create(json.loads(raw or b"{}"))
            if path == "/thawani/webhook":
                return self.webhook(raw)
            self.send(404, {"error": "not found"})
        except (ValueError, json.JSONDecodeError) as e:
            self.send(400, {"error": str(e)})
        except RuntimeError as e:
            self.send(502, {"error": str(e)})

    def create(self, payload):
        if payload.get("kind") == "plan":
            return self.plan(payload)
        site, shop, order = build_order(payload)
        if order["payment"] == "card":
            if not (SECRET and PUBLISHABLE):
                raise ValueError("card payments are not switched on yet; choose cash or pickup")
            if order["total_baisa"] < 100:
                raise ValueError("card payments start at 0.100 OMR")
            base = public_base(self, site, payload.get("base"))
            res = thawani("POST", "/checkout/session", {
                "client_reference_id": order["id"], "mode": "payment",
                "products": [{"name": l["name"][:40], "quantity": l["qty"], "unit_amount": l["baisa"]} for l in order["lines"]],
                "success_url": f"{base}/order.html?status=success&order={order['id']}",
                "cancel_url": f"{base}/order.html?status=cancel&order={order['id']}",
                "metadata": {"order": order["id"], "site": site, "customer_name": order["customer"]["name"],
                             "customer_phone": order["customer"]["phone"], "customer_email": order["customer"]["email"] or "-"}})
            sid = res["data"]["session_id"]
            order["session_id"] = sid
            save_order(site, order)
            return self.send(200, {"order": order["id"], "total": order["total_baisa"] / 1000,
                                   "redirect": f"{BASE}/pay/{sid}?key={PUBLISHABLE}"})
        save_order(site, order)
        self.send(200, {"order": order["id"], "total": order["total_baisa"] / 1000, "status": order["status"]})

    def plan(self, payload):
        site = payload.get("site", "")
        shop = catalogue(site)
        c = payload.get("customer") or {}
        customer = {"name": clean(c.get("name"), 80), "phone": clean(c.get("phone"), 30), "email": clean(c.get("email"), 120)}
        if not customer["name"] or len(re.sub(r"\D", "", customer["phone"])) < 8:
            raise ValueError("please add your name and a phone number")
        p = payload.get("plan") or {}
        picks = [shop["items"][k]["t"] for k in (p.get("picks") or [])[:40] if k in shop["items"]]
        order = {"id": "P" + time.strftime("%y%m%d") + "-" + secrets.token_hex(3).upper(), "site": site, "created": int(time.time()),
                 "kind": "plan", "lines": [{"sku": "", "name": t, "qty": 1, "baisa": 0} for t in picks], "total_baisa": 0,
                 "currency": shop.get("currency", "OMR"), "customer": customer, "fulfilment": "plan", "area": "", "address": "",
                 "when": "", "payment": "to agree",
                 "notes": clean(f"{p.get('goal', '')} · {p.get('meals', '')} meals/day · {p.get('days', '')} days/week · {p.get('weeks', '')} weeks · {payload.get('notes', '')}", 300),
                 "status": "plan_request"}
        save_order(site, order)
        self.send(200, {"order": order["id"], "status": order["status"]})

    def order_status(self, site, oid):
        catalogue(site)
        order = load_orders(site).get(oid)
        if not order:
            return self.send(404, {"error": "order not found"})
        if order["payment"] == "card" and order["status"] == "awaiting_payment" and order.get("session_id") and SECRET:
            try:
                st = thawani("GET", f"/checkout/session/{order['session_id']}")["data"]["payment_status"]
                if st in ("paid", "cancelled"):
                    order = {**order, "status": "paid" if st == "paid" else "payment_cancelled", "updated": int(time.time())}
                    save_order(site, order)
            except RuntimeError:
                pass
        self.send(200, {"order": oid, "status": order["status"], "total": order["total_baisa"] / 1000,
                        "fulfilment": order["fulfilment"], "payment": order["payment"],
                        "lines": [{"name": l["name"], "qty": l["qty"]} for l in order["lines"]]})

    def webhook(self, raw):
        if not WEBHOOK_SECRET:
            return self.send(503, {"error": "webhook secret not configured"})
        ts = self.headers.get("thawani-timestamp", "")
        expected = hmac.new(WEBHOOK_SECRET.encode(), raw + b"-" + ts.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, self.headers.get("thawani-signature", "")):
            return self.send(401, {"error": "bad signature"})
        event = json.loads(raw)
        data = event.get("data") or {}
        if event.get("event_type") == "checkout.completed" and data.get("payment_status") == "paid":
            meta = data.get("metadata") or {}
            site, oid = meta.get("site", ""), meta.get("order") or data.get("client_reference_id")
            order = load_orders(site).get(oid) if SLUG.match(site) else None
            if order and order["status"] != "paid":
                save_order(site, {**order, "status": "paid", "updated": int(time.time())})
        self.send(200, {"received": True})

    def admin(self, q):
        key = self.headers.get("X-Admin-Key") or q.get("key", "")
        if not ADMIN_KEY or not hmac.compare_digest(key, ADMIN_KEY):
            return self.send(401, {"error": "admin key required"})
        site = q.get("site", "")
        catalogue(site)
        rows = sorted(load_orders(site).values(), key=lambda o: -o["created"])
        if q.get("format") == "json":
            return self.send(200, rows)
        e = html.escape
        trs = "".join(
            f"<tr><td>{e(o['id'])}<br><small>{time.strftime('%d %b %H:%M', time.localtime(o['created']))}</small></td>"
            f"<td>{e(o['customer']['name'])}<br><a href='tel:{e(o['customer']['phone'])}'>{e(o['customer']['phone'])}</a></td>"
            f"<td>{'<br>'.join(e(line_text(l)) for l in o['lines'])}</td>"
            f"<td>{o['total_baisa'] / 1000:.3f}</td><td>{e(o['fulfilment'])}<br><small>{e(o['area'])} {e(o['address'])}</small></td>"
            f"<td>{e(o['payment'])}</td><td><b>{e(o['status'])}</b></td><td>{e(o['notes'])}</td></tr>" for o in rows)
        page = (f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Orders · {e(site)}</title>"
                "<style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}</style>"
                f"<h1>Orders · {e(site)}</h1><p>{len(rows)} orders. Refresh to update.</p><table><tr><th>Order</th><th>Customer</th><th>Items</th><th>OMR</th><th>Fulfilment</th><th>Payment</th><th>Status</th><th>Notes</th></tr>{trs}</table>")
        self.send(200, page.encode(), "text/html")


def main():
    port = int(os.environ.get("SHOP_PORT", "8787"))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"shop api on 127.0.0.1:{port} · thawani {MODE} · card {'on' if SECRET and PUBLISHABLE else 'off'}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
