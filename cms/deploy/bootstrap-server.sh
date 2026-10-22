#!/usr/bin/env bash
# One-time setup of the Hostinger VPS (Ubuntu 22.04 or 24.04). Run as root on the server:
#   DEPLOY_PUBLIC_KEY="ssh-ed25519 AAAA... deploy-azaiba" bash bootstrap-server.sh
# Safe to run again. It does not start nginx for the site until you fill in the domain names.
set -euo pipefail

: "${DEPLOY_PUBLIC_KEY:?Set DEPLOY_PUBLIC_KEY to the public key line for the deploy user}"
REPO=/srv/website

apt-get update -y
apt-get install -y nginx certbot python3-venv python3-pip rsync ufw curl ca-certificates

# Node.js 22 (the CMS needs 22.13 or newer for its built-in SQLite)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Users: cms runs the service and owns the writable folders; deploy copies code and restarts the service
getent group cms >/dev/null || groupadd --system cms
id cms >/dev/null 2>&1 || useradd --system --gid cms --home "$REPO" --shell /usr/sbin/nologin cms
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --gid cms deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
printf '%s\n' "$DEPLOY_PUBLIC_KEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

# Folders: group cms can write where the CMS saves; setgid keeps new files in the cms group
install -d -o deploy -g cms "$REPO"
for d in "$REPO/cms/data" "$REPO/portals/azaiba-portal" "$REPO/portals/azaiba-portal/content" "$REPO/portals/azaiba-portal/content/media" "$REPO/data" "$REPO/shared/img" "$REPO/sites"; do
  install -d -o deploy -g cms "$d"
  chmod 2775 "$d"
done

# Python for the site builder
if [ ! -x /srv/venv/bin/python ]; then python3 -m venv /srv/venv; fi
# The portal's React build needs Node packages; the deploy job installs them on each deploy.
/srv/venv/bin/pip install --quiet --upgrade jinja2 pillow

# Environment file for the CMS: root owns it, the cms user can read it, nobody else can
if [ ! -f /etc/azaiba-cms.env ]; then
  install -m 640 -o root -g cms "$REPO/cms/.env.example" /etc/azaiba-cms.env
  echo "Created /etc/azaiba-cms.env from the template. Edit it: CMS_PUBLIC_URL, SMTP_* values."
fi

# Service and the one command the deploy user may run as root
install -m 644 "$REPO/cms/deploy/azaiba-cms.service" /etc/systemd/system/azaiba-cms.service
cat > /etc/sudoers.d/azaiba-deploy <<'SUDOERS'
deploy ALL=(root) NOPASSWD: /bin/systemctl restart azaiba-cms, /bin/systemctl reload nginx
SUDOERS
chmod 440 /etc/sudoers.d/azaiba-deploy
visudo -cf /etc/sudoers.d/azaiba-deploy >/dev/null
systemctl daemon-reload
systemctl enable azaiba-cms >/dev/null 2>&1 || true

# Firewall: SSH, HTTP, HTTPS only
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo "Server ready. Next: edit /etc/azaiba-cms.env, put the nginx config in place with your domains,"
echo "run certbot, then push to the deploy branch (GitHub Actions does the rest)."
