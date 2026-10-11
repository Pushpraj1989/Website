#!/usr/bin/env bash
# Deploy the built concept sites (index.html, assets/, sites/) to a Linux server over SSH.
#
#   ./deploy/deploy.sh root@187.77.125.86            # uses your normal SSH login
#   SSH_KEY=~/.ssh/tier1_deploy ./deploy/deploy.sh root@187.77.125.86
#
# What it does on the server:
#   - unpacks the sites into /var/www/tier1-concepts (keeps the previous copy as .old)
#   - installs nginx if no web server is running (apt or dnf)
#   - adds ONE nginx server block that answers only for the server's IP address,
#     so any existing sites served under their own domain names are not touched
#   - refuses to continue if port 80 is held by something other than nginx
set -euo pipefail

TARGET="${1:?usage: deploy.sh user@host}"
HOST_IP="${TARGET#*@}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
[ -n "${SSH_KEY:-}" ] && SSH_OPTS+=(-i "$SSH_KEY")

for f in index.html assets sites; do
  [ -e "$ROOT_DIR/$f" ] || { echo "missing $f — run python3 build/build.py first" >&2; exit 1; }
done

BUNDLE="$(mktemp -d)/tier1-concepts.tgz"
tar -C "$ROOT_DIR" -czf "$BUNDLE" index.html assets sites
echo "→ uploading $(du -h "$BUNDLE" | cut -f1) to $TARGET"
scp "${SSH_OPTS[@]}" "$BUNDLE" "$TARGET:/tmp/tier1-concepts.tgz"

ssh "${SSH_OPTS[@]}" "$TARGET" HOST_IP="$HOST_IP" bash -s <<'REMOTE'
set -euo pipefail
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

    location ~* \.(?:css|js|jpg|jpeg|png|webp|svg|woff2?)$ {
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
REMOTE

echo
echo "Live links:"
echo "  Hub:           http://$HOST_IP/"
for s in galfar national-gas badr-al-samaa starcare assarain asyad-express; do
  printf '  %-14s http://%s/sites/%s/\n' "$s:" "$HOST_IP" "$s"
done
