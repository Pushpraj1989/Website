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

# Upload the built files plus install.sh, then run install.sh on the server.
BUNDLE="$(mktemp -d)/tier1-concepts.tgz"
tar -C "$ROOT_DIR" -czf "$BUNDLE" index.html assets sites deploy/install.sh
echo "→ uploading $(du -h "$BUNDLE" | cut -f1) to $TARGET"
scp "${SSH_OPTS[@]}" "$BUNDLE" "$TARGET:/tmp/tier1-upload.tgz"
ssh "${SSH_OPTS[@]}" "$TARGET" "set -e; rm -rf /tmp/tier1-src; mkdir -p /tmp/tier1-src; tar -xzf /tmp/tier1-upload.tgz -C /tmp/tier1-src; HOST_IP=$HOST_IP bash /tmp/tier1-src/deploy/install.sh; rm -rf /tmp/tier1-src /tmp/tier1-upload.tgz"
exit 0
echo
echo "Live links:"
echo "  Hub:           http://$HOST_IP/"
for s in galfar national-gas badr-al-samaa starcare assarain asyad-express; do
  printf '  %-14s http://%s/sites/%s/\n' "$s:" "$HOST_IP" "$s"
done
