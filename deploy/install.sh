#!/usr/bin/env bash
# Install the concept sites on THIS server (run as root, e.g. in Hostinger's Web console).
#
#   bash deploy/install.sh            # from a checkout of the repository
#
# Copies index.html, assets/ and sites/ into /var/www/tier1-concepts (previous copy kept as .old),
# installs nginx if no web server is running, and adds one server block that answers only for
# this server's public IP, so existing sites under their own domain names are not touched.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
HOST_IP="${HOST_IP:-$(curl -4 -s --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')}"
[ -n "$HOST_IP" ] || { echo "Could not work out the public IP; run with HOST_IP=1.2.3.4" >&2; exit 1; }
for f in index.html assets sites; do [ -e "$SRC/$f" ] || { echo "missing $SRC/$f" >&2; exit 1; }; done
tar -C "$SRC" -czf /tmp/tier1-concepts.tgz index.html assets sites
DIR=/var/www/tier1-concepts

# 1. files
mkdir -p "$DIR.new"
tar -xzf /tmp/tier1-concepts.tgz -C "$DIR.new"
rm -rf "$DIR.old"
[ -d "$DIR" ] && mv "$DIR" "$DIR.old"
mv "$DIR.new" "$DIR"
chmod -R a+rX "$DIR"
rm -f /tmp/tier1-concepts.tgz

# 2. web server
holder="$(ss -ltnp 2>/dev/null | awk '$4 ~ /:80$/' | grep -o 'users:(("[^"]*' | head -1 | cut -d'"' -f2 || true)"
if [ -n "$holder" ] && [ "$holder" != "nginx" ]; then
  echo "Port 80 is already used by '$holder'. Files are in $DIR; point that server at it, or ask for help." >&2
  exit 2
fi
if ! command -v nginx >/dev/null 2>&1; then
  echo "→ installing nginx"
  if command -v apt-get >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q nginx
  else
    echo "No apt-get or dnf found; install nginx manually." >&2; exit 3
  fi
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then systemctl enable --now nginx; else nginx; fi
fi

# 2b. order service for sites with a shop (server/shop_api.py, standard library only)
API_BLOCK=""
if ls "$DIR"/sites/*/assets/shop.json >/dev/null 2>&1; then
  echo "→ order service"
  mkdir -p /opt/tier1-shop
  cp "$SRC/server/shop_api.py" /opt/tier1-shop/shop_api.py
  ENV=/etc/tier1-shop.env
  if [ ! -f "$ENV" ]; then
    # keys stay empty until you add them: card payments stay off, cash and pickup orders work
    {
      echo "THAWANI_MODE=uat"
      echo "THAWANI_SECRET_KEY="
      echo "THAWANI_PUBLISHABLE_KEY="
      echo "THAWANI_WEBHOOK_SECRET="
      echo "ORDERS_ADMIN_KEY=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')"
    } > "$ENV"
    chmod 600 "$ENV"
    echo "  created $ENV: add the Thawani keys there; the orders admin key is inside"
  fi
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    cat > /etc/systemd/system/tier1-shop.service <<UNIT
[Unit]
Description=Tier1 concept sites order service
After=network.target

[Service]
EnvironmentFile=$ENV
Environment=SHOP_SITES_DIR=$DIR/sites SHOP_DATA_DIR=/var/lib/tier1-shop SHOP_PORT=8787
ExecStart=/usr/bin/env python3 /opt/tier1-shop/shop_api.py
Restart=always
DynamicUser=yes
StateDirectory=tier1-shop

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable tier1-shop >/dev/null 2>&1
    systemctl restart tier1-shop
  else
    mkdir -p /var/lib/tier1-shop; pkill -f /opt/tier1-shop/shop_api.py 2>/dev/null || true
    (set -a; . "$ENV"; set +a; SHOP_SITES_DIR=$DIR/sites SHOP_DATA_DIR=/var/lib/tier1-shop nohup python3 /opt/tier1-shop/shop_api.py >/var/log/tier1-shop.log 2>&1 &)
  fi
  API_BLOCK="
    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 64k;
    }"
fi

# 3. site config: answers only for http://<ip>/
CONF=/etc/nginx/conf.d/tier1-concepts.conf
if grep -Rqs "server_name[^;]*\b${HOST_IP}\b" /etc/nginx --exclude=tier1-concepts.conf; then
  echo "Another nginx site already uses server_name ${HOST_IP}; not adding a second one." >&2
  echo "Files are in $DIR — add 'location / { root $DIR; }' to that site, or ask for help." >&2
  exit 4
fi
cat > "$CONF" <<NGX
server {
    listen 80;
    server_name ${HOST_IP};
    root ${DIR};
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

${API_BLOCK}

    location ~* \.(?:css|js|jpg|jpeg|png|webp|svg|woff2?|mp4|webm)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
NGX
nginx -t
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then systemctl reload nginx; else nginx -s reload 2>/dev/null || nginx; fi

# 4. firewall (only if ufw is active)
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
fi
echo "deployed"

echo
echo "Live links:"
echo "  Hub:            http://$HOST_IP/"
for s in galfar national-gas badr-al-samaa starcare assarain asyad-express; do
  printf '  %-15s http://%s/sites/%s/\n' "$s:" "$HOST_IP" "$s"
done
